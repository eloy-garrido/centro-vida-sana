/**
 * Centro Vida Sana Austral — Tests de Autenticación, Sesiones y Roles (AUTH-01 a AUTH-05)
 * Conforme a S01 (identidad Google y sesiones) y P01.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { createSqliteAdapter } from '../../src/server/db/adapter.ts';
import {
  createOAuthAttempt,
  consumeOAuthAttempt,
  findOrCreateUser,
  createSession,
  validateSession,
  revokeSession,
  deriveCsrfToken
} from '../../src/server/auth/session-service.ts';

import {
  validateGoogleIdTokenClaims,
  createMockIdTokenClaims
} from '../../src/server/auth/oidc-validator.ts';

import {
  validateSafeReturnUrl,
  parseCookies,
  extractSessionToken,
  validateCsrfHeader,
  createSessionCookie,
  createClearSessionCookie
} from '../../src/server/auth/middleware.ts';

function createTestDatabase() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  const migrationPath = resolve(process.cwd(), 'migrations/0001_initial_schema.sql');
  const sql = readFileSync(migrationPath, 'utf-8');
  db.exec(sql);
  return { db, adapter: createSqliteAdapter(db) };
}

const TEST_CLIENT_ID = 'vida-sana-google-client-test.apps.googleusercontent.com';

// ============================================================================
// 1. TESTS DE OIDC: CLAIMS, FIRMAS Y VALIDADOR (AUTH-02)
// ============================================================================

test('AUTH-02: Validación rigurosa de ID Token OIDC', () => {
  const nonce = 'test_nonce_secure_999';

  // 1. Token válido con todos los claims correctos
  const validClaims = createMockIdTokenClaims({
    aud: TEST_CLIENT_ID,
    nonce,
    email_verified: true,
    sub: 'google_sub_12345',
    email: 'paciente.valido@gmail.com'
  });

  const res1 = validateGoogleIdTokenClaims(validClaims, {
    expectedClientId: TEST_CLIENT_ID,
    expectedNonce: nonce
  });
  assert.strictEqual(res1.valid, true);
  assert.strictEqual(res1.user?.googleSub, 'google_sub_12345');
  assert.strictEqual(res1.user?.email, 'paciente.valido@gmail.com');

  // 2. Rechazo por audiencia errónea (Client ID no autorizado)
  const resAudience = validateGoogleIdTokenClaims(
    { ...validClaims, aud: 'otro-proyecto-ajeno.apps.googleusercontent.com' },
    { expectedClientId: TEST_CLIENT_ID, expectedNonce: nonce }
  );
  assert.strictEqual(resAudience.valid, false);
  assert.strictEqual(resAudience.error, 'OIDC_AUDIENCE_MISMATCH');

  // 3. Rechazo por emisor erróneo
  const resIssuer = validateGoogleIdTokenClaims(
    { ...validClaims, iss: 'https://fake-google.com' },
    { expectedClientId: TEST_CLIENT_ID, expectedNonce: nonce }
  );
  assert.strictEqual(resIssuer.valid, false);
  assert.strictEqual(resIssuer.error, 'OIDC_INVALID_ISSUER');

  // 4. Rechazo por nonce incorrecto (Anti-Replay)
  const resNonce = validateGoogleIdTokenClaims(validClaims, {
    expectedClientId: TEST_CLIENT_ID,
    expectedNonce: 'otro_nonce_distinto'
  });
  assert.strictEqual(resNonce.valid, false);
  assert.strictEqual(resNonce.error, 'OIDC_NONCE_MISMATCH');

  // 5. Rechazo por token expirado
  const now = Math.floor(Date.now() / 1000);
  const resExpired = validateGoogleIdTokenClaims(
    { ...validClaims, exp: now - 100 },
    { expectedClientId: TEST_CLIENT_ID, expectedNonce: nonce }
  );
  assert.strictEqual(resExpired.valid, false);
  assert.strictEqual(resExpired.error, 'OIDC_TOKEN_EXPIRED');

  // 6. Rechazo por correo no verificado en Google
  const resUnverified = validateGoogleIdTokenClaims(
    { ...validClaims, email_verified: false },
    { expectedClientId: TEST_CLIENT_ID, expectedNonce: nonce }
  );
  assert.strictEqual(resUnverified.valid, false);
  assert.strictEqual(resUnverified.error, 'OIDC_EMAIL_NOT_VERIFIED');
});

// ============================================================================
// 2. TESTS DE INTENTOS OAUTH Y CONSUMO ÚNICO (AUTH-02)
// ============================================================================

test('AUTH-02: Intentos de OAuth de un solo uso (Anti-Replay)', async () => {
  const { db, adapter } = createTestDatabase();

  const attempt = await createOAuthAttempt(adapter, {
    returnTo: '/reservar',
    codeVerifier: 'verifier_pkce_123',
    nonce: 'nonce_abc_456'
  });

  assert.ok(attempt.state.length > 20);

  // 1. Primer consumo: Debe ser exitoso y devolver los parámetros
  const consumed = await consumeOAuthAttempt(adapter, attempt.state);
  assert.ok(consumed !== null);
  assert.strictEqual(consumed.codeVerifier, 'verifier_pkce_123');
  assert.strictEqual(consumed.nonce, 'nonce_abc_456');
  assert.strictEqual(consumed.returnTo, '/reservar');

  // 2. Segundo consumo con el mismo state (intento de replay): Debe retornar null
  const replay = await consumeOAuthAttempt(adapter, attempt.state);
  assert.strictEqual(replay, null, 'Un intento OAuth consumido no puede volver a utilizarse');

  db.close();
});

// ============================================================================
// 3. TESTS DE SESIÓN, ROLES Y AISLAMIENTO (AUTH-01 / AUTH-04)
// ============================================================================

test('AUTH-01: Distinción de roles entre Paciente y Equipo', async () => {
  const { db, adapter } = createTestDatabase();

  // 1. Usuario paciente ordinario
  const patient = await findOrCreateUser(adapter, {
    googleSub: 'sub_patient_777',
    name: 'Ana Paciente',
    email: 'ana.paciente@gmail.com'
  });

  const sessionPatient = await createSession(adapter, patient.id);
  const validatedPatient = await validateSession(adapter, sessionPatient.rawToken);

  assert.ok(validatedPatient !== null);
  assert.strictEqual(validatedPatient.user.email, 'ana.paciente@gmail.com');
  assert.strictEqual(validatedPatient.capabilities.teamAgenda, false, 'Paciente no tiene acceso de equipo');

  // 2. Usuario administrador autorizado en D03 (centrovida.sanaaustral@gmail.com)
  const admin = await findOrCreateUser(adapter, {
    googleSub: 'sub_admin_888',
    name: 'Admin Vida Sana',
    email: 'centrovida.sanaaustral@gmail.com'
  });

  const sessionAdmin = await createSession(adapter, admin.id);
  const validatedAdmin = await validateSession(adapter, sessionAdmin.rawToken);

  assert.ok(validatedAdmin !== null);
  assert.strictEqual(validatedAdmin.user.email, 'centrovida.sanaaustral@gmail.com');
  assert.strictEqual(validatedAdmin.capabilities.teamAgenda, true, 'Admin tiene acceso de equipo a ambas agendas');

  db.close();
});

test('AUTH-04: Miembro revocado pierde privilegios inmediatamente', async () => {
  const { db, adapter } = createTestDatabase();

  // Agregar temporalmente un profesional a team_members
  await adapter.run(
    "INSERT INTO team_members (email, role, is_active, created_at) VALUES ('pro.test@centrovidasana.cl', 'professional', 1, 1730890000)"
  );

  const pro = await findOrCreateUser(adapter, {
    googleSub: 'sub_pro_test',
    name: 'Profesional Test',
    email: 'pro.test@centrovidasana.cl'
  });

  const session = await createSession(adapter, pro.id);

  // 1. Verificar acceso inicial de equipo
  let valid = await validateSession(adapter, session.rawToken);
  assert.strictEqual(valid?.capabilities.teamAgenda, true);

  // 2. Desactivar miembro del equipo (is_active = 0)
  await adapter.run("UPDATE team_members SET is_active = 0 WHERE email = 'pro.test@centrovidasana.cl'");

  // 3. En la siguiente consulta debe perder privilegios de equipo de inmediato sin requerir nuevo login
  valid = await validateSession(adapter, session.rawToken);
  assert.ok(valid !== null);
  assert.strictEqual(valid.capabilities.teamAgenda, false, 'Miembro revocado pierde acceso inmediatamente');

  db.close();
});

// ============================================================================
// 4. TESTS DE LOGOUT Y REVOCACIÓN DE SESIÓN (AUTH-03)
// ============================================================================

test('AUTH-03: Logout inmediato revoca la sesión en D1', async () => {
  const { db, adapter } = createTestDatabase();

  const user = await findOrCreateUser(adapter, {
    googleSub: 'sub_logout_test',
    name: 'Carlos Test',
    email: 'carlos@example.com'
  });

  const session = await createSession(adapter, user.id);

  // Sesión válida antes del logout
  let valid = await validateSession(adapter, session.rawToken);
  assert.ok(valid !== null);

  // Ejecutar Logout (revocación en base de datos)
  const revoked = await revokeSession(adapter, session.rawToken);
  assert.strictEqual(revoked, true);

  // Sesión debe ser rechazada inmediatamente después de revocar
  valid = await validateSession(adapter, session.rawToken);
  assert.strictEqual(valid, null, 'Sesión revocada debe retornar null');

  db.close();
});

// ============================================================================
// 5. TESTS DE CSRF Y COOKIES (S01 / S09)
// ============================================================================

test('CSRF: Derivación y validación de cabecera X-CSRF-Token', async () => {
  const rawToken = 'random_session_token_example_123';
  const expectedCsrf = await deriveCsrfToken(rawToken);

  // Cabeceras correctas
  const headersValid = new Headers({
    'x-csrf-token': expectedCsrf
  });
  assert.strictEqual(validateCsrfHeader(headersValid, expectedCsrf), true);

  // Cabecera CSRF incorrecta
  const headersInvalid = new Headers({
    'x-csrf-token': 'token_falso_atacante'
  });
  assert.strictEqual(validateCsrfHeader(headersInvalid, expectedCsrf), false);

  // Cabecera CSRF ausente
  const headersEmpty = new Headers();
  assert.strictEqual(validateCsrfHeader(headersEmpty, expectedCsrf), false);
});

test('Cookies: creación y extracción de token de sesión', () => {
  const token = 'session_token_xyz_789';

  // Cookie local
  const cookieHeaderLocal = createSessionCookie(token, { isHttps: false });
  assert.ok(cookieHeaderLocal.includes('vsa_session=session_token_xyz_789'));
  assert.ok(cookieHeaderLocal.includes('HttpOnly'));
  assert.ok(cookieHeaderLocal.includes('SameSite=Lax'));

  // Cookie segura para HTTPS en producción
  const cookieHeaderHttps = createSessionCookie(token, { isHttps: true });
  assert.ok(cookieHeaderHttps.includes('__Host-vsa_session=session_token_xyz_789'));
  assert.ok(cookieHeaderHttps.includes('Secure'));

  // Extracción
  const headers = new Headers({
    cookie: 'other=123; vsa_session=session_token_xyz_789; theme=dark'
  });
  assert.strictEqual(extractSessionToken(headers), 'session_token_xyz_789');
});

// ============================================================================
// 6. PREVENCIÓN DE OPEN REDIRECT (S01 L30)
// ============================================================================

test('Open Redirect: solo se permiten rutas relativas locales seguras', () => {
  // Rutas locales autorizadas
  assert.strictEqual(validateSafeReturnUrl('/reservar'), '/reservar');
  assert.strictEqual(validateSafeReturnUrl('/agenda'), '/agenda');
  assert.strictEqual(validateSafeReturnUrl('/'), '/');

  // Ataques de redirección abierta (deben neutralizarse a '/reservar')
  assert.strictEqual(validateSafeReturnUrl('https://malicious-site.com'), '/reservar');
  assert.strictEqual(validateSafeReturnUrl('//evil.com/phishing'), '/reservar');
  assert.strictEqual(validateSafeReturnUrl('\\evil.com'), '/reservar');
  assert.strictEqual(validateSafeReturnUrl('javascript:alert(1)'), '/reservar');
  assert.strictEqual(validateSafeReturnUrl(''), '/reservar');
  assert.strictEqual(validateSafeReturnUrl(null), '/reservar');
});
