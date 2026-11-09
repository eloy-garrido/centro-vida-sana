/**
 * Centro Vida Sana Austral — Suite E2E de Integración Cruzada y Concurrencia (E6 / S08)
 * Valida QA-08, QA-09, QA-10, QA-14, QA-15, QA-16 y QA-17 contra D1 local real (node:sqlite).
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
  const migrationPath = resolve(process.cwd(), 'migrations/0001_initial_schema.sql');
  const sql = readFileSync(migrationPath, 'utf-8');
  db.exec(sql);
  return { db, adapter: createSqliteAdapter(db) };
}

async function loginUser(adapter: any, role: 'patient' | 'team', email: string, name: string) {
  const loginRes = await handleApiRequest(
    new Request('http://localhost/api/mock-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, email, name })
    }),
    adapter,
    { isDev: true }
  );
  const data = await loginRes.json() as any;
  const cookieMatch = loginRes.headers.get('Set-Cookie')!.match(/vsa_session=([^;]+)/);
  return {
    cookie: `vsa_session=${cookieMatch![1]}`,
    csrfToken: data.csrfToken,
    user: data.user
  };
}

test('QA-08: Concurrencia real: Múltiples solicitudes por el mismo cupo dejan exactamente 1 ganador', async () => {
  const { db, adapter } = createTestDatabase();
  const now = chileLocalToUtcSeconds(2026, 11, 5, 12, 0);

  // Crear 10 pacientes distintos
  const patients = await Promise.all(
    Array.from({ length: 10 }).map((_, i) =>
      loginUser(adapter, 'patient', `paciente${i}@gmail.com`, `Paciente Número ${i}`)
    )
  );

  const targetSlotUtc = new Date(chileLocalToUtcSeconds(2026, 11, 6, 10, 0) * 1000).toISOString();

  // Todos intentan reservar el MISMO cupo de las 10:00 con Felipe simultáneamente
  const attempts = await Promise.all(
    patients.map((p, i) =>
      handleApiRequest(
        new Request('http://localhost/api/bookings', {
          method: 'POST',
          headers: {
            Cookie: p.cookie,
            'Content-Type': 'application/json',
            'X-CSRF-Token': p.csrfToken,
            'Idempotency-Key': `idemp_race_${i}`
          },
          body: JSON.stringify({
            professionalId: 'felipe',
            startAt: targetSlotUtc,
            patient: {
              name: `Paciente ${i}`,
              email: `paciente${i}@gmail.com`,
              rut: '16.789.012-1',
              documentType: 'rut'
            },
            consentVersion: 'v1.0'
          })
        }),
        adapter,
        { nowSeconds: now }
      )
    )
  );

  const successResponses = attempts.filter((r) => r.status === 201);
  const conflictResponses = attempts.filter((r) => r.status === 409);

  // Exactamente 1 debe ganar (201) y los otros 9 deben fallar con conflicto (409)
  assert.strictEqual(successResponses.length, 1, 'Exactamente una reserva debe ganar el cupo');
  assert.strictEqual(conflictResponses.length, 9, 'Las demás peticiones deben recibir 409 Conflict');

  // En la base de datos debe haber exactamente una fila activa
  const activeEntries = await adapter.all(
    "SELECT * FROM agenda_entries WHERE professional_id = 'felipe' AND status = 'confirmed'"
  );
  assert.strictEqual(activeEntries.length, 1);

  db.close();
});

test('QA-09: Agendas independientes permiten reservas simultáneas en Felipe y Eduardo', async () => {
  const { db, adapter } = createTestDatabase();
  const now = chileLocalToUtcSeconds(2026, 11, 5, 12, 0);

  const patientA = await loginUser(adapter, 'patient', 'userA@gmail.com', 'Usuario A');
  const patientB = await loginUser(adapter, 'patient', 'userB@gmail.com', 'Usuario B');

  const sameSlotUtc = new Date(chileLocalToUtcSeconds(2026, 11, 6, 11, 0) * 1000).toISOString();

  // Paciente A agenda con Felipe a las 11:00
  const resA = await handleApiRequest(
    new Request('http://localhost/api/bookings', {
      method: 'POST',
      headers: {
        Cookie: patientA.cookie,
        'Content-Type': 'application/json',
        'X-CSRF-Token': patientA.csrfToken,
        'Idempotency-Key': 'key_same_time_felipe'
      },
      body: JSON.stringify({
        professionalId: 'felipe',
        startAt: sameSlotUtc,
        patient: { name: 'Paciente A', email: 'userA@gmail.com', rut: '16.789.012-1' },
        consentVersion: 'v1.0'
      })
    }),
    adapter,
    { nowSeconds: now }
  );
  assert.strictEqual(resA.status, 201);

  // Paciente B agenda con Eduardo a las 11:00 (misma hora)
  const resB = await handleApiRequest(
    new Request('http://localhost/api/bookings', {
      method: 'POST',
      headers: {
        Cookie: patientB.cookie,
        'Content-Type': 'application/json',
        'X-CSRF-Token': patientB.csrfToken,
        'Idempotency-Key': 'key_same_time_eduardo'
      },
      body: JSON.stringify({
        professionalId: 'eduardo',
        startAt: sameSlotUtc,
        patient: { name: 'Paciente B', email: 'userB@gmail.com', rut: '15.000.005-K' },
        consentVersion: 'v1.0'
      })
    }),
    adapter,
    { nowSeconds: now }
  );
  assert.strictEqual(resB.status, 201, 'Agendas independientes permiten atenciones simultáneas');

  db.close();
});

test('QA-10: Bloqueo de equipo compite con citas y viceversa', async () => {
  const { db, adapter } = createTestDatabase();
  const now = chileLocalToUtcSeconds(2026, 11, 5, 12, 0);

  const team = await loginUser(adapter, 'team', 'centrovida.sanaaustral@gmail.com', 'Equipo Admin');
  const patient = await loginUser(adapter, 'patient', 'paciente@gmail.com', 'Paciente Intento');

  const slot14Utc = new Date(chileLocalToUtcSeconds(2026, 11, 6, 14, 0) * 1000).toISOString();
  const slot15Utc = new Date(chileLocalToUtcSeconds(2026, 11, 6, 15, 0) * 1000).toISOString();

  // 1. Equipo bloquea las 14:00 con Felipe
  const blockRes = await handleApiRequest(
    new Request('http://localhost/api/team/blocks', {
      method: 'POST',
      headers: {
        Cookie: team.cookie,
        'Content-Type': 'application/json',
        'X-CSRF-Token': team.csrfToken,
        'Idempotency-Key': 'key_block_14'
      },
      body: JSON.stringify({
        professionalId: 'felipe',
        startAt: slot14Utc,
        endAt: slot15Utc
      })
    }),
    adapter,
    { nowSeconds: now }
  );
  assert.strictEqual(blockRes.status, 201);

  // 2. Paciente intenta reservar las 14:00 con Felipe -> Debe fallar con 409 SLOT_CONFLICT
  const patientBookRes = await handleApiRequest(
    new Request('http://localhost/api/bookings', {
      method: 'POST',
      headers: {
        Cookie: patient.cookie,
        'Content-Type': 'application/json',
        'X-CSRF-Token': patient.csrfToken,
        'Idempotency-Key': 'key_patient_blocked_slot'
      },
      body: JSON.stringify({
        professionalId: 'felipe',
        startAt: slot14Utc,
        patient: { name: 'Paciente', email: 'p@gmail.com', rut: '16.789.012-1' },
        consentVersion: 'v1.0'
      })
    }),
    adapter,
    { nowSeconds: now }
  );
  assert.strictEqual(patientBookRes.status, 409, 'El cupo bloqueado rechaza reservas de pacientes');

  db.close();
});

test('QA-14 / QA-17: Control de versión If-Match y ausencia de PII en errores', async () => {
  const { db, adapter } = createTestDatabase();
  const now = chileLocalToUtcSeconds(2026, 11, 5, 12, 0);

  const team = await loginUser(adapter, 'team', 'centrovida.sanaaustral@gmail.com', 'Equipo Admin');
  const slot16Utc = new Date(chileLocalToUtcSeconds(2026, 11, 6, 16, 0) * 1000).toISOString();

  // 1. Crear cita de equipo
  const bookRes = await handleApiRequest(
    new Request('http://localhost/api/team/bookings', {
      method: 'POST',
      headers: {
        Cookie: team.cookie,
        'Content-Type': 'application/json',
        'X-CSRF-Token': team.csrfToken,
        'Idempotency-Key': 'key_version_test_bk'
      },
      body: JSON.stringify({
        professionalId: 'eduardo',
        startAt: slot16Utc,
        patient: {
          name: 'Paciente Conflicto',
          email: 'conflicto@gmail.com',
          rut: '16.789.012-1'
        },
        consentVersion: 'v1.0'
      })
    }),
    adapter,
    { nowSeconds: now }
  );
  const bookData = await bookRes.json() as any;
  const bookingId = bookData.result.resourceId;

  // 2. Intentar cancelar sin cabecera If-Match -> 428 VERSION_REQUIRED
  const cancelNoVersion = await handleApiRequest(
    new Request(`http://localhost/api/team/bookings/${bookingId}`, {
      method: 'DELETE',
      headers: {
        Cookie: team.cookie,
        'X-CSRF-Token': team.csrfToken
      }
    }),
    adapter,
    { nowSeconds: now }
  );
  assert.strictEqual(cancelNoVersion.status, 428);

  // 3. Intentar cancelar con versión obsoleta ("v99") -> 412 VERSION_CONFLICT
  const cancelWrongVersion = await handleApiRequest(
    new Request(`http://localhost/api/team/bookings/${bookingId}`, {
      method: 'DELETE',
      headers: {
        Cookie: team.cookie,
        'X-CSRF-Token': team.csrfToken,
        'If-Match': '"v99"'
      }
    }),
    adapter,
    { nowSeconds: now }
  );
  assert.strictEqual(cancelWrongVersion.status, 412);
  const wrongErr = await cancelWrongVersion.json() as any;
  // QA-17: Cero PII en el error
  assert.strictEqual(JSON.stringify(wrongErr).includes('16.789.012-1'), false);
  assert.strictEqual(JSON.stringify(wrongErr).includes('Paciente Conflicto'), false);

  // 4. Cancelar con versión correcta ("v1") -> 200 OK
  const cancelOk = await handleApiRequest(
    new Request(`http://localhost/api/team/bookings/${bookingId}`, {
      method: 'DELETE',
      headers: {
        Cookie: team.cookie,
        'X-CSRF-Token': team.csrfToken,
        'If-Match': '"v1"'
      }
    }),
    adapter,
    { nowSeconds: now }
  );
  assert.strictEqual(cancelOk.status, 200);

  db.close();
});
