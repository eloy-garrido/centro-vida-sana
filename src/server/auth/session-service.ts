/**
 * Centro Vida Sana Austral — Servicio de Sesiones y Membresías
 * Conforme a S01 (identidad y roles), S05 (panel de equipo) y D03/D08.
 */

import { generateRandomString, sha256Hex } from './crypto.ts';
import type { DatabaseAdapter } from '../db/adapter.ts';
import type { SessionResponse, UserSession } from '../../lib/agendamiento/types.ts';

export const SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 horas absolutas (D08)
export const OAUTH_ATTEMPT_TTL_SECONDS = 10 * 60; // 10 minutos para completar login

export interface ValidatedSessionData {
  user: UserSession;
  capabilities: {
    teamAgenda: boolean;
  };
  csrfToken: string;
}

/**
 * Genera un token CSRF seguro derivado determinísticamente del token de sesión.
 */
export async function deriveCsrfToken(rawSessionToken: string): Promise<string> {
  return sha256Hex(`${rawSessionToken}:vsa_csrf_secret`);
}

/**
 * Registra un intento de login OAuth con PKCE y estado aleatorio.
 */
export async function createOAuthAttempt(
  db: DatabaseAdapter,
  params: {
    returnTo: string;
    codeVerifier: string;
    nonce: string;
    ttlSeconds?: number;
  }
): Promise<{ state: string; nonce: string; codeVerifier: string; expiresAt: number }> {
  const state = generateRandomString(32);
  const stateHash = await sha256Hex(state);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + (params.ttlSeconds ?? OAUTH_ATTEMPT_TTL_SECONDS);

  await db.run(
    `INSERT INTO oauth_attempts (
      state_hash, code_verifier, nonce, return_to, expires_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    stateHash,
    params.codeVerifier,
    params.nonce,
    params.returnTo,
    expiresAt,
    now
  );

  return {
    state,
    nonce: params.nonce,
    codeVerifier: params.codeVerifier,
    expiresAt
  };
}

/**
 * Consume y elimina un intento OAuth de uso único para evitar ataques de repetición (replay).
 */
export async function consumeOAuthAttempt(
  db: DatabaseAdapter,
  state: string
): Promise<{ codeVerifier: string; nonce: string; returnTo: string } | null> {
  const stateHash = await sha256Hex(state);
  const now = Math.floor(Date.now() / 1000);

  const attempt = await db.first<{
    code_verifier: string;
    nonce: string;
    return_to: string;
  }>(
    `SELECT code_verifier, nonce, return_to
     FROM oauth_attempts
     WHERE state_hash = ? AND expires_at > ?`,
    stateHash,
    now
  );

  // Consumo inmediato: se borra de la DB independientemente de si era válido o no
  await db.run('DELETE FROM oauth_attempts WHERE state_hash = ?', stateHash);

  if (!attempt) {
    return null;
  }

  return {
    codeVerifier: attempt.code_verifier,
    nonce: attempt.nonce,
    returnTo: attempt.return_to
  };
}

/**
 * Busca un usuario por su google_sub único o lo crea atómicamente si no existe.
 */
export async function findOrCreateUser(
  db: DatabaseAdapter,
  params: {
    googleSub: string;
    name: string;
    email: string;
  }
): Promise<UserSession> {
  const now = Math.floor(Date.now() / 1000);

  const existing = await db.first<{ id: string; name: string; email: string }>(
    'SELECT id, name, email FROM users WHERE google_sub = ?',
    params.googleSub
  );

  if (existing) {
    // Si cambió su nombre o email en Google, actualizamos el registro
    await db.run(
      'UPDATE users SET name = ?, email = ?, updated_at = ? WHERE id = ?',
      params.name,
      params.email,
      now,
      existing.id
    );

    // Enlazar sub si el correo pertenece a team_members y aún no tenía google_sub asignado
    await db.run(
      'UPDATE team_members SET google_sub = ? WHERE email = ? AND google_sub IS NULL',
      params.googleSub,
      params.email
    );

    return {
      id: existing.id,
      name: params.name,
      email: params.email
    };
  }

  // Crear nuevo usuario
  const newId = `usr_${generateRandomString(12)}`;
  await db.run(
    `INSERT INTO users (id, google_sub, name, email, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    newId,
    params.googleSub,
    params.name,
    params.email,
    now,
    now
  );

  // Vincular a team_members si el correo está autorizado
  await db.run(
    'UPDATE team_members SET google_sub = ? WHERE email = ? AND google_sub IS NULL',
    params.googleSub,
    params.email
  );

  return {
    id: newId,
    name: params.name,
    email: params.email
  };
}

/**
 * Crea una nueva sesión HttpOnly con duración absoluta de 8 horas y hash en D1.
 */
export async function createSession(
  db: DatabaseAdapter,
  userId: string,
  ttlSeconds = SESSION_TTL_SECONDS
): Promise<{ rawToken: string; csrfToken: string; expiresAt: number }> {
  const rawToken = generateRandomString(32);
  const tokenHash = await sha256Hex(rawToken);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + ttlSeconds;

  await db.run(
    `INSERT INTO sessions (token_hash, user_id, expires_at, revoked_at, created_at)
     VALUES (?, ?, ?, NULL, ?)`,
    tokenHash,
    userId,
    expiresAt,
    now
  );

  const csrfToken = await deriveCsrfToken(rawToken);

  return {
    rawToken,
    csrfToken,
    expiresAt
  };
}

/**
 * Valida un token de sesión contra la base de datos D1.
 * Si la sesión existe, no está revocada y no expiró, retorna los datos del usuario y sus roles.
 */
export async function validateSession(
  db: DatabaseAdapter,
  rawToken: string
): Promise<ValidatedSessionData | null> {
  if (!rawToken || typeof rawToken !== 'string') {
    return null;
  }

  const tokenHash = await sha256Hex(rawToken);
  const now = Math.floor(Date.now() / 1000);

  const sessionRow = await db.first<{
    user_id: string;
    name: string;
    email: string;
  }>(
    `SELECT s.user_id, u.name, u.email
     FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.token_hash = ?
       AND s.expires_at > ?
       AND s.revoked_at IS NULL`,
    tokenHash,
    now
  );

  if (!sessionRow) {
    return null;
  }

  // Consultar membresía activa del equipo en cada petición (S01 L26)
  // Si el usuario fue revocado en team_members, pierde permisos inmediatamente sin nuevo login
  const member = await db.first<{ is_active: number }>(
    'SELECT is_active FROM team_members WHERE email = ? AND is_active = 1',
    sessionRow.email
  );

  const isTeam = member !== null && member.is_active === 1;
  const csrfToken = await deriveCsrfToken(rawToken);

  return {
    user: {
      id: sessionRow.user_id,
      name: sessionRow.name,
      email: sessionRow.email
    },
    capabilities: {
      teamAgenda: isTeam
    },
    csrfToken
  };
}

/**
 * Revoca inmediatamente la sesión del usuario (Logout POST).
 */
export async function revokeSession(
  db: DatabaseAdapter,
  rawToken: string
): Promise<boolean> {
  if (!rawToken) return false;
  const tokenHash = await sha256Hex(rawToken);
  const now = Math.floor(Date.now() / 1000);

  const result = await db.run(
    'UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL',
    now,
    tokenHash
  );

  return result.changes > 0;
}
