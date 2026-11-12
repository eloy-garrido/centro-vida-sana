/**
 * Centro Vida Sana Austral — Tests de Búsqueda de Pacientes e Historial Clínico (S05 / S09)
 * Valida la búsqueda por nombre, email o RUT, cálculo de métricas de asistencia y autorización.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { createSqliteAdapter } from '../../src/server/db/adapter.ts';
import { handleApiRequest } from '../../src/server/router.ts';
import { chileLocalToUtcSeconds } from '../../src/server/agenda/policy.ts';
import { searchPatientAppointments } from '../../src/server/agenda/team.ts';
import { encryptPiiJson, setPiiEncryptionSecret } from '../../src/server/auth/crypto.ts';

function createTestDatabase() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  const migrationFiles = ['0001_initial_schema.sql', '0002_attendance_tracking.sql'];
  for (const file of migrationFiles) {
    const migrationPath = resolve(process.cwd(), 'migrations', file);
    const sql = readFileSync(migrationPath, 'utf-8');
    db.exec(sql);
  }
  return { db, adapter: createSqliteAdapter(db) };
}

async function insertAppointment(adapter: any, entry: {
  id: string;
  professionalId: 'felipe' | 'eduardo';
  startSec: number;
  status?: 'confirmed' | 'cancelled';
  attendanceStatus?: 'attended' | 'no_show' | 'pending';
  patient: {
    name: string;
    email: string;
    rut: string;
    phone?: string;
  };
}) {
  const encryptedSnapshot = await encryptPiiJson(entry.patient);
  const endSec = entry.startSec + 3600;
  await adapter.run(
    `INSERT INTO agenda_entries (
      id, kind, professional_id, start_at, end_at, status, version,
      booked_by_user_id, encrypted_snapshot, attendance_status, created_at, updated_at
    ) VALUES (?, 'appointment', ?, ?, ?, ?, 'v1', NULL, ?, ?, ?, ?)`,
    entry.id,
    entry.professionalId,
    entry.startSec,
    endSec,
    entry.status || 'confirmed',
    encryptedSnapshot,
    entry.attendanceStatus || 'pending',
    entry.startSec - 86400,
    entry.startSec - 86400
  );
}

test('SEARCH-01: searchPatientAppointments busca por nombre con acentos y mayúsculas', async () => {
  const { adapter } = createTestDatabase();
  const now = chileLocalToUtcSeconds(2026, 5, 25, 12, 0);

  // Insertar 3 citas para María José González y 1 para otro paciente
  await insertAppointment(adapter, {
    id: 'apt-1',
    professionalId: 'felipe',
    startSec: chileLocalToUtcSeconds(2026, 5, 10, 10, 0),
    status: 'confirmed',
    attendanceStatus: 'attended',
    patient: {
      name: 'María José González',
      email: 'maria.gonzalez@gmail.com',
      rut: '12.345.678-5',
      phone: '+56 9 1234 5678'
    }
  });

  await insertAppointment(adapter, {
    id: 'apt-2',
    professionalId: 'eduardo',
    startSec: chileLocalToUtcSeconds(2026, 5, 15, 16, 0),
    status: 'confirmed',
    attendanceStatus: 'no_show',
    patient: {
      name: 'María José González',
      email: 'maria.gonzalez@gmail.com',
      rut: '12.345.678-5',
      phone: '+56 9 1234 5678'
    }
  });

  await insertAppointment(adapter, {
    id: 'apt-3',
    professionalId: 'felipe',
    startSec: chileLocalToUtcSeconds(2026, 6, 1, 11, 0), // Cita futura respecto a now
    status: 'confirmed',
    attendanceStatus: 'pending',
    patient: {
      name: 'María José González',
      email: 'maria.gonzalez@gmail.com',
      rut: '12.345.678-5',
      phone: '+56 9 1234 5678'
    }
  });

  await insertAppointment(adapter, {
    id: 'apt-4',
    professionalId: 'felipe',
    startSec: chileLocalToUtcSeconds(2026, 5, 12, 11, 0),
    status: 'confirmed',
    attendanceStatus: 'attended',
    patient: {
      name: 'Carlos Muñoz',
      email: 'carlos.munoz@outlook.com',
      rut: '9.876.543-2',
      phone: '+56 9 8765 4321'
    }
  });

  // Búsqueda sin tilde ("maria") debe coincidir con "María José"
  const resSinTilde = await searchPatientAppointments(adapter, 'maria', now);
  assert.strictEqual(resSinTilde.totalMatches, 3);
  assert.strictEqual(resSinTilde.stats.totalAppointments, 3);
  assert.strictEqual(resSinTilde.stats.attendedCount, 1);
  assert.strictEqual(resSinTilde.stats.noShowCount, 1);
  assert.strictEqual(resSinTilde.stats.upcomingCount, 1);
  assert.strictEqual(resSinTilde.results[0].patient.name, 'María José González');

  // Búsqueda con tilde ("José")
  const resConTilde = await searchPatientAppointments(adapter, 'José', now);
  assert.strictEqual(resConTilde.totalMatches, 3);
});

test('SEARCH-02: searchPatientAppointments busca por RUT (formateado y sin formato)', async () => {
  const { adapter } = createTestDatabase();
  const now = chileLocalToUtcSeconds(2026, 5, 25, 12, 0);

  await insertAppointment(adapter, {
    id: 'apt-rut-1',
    professionalId: 'eduardo',
    startSec: chileLocalToUtcSeconds(2026, 5, 20, 10, 0),
    status: 'confirmed',
    attendanceStatus: 'attended',
    patient: {
      name: 'Ana Silva',
      email: 'ana.silva@gmail.com',
      rut: '18.765.432-1',
      phone: '+56 9 9999 8888'
    }
  });

  // 1. Búsqueda con RUT sin puntos ni guion: "187654321"
  const resSinPuntos = await searchPatientAppointments(adapter, '187654321', now);
  assert.strictEqual(resSinPuntos.totalMatches, 1);
  assert.strictEqual(resSinPuntos.results[0].patient.rut, '18.765.432-1');

  // 2. Búsqueda con RUT con formato exacto: "18.765.432-1"
  const resConFormato = await searchPatientAppointments(adapter, '18.765.432-1', now);
  assert.strictEqual(resConFormato.totalMatches, 1);
  assert.strictEqual(resConFormato.results[0].patient.name, 'Ana Silva');
});

test('SEARCH-03: searchPatientAppointments busca por correo electrónico', async () => {
  const { adapter } = createTestDatabase();
  const now = chileLocalToUtcSeconds(2026, 5, 25, 12, 0);

  await insertAppointment(adapter, {
    id: 'apt-mail-1',
    professionalId: 'felipe',
    startSec: chileLocalToUtcSeconds(2026, 5, 18, 15, 0),
    status: 'confirmed',
    attendanceStatus: 'attended',
    patient: {
      name: 'Pedro Pascal',
      email: 'pedro.pascal@hollywood.cl',
      rut: '11.222.333-4',
      phone: '+56 9 7777 6666'
    }
  });

  const res = await searchPatientAppointments(adapter, 'hollywood.cl', now);
  assert.strictEqual(res.totalMatches, 1);
  assert.strictEqual(res.results[0].patient.name, 'Pedro Pascal');
});

test('SEARCH-04: Endpoint POST /api/team/patients/search autorización y respuesta', async () => {
  const { adapter } = createTestDatabase();
  const now = chileLocalToUtcSeconds(2026, 5, 25, 12, 0);

  // 1. Iniciar sesión como equipo
  const loginReq = new Request('http://localhost/api/mock-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'team' })
  });
  const loginRes = await handleApiRequest(loginReq, adapter, { nowSeconds: now, isDev: true });
  assert.strictEqual(loginRes.status, 200);
  const loginBody = await loginRes.json() as any;
  const cookieMatch = (loginRes.headers.get('Set-Cookie') || '').match(/vsa_session=([^;]+)/);
  const teamCookie = `vsa_session=${cookieMatch![1]}`;
  const csrfToken = loginBody.csrfToken;

  // Insertar una cita de prueba
  await insertAppointment(adapter, {
    id: 'apt-api-1',
    professionalId: 'felipe',
    startSec: chileLocalToUtcSeconds(2026, 5, 20, 10, 0),
    status: 'confirmed',
    attendanceStatus: 'attended',
    patient: {
      name: 'Constanza Morales',
      email: 'coni.morales@gmail.com',
      rut: '16.543.210-9'
    }
  });

  // 2. Consulta anónima rechazada con 401
  const anonSearchReq = new Request('http://localhost/api/team/patients/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'Constanza' })
  });
  const anonRes = await handleApiRequest(anonSearchReq, adapter, { nowSeconds: now });
  assert.strictEqual(anonRes.status, 401);

  // 3. Consulta de equipo con CSRF exitosa (200)
  const teamSearchReq = new Request('http://localhost/api/team/patients/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: teamCookie,
      'X-CSRF-Token': csrfToken
    },
    body: JSON.stringify({ query: 'Constanza' })
  });
  const teamRes = await handleApiRequest(teamSearchReq, adapter, { nowSeconds: now });
  assert.strictEqual(teamRes.status, 200);
  const teamBody = await teamRes.json() as any;
  assert.strictEqual(teamBody.totalMatches, 1);
  assert.strictEqual(teamBody.results[0].patient.name, 'Constanza Morales');
  assert.strictEqual(teamBody.stats.totalAppointments, 1);
});
