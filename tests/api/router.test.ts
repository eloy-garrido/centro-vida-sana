/**
 * Centro Vida Sana Austral — Tests de Integración del Router HTTP Canónico (S09)
 * Valida todos los endpoints de S09, CSRF, control de acceso, idempotencia y privacidad.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { createSqliteAdapter } from '../../src/server/db/adapter.ts';
import { handleApiRequest } from '../../src/server/router.ts';
import { chileLocalToUtcSeconds } from '../../src/server/agenda/policy.ts';

function createTestDatabase() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  const migrationFiles = ['0001_initial_schema.sql', '0002_attendance_tracking.sql', '0003_patient_notes.sql'];
  for (const file of migrationFiles) {
    const migrationPath = resolve(process.cwd(), 'migrations', file);
    const sql = readFileSync(migrationPath, 'utf-8');
    db.exec(sql);
  }
  return { db, adapter: createSqliteAdapter(db) };
}

test('API-01 / S09: Sesión y autenticación (Anónimo y Mock Login)', async () => {
  const { db, adapter } = createTestDatabase();
  const now = chileLocalToUtcSeconds(2026, 11, 5, 12, 0);

  // 1. Petición anónima a /api/session -> authenticated: false
  const anonReq = new Request('http://localhost/api/session', { method: 'GET' });
  const anonRes = await handleApiRequest(anonReq, adapter, { nowSeconds: now });
  assert.strictEqual(anonRes.status, 200);
  const anonBody = await anonRes.json() as any;
  assert.strictEqual(anonBody.authenticated, false);

  // 2. Iniciar sesión como Paciente vía /api/mock-login
  const loginReq = new Request('http://localhost/api/mock-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'camila@gmail.com', name: 'Camila González', role: 'patient' })
  });
  const loginRes = await handleApiRequest(loginReq, adapter, { nowSeconds: now, isDev: true });
  assert.strictEqual(loginRes.status, 200);
  const loginBody = await loginRes.json() as any;
  assert.strictEqual(loginBody.role, 'patient');
  assert.ok(loginBody.csrfToken);

  const cookieHeader = loginRes.headers.get('Set-Cookie') || '';
  assert.ok(cookieHeader.includes('vsa_session='));

  // Extraer valor de la cookie
  const cookieMatch = cookieHeader.match(/vsa_session=([^;]+)/);
  const sessionCookie = `vsa_session=${cookieMatch![1]}`;

  // 3. Consultar /api/session con la cookie -> authenticated: true
  const authReq = new Request('http://localhost/api/session', {
    method: 'GET',
    headers: { Cookie: sessionCookie }
  });
  const authRes = await handleApiRequest(authReq, adapter, { nowSeconds: now });
  const authBody = await authRes.json() as any;
  assert.strictEqual(authBody.authenticated, true);
  assert.strictEqual(authBody.user.email, 'camila@gmail.com');
  assert.strictEqual(authBody.role, 'patient');
  assert.strictEqual(authBody.capabilities.teamAgenda, false);

  db.close();
});

test('API-02 / S09: Perfil recordado de paciente con ETag/If-Match', async () => {
  const { db, adapter } = createTestDatabase();
  const now = chileLocalToUtcSeconds(2026, 11, 5, 12, 0);

  // Mock login paciente
  const loginReq = new Request('http://localhost/api/mock-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'pat@example.com', name: 'Paciente Prueba' })
  });
  const loginRes = await handleApiRequest(loginReq, adapter, { nowSeconds: now, isDev: true });
  const loginData = await loginRes.json() as any;
  const cookie = `vsa_session=${loginRes.headers.get('Set-Cookie')!.match(/vsa_session=([^;]+)/)![1]}`;
  const csrfToken = loginData.csrfToken;

  // 1. GET Perfil inicial -> profile: null
  const get1 = await handleApiRequest(
    new Request('http://localhost/api/patient-profile', { headers: { Cookie: cookie } }),
    adapter,
    { nowSeconds: now }
  );
  const get1Body = await get1.json() as any;
  assert.strictEqual(get1Body.profile, null);

  // 2. PUT Perfil sin CSRF -> 403 Forbidden
  const putNoCsrf = await handleApiRequest(
    new Request('http://localhost/api/patient-profile', {
      method: 'PUT',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Camila', email: 'c@g.com', rut: '16.789.012-1' })
    }),
    adapter,
    { nowSeconds: now }
  );
  assert.strictEqual(putNoCsrf.status, 403);

  // 3. PUT Perfil con CSRF -> Éxito versión "v1"
  const put1 = await handleApiRequest(
    new Request('http://localhost/api/patient-profile', {
      method: 'PUT',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
      },
      body: JSON.stringify({
        name: 'Camila González',
        email: 'camila@gmail.com',
        rut: '16.789.012-1',
        documentType: 'rut',
        consentVersion: 'v1.0'
      })
    }),
    adapter,
    { nowSeconds: now }
  );
  assert.strictEqual(put1.status, 200);
  const put1Body = await put1.json() as any;
  assert.strictEqual(put1Body.version, '"v1"');
  assert.strictEqual(put1Body.profile.rut, '16.789.012-1');

  // 4. PUT Actualización con If-Match "v1" -> Éxito versión "v2"
  const put2 = await handleApiRequest(
    new Request('http://localhost/api/patient-profile', {
      method: 'PUT',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
        'If-Match': '"v1"'
      },
      body: JSON.stringify({
        name: 'Camila González Soto',
        email: 'camila@gmail.com',
        rut: '16.789.012-1',
        documentType: 'rut',
        consentVersion: 'v1.0'
      })
    }),
    adapter,
    { nowSeconds: now }
  );
  assert.strictEqual(put2.status, 200);
  const put2Body = await put2.json() as any;
  assert.strictEqual(put2Body.version, '"v2"');
  assert.strictEqual(put2Body.profile.name, 'Camila González Soto');

  db.close();
});

test('API-03 / S09: Disponibilidad, Reserva, Replay, Resolve y Calendar Export', async () => {
  const { db, adapter } = createTestDatabase();
  const now = chileLocalToUtcSeconds(2026, 11, 5, 12, 0);

  // Login paciente
  const loginRes = await handleApiRequest(
    new Request('http://localhost/api/mock-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'reservante@gmail.com', name: 'Reservante' })
    }),
    adapter,
    { nowSeconds: now, isDev: true }
  );
  const loginData = await loginRes.json() as any;
  const cookie = `vsa_session=${loginRes.headers.get('Set-Cookie')!.match(/vsa_session=([^;]+)/)![1]}`;
  const csrfToken = loginData.csrfToken;

  // 1. Consultar disponibilidad para Felipe
  const availRes = await handleApiRequest(
    new Request('http://localhost/api/availability?professionalId=felipe&from=2026-11-06&to=2026-11-07', {
      headers: { Cookie: cookie }
    }),
    adapter,
    { nowSeconds: now }
  );
  assert.strictEqual(availRes.status, 200);
  const availData = await availRes.json() as any;
  assert.strictEqual(availData.slots.length, 11);
  const firstSlotStart = availData.slots[0].startAt;

  // 2. Crear reserva vía POST /api/bookings
  const bookingBody = {
    professionalId: 'felipe',
    startAt: firstSlotStart,
    patient: {
      name: 'Paciente Atendido',
      email: 'atendido@gmail.com',
      rut: '16.789.012-1',
      documentType: 'rut'
    },
    consentVersion: 'v1.0'
  };

  const bookRes = await handleApiRequest(
    new Request('http://localhost/api/bookings', {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
        'Idempotency-Key': 'key_api_book_001'
      },
      body: JSON.stringify(bookingBody)
    }),
    adapter,
    { nowSeconds: now }
  );
  assert.strictEqual(bookRes.status, 201);
  const bookData = await bookRes.json() as any;
  const bookingId = bookData.result.resourceId;
  assert.strictEqual(bookData.command.status, 'committed');

  // 3. Replay con la misma clave e Idempotency-Key -> 200 con cabecera Idempotent-Replay
  const replayRes = await handleApiRequest(
    new Request('http://localhost/api/bookings', {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
        'Idempotency-Key': 'key_api_book_001'
      },
      body: JSON.stringify(bookingBody)
    }),
    adapter,
    { nowSeconds: now }
  );
  assert.strictEqual(replayRes.status, 200);
  assert.strictEqual(replayRes.headers.get('Idempotent-Replay'), 'true');

  // 4. Resolve de comando propio sin PII
  const resolveRes = await handleApiRequest(
    new Request('http://localhost/api/commands/resolve', {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
      },
      body: JSON.stringify({ idempotencyKey: 'key_api_book_001', method: 'POST', path: '/api/bookings' })
    }),
    adapter,
    { nowSeconds: now }
  );
  assert.strictEqual(resolveRes.status, 200);
  const resolveData = await resolveRes.json() as any;
  assert.strictEqual(resolveData.status, 'committed');
  assert.strictEqual(resolveData.result.resourceId, bookingId);

  // 5. GET Detalle de la reserva
  const detailRes = await handleApiRequest(
    new Request(`http://localhost/api/bookings/${bookingId}`, {
      headers: { Cookie: cookie }
    }),
    adapter,
    { nowSeconds: now }
  );
  assert.strictEqual(detailRes.status, 200);
  const detailData = await detailRes.json() as any;
  assert.strictEqual(detailData.booking.patient.name, 'Paciente Atendido');

  // 6. GET Calendar Export
  const calRes = await handleApiRequest(
    new Request(`http://localhost/api/bookings/${bookingId}/calendar`, {
      headers: { Cookie: cookie }
    }),
    adapter,
    { nowSeconds: now }
  );
  assert.strictEqual(calRes.status, 200);
  const calData = await calRes.json() as any;
  assert.ok(calData.googleUrl.includes('calendar.google.com'));
  assert.strictEqual(calData.googleUrl.includes('16.789.012-1'), false, 'Cero RUT en URL de calendario');

  db.close();
});

test('API-04 / S09: Control de acceso y operaciones de Equipo (S05)', async () => {
  const { db, adapter } = createTestDatabase();
  const now = chileLocalToUtcSeconds(2026, 11, 5, 12, 0);

  // 1. Paciente intenta acceder a /api/team/schedule -> 403 Forbidden
  const patLogin = await handleApiRequest(
    new Request('http://localhost/api/mock-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'pat@gmail.com', name: 'Paciente', role: 'patient' })
    }),
    adapter,
    { nowSeconds: now, isDev: true }
  );
  const patCookie = `vsa_session=${patLogin.headers.get('Set-Cookie')!.match(/vsa_session=([^;]+)/)![1]}`;

  const patTeamReq = await handleApiRequest(
    new Request('http://localhost/api/team/schedule?professionalId=felipe&from=2026-11-06&to=2026-11-07', {
      headers: { Cookie: patCookie }
    }),
    adapter,
    { nowSeconds: now }
  );
  assert.strictEqual(patTeamReq.status, 403);

  // 2. Iniciar sesión como Equipo
  const teamLogin = await handleApiRequest(
    new Request('http://localhost/api/mock-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'team' })
    }),
    adapter,
    { nowSeconds: now, isDev: true }
  );
  const teamData = await teamLogin.json() as any;
  const teamCookie = `vsa_session=${teamLogin.headers.get('Set-Cookie')!.match(/vsa_session=([^;]+)/)![1]}`;
  const teamCsrf = teamData.csrfToken;

  // 3. Equipo consulta agenda de Felipe
  const teamScheduleRes = await handleApiRequest(
    new Request('http://localhost/api/team/schedule?professionalId=felipe&from=2026-11-06&to=2026-11-07', {
      headers: { Cookie: teamCookie }
    }),
    adapter,
    { nowSeconds: now }
  );
  assert.strictEqual(teamScheduleRes.status, 200);

  // 4. Equipo crea un bloqueo administrativo de 15:00 a 16:00
  const slot15Utc = new Date(chileLocalToUtcSeconds(2026, 11, 6, 15, 0) * 1000).toISOString();
  const slot16Utc = new Date(chileLocalToUtcSeconds(2026, 11, 6, 16, 0) * 1000).toISOString();

  const blockRes = await handleApiRequest(
    new Request('http://localhost/api/team/blocks', {
      method: 'POST',
      headers: {
        Cookie: teamCookie,
        'Content-Type': 'application/json',
        'X-CSRF-Token': teamCsrf,
        'Idempotency-Key': 'key_block_team_001'
      },
      body: JSON.stringify({
        professionalId: 'felipe',
        startAt: slot15Utc,
        endAt: slot16Utc
      })
    }),
    adapter,
    { nowSeconds: now }
  );
  assert.strictEqual(blockRes.status, 201);
  const blockData = await blockRes.json() as any;
  const blockId = blockData.result.resourceId;

  // 5. Equipo retira el bloqueo con DELETE /api/team/blocks/:id e If-Match
  const deleteBlockRes = await handleApiRequest(
    new Request(`http://localhost/api/team/blocks/${blockId}`, {
      method: 'DELETE',
      headers: {
        Cookie: teamCookie,
        'X-CSRF-Token': teamCsrf,
        'If-Match': '"v1"'
      }
    }),
    adapter,
    { nowSeconds: now }
  );
  assert.strictEqual(deleteBlockRes.status, 200);

  db.close();
});

test('API-ATTENDANCE: Endpoint POST /api/team/bookings/:id/attendance y autorización de roles', async () => {
  const { db, adapter } = createTestDatabase();
  const now = chileLocalToUtcSeconds(2026, 11, 5, 12, 0);

  // 1. Iniciar sesión como Paciente
  const patLoginRes = await handleApiRequest(
    new Request('http://localhost/api/mock-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'paciente.att@gmail.com', name: 'Paciente Asistencia', role: 'patient' })
    }),
    adapter,
    { nowSeconds: now, isDev: true }
  );
  const patCookie = patLoginRes.headers.get('Set-Cookie')!;
  const patSession = await patLoginRes.json() as any;

  // 2. Iniciar sesión como Equipo
  const teamLoginRes = await handleApiRequest(
    new Request('http://localhost/api/mock-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'centrovida.sanaaustral@gmail.com', name: 'Admin', role: 'admin' })
    }),
    adapter,
    { nowSeconds: now, isDev: true }
  );
  const teamCookie = teamLoginRes.headers.get('Set-Cookie')!;
  const teamSession = await teamLoginRes.json() as any;

  // 3. Paciente crea una reserva
  const slotUtc = new Date(chileLocalToUtcSeconds(2026, 11, 6, 10, 0) * 1000).toISOString();
  const bkgRes = await handleApiRequest(
    new Request('http://localhost/api/bookings', {
      method: 'POST',
      headers: {
        Cookie: patCookie,
        'Content-Type': 'application/json',
        'X-CSRF-Token': patSession.csrfToken,
        'Idempotency-Key': 'key_att_api_bkg_1'
      },
      body: JSON.stringify({
        professionalId: 'felipe',
        startAt: slotUtc,
        patient: {
          name: 'Paciente Test',
          email: 'paciente.att@gmail.com',
          rut: '12.345.678-5',
          documentType: 'rut',
          phone: '+56911223344'
        },
        consentVersion: 'v1.0'
      })
    }),
    adapter,
    { nowSeconds: now }
  );
  assert.strictEqual(bkgRes.status, 201);
  const bkgData = await bkgRes.json() as any;
  const bookingId = bkgData.result.resourceId;

  // 4. Intento sin autenticación -> 401
  const noAuthRes = await handleApiRequest(
    new Request(`http://localhost/api/team/bookings/${bookingId}/attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendanceStatus: 'attended' })
    }),
    adapter,
    { nowSeconds: now }
  );
  assert.strictEqual(noAuthRes.status, 401);

  // 5. Intento con cuenta de paciente común -> 403
  const patAuthRes = await handleApiRequest(
    new Request(`http://localhost/api/team/bookings/${bookingId}/attendance`, {
      method: 'POST',
      headers: {
        Cookie: patCookie,
        'Content-Type': 'application/json',
        'X-CSRF-Token': patSession.csrfToken
      },
      body: JSON.stringify({ attendanceStatus: 'attended' })
    }),
    adapter,
    { nowSeconds: now }
  );
  assert.strictEqual(patAuthRes.status, 403);

  // 6. Intento con equipo pero sin CSRF -> 403
  const noCsrfRes = await handleApiRequest(
    new Request(`http://localhost/api/team/bookings/${bookingId}/attendance`, {
      method: 'POST',
      headers: {
        Cookie: teamCookie,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ attendanceStatus: 'attended' })
    }),
    adapter,
    { nowSeconds: now }
  );
  assert.strictEqual(noCsrfRes.status, 403);

  // 7. Intento válido con equipo y CSRF -> cambiar a 'no_show'
  const validRes = await handleApiRequest(
    new Request(`http://localhost/api/team/bookings/${bookingId}/attendance`, {
      method: 'POST',
      headers: {
        Cookie: teamCookie,
        'Content-Type': 'application/json',
        'X-CSRF-Token': teamSession.csrfToken
      },
      body: JSON.stringify({ attendanceStatus: 'no_show' })
    }),
    adapter,
    { nowSeconds: now + 3600 }
  );
  assert.strictEqual(validRes.status, 200);
  const validData = await validRes.json() as any;
  assert.strictEqual(validData.ok, true);
  assert.strictEqual(validData.bookingId, bookingId);
  assert.strictEqual(validData.attendanceStatus, 'no_show');

  // 8. Verificar que getTeamSchedule ahora reporte 'no_show'
  const scheduleRes = await handleApiRequest(
    new Request('http://localhost/api/team/schedule?professionalId=felipe&from=2026-11-06&to=2026-11-07', {
      headers: { Cookie: teamCookie }
    }),
    adapter,
    { nowSeconds: now }
  );
  assert.strictEqual(scheduleRes.status, 200);
  const scheduleData = await scheduleRes.json() as any;
  const entry = scheduleData.entries.find((e: any) => e.id === bookingId);
  assert.strictEqual(entry?.attendanceStatus, 'no_show');

  db.close();
});
