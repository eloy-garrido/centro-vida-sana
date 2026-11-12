/**
 * Centro Vida Sana Austral — Tests del Motor de Agenda, Idempotencia y Disponibilidad
 * Conforme a S03 (motor transaccional), S09 (contratos e idempotencia) y Decisiones D01, D02, D04.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { createSqliteAdapter } from '../../src/server/db/adapter.ts';
import {
  getChileTime,
  isValidWorkingSlot,
  isWithinPatientBookingWindow,
  isWithinTeamBookingWindow,
  chileLocalToUtcSeconds
} from '../../src/server/agenda/policy.ts';

import { getAvailableSlots } from '../../src/server/agenda/availability.ts';

import {
  executeCreateBookingCommand,
  executeCancelBookingCommand,
  executeCreateBlockCommand,
  resolveCommand,
  ApiCommandError
} from '../../src/server/agenda/commands.ts';

import {
  executeEditTeamBookingCommand,
  executeDeleteBlockCommand,
  getTeamSchedule,
  executeRecordAttendanceCommand
} from '../../src/server/agenda/team.ts';
import { getBookingDetails } from '../../src/server/agenda/details.ts';
import { savePatientProfile, getPatientProfile } from '../../src/server/agenda/profile.ts';
import { setPiiEncryptionSecret, encryptPiiJson, decryptPiiJson } from '../../src/server/auth/crypto.ts';

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

async function insertTestUser(
  adapter: any,
  id: string,
  email: string,
  name = 'Test User'
) {
  await adapter.run(
    `INSERT OR IGNORE INTO users (id, google_sub, name, email, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1730815200, 1730815200)`,
    id,
    `sub_${id}`,
    name,
    email
  );
}

// ============================================================================
// 1. TESTS DE POLÍTICA Y JORNADA EN CHILE (D01 / D02)
// ============================================================================

test('SLOT-01: Política de jornada (L-V 09-21 sin 13, Sáb 09-14, Dom cerrado)', () => {
  // Lunes 10:00 en Chile -> Válido
  const monday10 = chileLocalToUtcSeconds(2026, 11, 9, 10, 0);
  assert.strictEqual(isValidWorkingSlot(monday10), true);

  // Lunes 13:00 en Chile (Pausa de colación) -> Inválido
  const mondayLunch = chileLocalToUtcSeconds(2026, 11, 9, 13, 0);
  assert.strictEqual(isValidWorkingSlot(mondayLunch), false);

  // Sábado 10:00 en Chile -> Válido
  const sat10 = chileLocalToUtcSeconds(2026, 11, 14, 10, 0);
  assert.strictEqual(isValidWorkingSlot(sat10), true);

  // Sábado 15:00 en Chile (Fuera de jornada) -> Inválido
  const sat15 = chileLocalToUtcSeconds(2026, 11, 14, 15, 0);
  assert.strictEqual(isValidWorkingSlot(sat15), false);

  // Domingo en Chile (Cerrado) -> Inválido
  const sun10 = chileLocalToUtcSeconds(2026, 11, 15, 10, 0);
  assert.strictEqual(isValidWorkingSlot(sun10), false);
});

test('SLOT-01 / D02: Ventana de reserva de paciente (D+1 a D+7)', () => {
  // Supongamos que hoy es 2026-11-05 mediodía en Chile
  const nowChile = chileLocalToUtcSeconds(2026, 11, 5, 12, 0);

  // Mismo día (D+0) -> No permitido para pacientes
  const todaySlot = chileLocalToUtcSeconds(2026, 11, 5, 16, 0);
  assert.strictEqual(isWithinPatientBookingWindow(todaySlot, nowChile), false);

  // Mañana (D+1) -> Permitido
  const tomorrowSlot = chileLocalToUtcSeconds(2026, 11, 6, 10, 0);
  assert.strictEqual(isWithinPatientBookingWindow(tomorrowSlot, nowChile), true);

  // En 7 días (D+7) -> Permitido
  const d7Slot = chileLocalToUtcSeconds(2026, 11, 12, 10, 0);
  assert.strictEqual(isWithinPatientBookingWindow(d7Slot, nowChile), true);

  // En 8 días (D+8) -> Fuera de la ventana
  const d8Slot = chileLocalToUtcSeconds(2026, 11, 13, 10, 0);
  assert.strictEqual(isWithinPatientBookingWindow(d8Slot, nowChile), false);
});

// ============================================================================
// 2. TESTS DE DISPONIBILIDAD (S03 / S09)
// ============================================================================

test('SLOT-01 / S03: Disponibilidad descuenta citas activas y no expone PII', async () => {
  const { db, adapter } = createTestDatabase();

  const nowChile = chileLocalToUtcSeconds(2026, 11, 5, 12, 0);
  const fromDate = '2026-11-06'; // Viernes D+1
  const toDate = '2026-11-07';   // Hasta el sábado

  // 1. Consultar disponibilidad inicial para Felipe
  const initial = await getAvailableSlots(adapter, {
    professionalId: 'felipe',
    fromDate,
    toDate,
    nowSeconds: nowChile
  });

  // Viernes tiene 11 slots
  assert.strictEqual(initial.slots.length, 11);
  assert.strictEqual(initial.allSlots?.length, 11);
  assert.ok(initial.allSlots?.every((s) => s.available === true));

  // 2. Insertar una cita activa para Felipe a las 10:00 hora de Chile
  const slot10Sec = chileLocalToUtcSeconds(2026, 11, 6, 10, 0);
  await adapter.run(
    `INSERT INTO agenda_entries (
      id, kind, professional_id, start_at, end_at, status, version, encrypted_snapshot, created_at, updated_at
    ) VALUES ('bkg_busy', 'appointment', 'felipe', ?, ?, 'confirmed', 'v1', '{"patient":"test"}', 1730890000, 1730890000)`,
    slot10Sec,
    slot10Sec + 3600
  );

  // 3. Consultar nuevamente disponibilidad de Felipe: debe tener 10 slots libres (el de las 10:00 ya no está en slots)
  const afterBooking = await getAvailableSlots(adapter, {
    professionalId: 'felipe',
    fromDate,
    toDate,
    nowSeconds: nowChile
  });
  assert.strictEqual(afterBooking.slots.length, 10);

  // allSlots contiene los 11 turnos oficiales del día, señalando el de las 10:00 como available: false
  assert.strictEqual(afterBooking.allSlots?.length, 11);
  const occupiedSlots = afterBooking.allSlots?.filter((s) => s.available === false) || [];
  assert.strictEqual(occupiedSlots.length, 1);
  const slot10Iso = new Date(slot10Sec * 1000).toISOString();
  assert.strictEqual(occupiedSlots[0].startAt, slot10Iso);

  // 4. Consultar disponibilidad de Eduardo: DEBE seguir teniendo 11 slots (agendas independientes)
  const eduardoSlots = await getAvailableSlots(adapter, {
    professionalId: 'eduardo',
    fromDate,
    toDate,
    nowSeconds: nowChile
  });
  assert.strictEqual(eduardoSlots.slots.length, 11, 'Eduardo tiene su propia agenda independiente');

  db.close();
});

// ============================================================================
// 3. TESTS DE COMANDO DE RESERVA E IDEMPOTENCIA (S03 / S09 / P03)
// ============================================================================

test('SLOT-04: Transacción atómica de reserva, idempotencia y replay', async () => {
  const { db, adapter } = createTestDatabase();

  const nowChile = chileLocalToUtcSeconds(2026, 11, 5, 12, 0);
  const slot10Sec = chileLocalToUtcSeconds(2026, 11, 6, 10, 0);
  const startAtIso = new Date(slot10Sec * 1000).toISOString();

  const actor = { id: 'usr_pat_1', email: 'pat1@gmail.com' };
  const idempotencyKey = 'key_unique_test_001';

  await insertTestUser(adapter, actor.id, actor.email, 'Camila Paciente');
  await insertTestUser(adapter, 'usr_pat_2', 'pat2@gmail.com', 'Segundo Paciente');

  const request = {
    professionalId: 'felipe' as const,
    startAt: startAtIso,
    patient: {
      name: 'Camila González',
      email: 'camila@gmail.com',
      rut: '16.789.012-1',
      documentType: 'rut' as const,
      phone: '+56912345678'
    },
    consentVersion: 'v1.0'
  };

  // 1. Primera ejecución: Debe crear la reserva exitosamente
  const res1 = await executeCreateBookingCommand(
    adapter,
    actor,
    idempotencyKey,
    request,
    nowChile
  );

  assert.strictEqual(res1.isReplay, false);
  assert.strictEqual(res1.result.command.status, 'committed');
  assert.strictEqual(res1.result.result.status, 'confirmed');
  assert.strictEqual(res1.result.result.version, '"v1"');

  // 2. Replay con la MISMA clave y el MISMO cuerpo -> Debe responder con el recibo anterior (isReplay = true)
  const resReplay = await executeCreateBookingCommand(
    adapter,
    actor,
    idempotencyKey,
    request,
    nowChile
  );

  assert.strictEqual(resReplay.isReplay, true);
  assert.strictEqual(resReplay.result.result.resourceId, res1.result.result.resourceId);

  // 3. Reuso de la MISMA clave pero con CUERPO DISTINTO -> Debe lanzar IDEMPOTENCY_MISMATCH (409)
  const differentRequest = {
    ...request,
    patient: {
      ...request.patient,
      name: 'Otro Paciente Distinto'
    }
  };

  await assert.rejects(
    async () => {
      await executeCreateBookingCommand(
        adapter,
        actor,
        idempotencyKey,
        differentRequest,
        nowChile
      );
    },
    (err: any) => err instanceof ApiCommandError && err.code === 'IDEMPOTENCY_MISMATCH'
  );

  // 4. Intentar reservar el MISMO cupo con OTRA clave -> Debe fallar con SLOT_CONFLICT (409)
  await assert.rejects(
    async () => {
      await executeCreateBookingCommand(
        adapter,
        { id: 'usr_pat_2', email: 'pat2@gmail.com' },
        'key_another_person_002',
        request,
        nowChile
      );
    },
    (err: any) => err instanceof ApiCommandError && err.code === 'SLOT_CONFLICT'
  );

  db.close();
});

// ============================================================================
// 4. TESTS DE RESOLVE DE COMANDOS (S09 / P03)
// ============================================================================

test('SLOT-04: Endpoint Resolve recupera el recibo sin exponer PII', async () => {
  const { db, adapter } = createTestDatabase();

  const nowChile = chileLocalToUtcSeconds(2026, 11, 5, 12, 0);
  const slot11Sec = chileLocalToUtcSeconds(2026, 11, 6, 11, 0);

  const actor = { id: 'usr_resolve_test', email: 'res@example.com' };
  const idempotencyKey = 'key_resolve_123';

  await insertTestUser(adapter, actor.id, actor.email, 'Usuario Resolve');

  await executeCreateBookingCommand(
    adapter,
    actor,
    idempotencyKey,
    {
      professionalId: 'felipe',
      startAt: new Date(slot11Sec * 1000).toISOString(),
      patient: {
        name: 'Paciente Privado',
        email: 'priv@gmail.com',
        rut: '16.789.012-1',
        documentType: 'rut'
      },
      consentVersion: 'v1.0'
    },
    nowChile
  );

  // 1. Resolve para el dueño del comando
  const resolved = await resolveCommand(
    adapter,
    actor.id,
    idempotencyKey,
    'POST',
    '/api/bookings'
  );

  assert.strictEqual(resolved.status, 'committed');
  if (resolved.status === 'committed') {
    assert.strictEqual(resolved.httpStatus, 201);
    assert.strictEqual(resolved.result.kind, 'appointment');
    assert.strictEqual(resolved.result.version, '"v1"');
    // Verificar que no contenga PII (nombre, email, rut)
    assert.strictEqual((resolved.result as any).patient, undefined);
  }

  // 2. Resolve para otro actor con la misma clave -> Debe devolver not_found (aislamiento)
  const resolvedStranger = await resolveCommand(
    adapter,
    'usr_stranger_999',
    idempotencyKey,
    'POST',
    '/api/bookings'
  );
  assert.strictEqual(resolvedStranger.status, 'not_found');

  db.close();
});

// ============================================================================
// 5. TESTS DE CANCELACIÓN CON IF-MATCH Y BLOQUEOS (S03 / S05 / D07)
// ============================================================================

test('SLOT-05 / SLOT-06: Cancelación con If-Match y liberación de horario', async () => {
  const { db, adapter } = createTestDatabase();

  const nowChile = chileLocalToUtcSeconds(2026, 11, 5, 12, 0);
  const slot14Sec = chileLocalToUtcSeconds(2026, 11, 6, 14, 0);

  const actor = { id: 'usr_cancel_owner', email: 'owner@gmail.com' };

  await insertTestUser(adapter, actor.id, actor.email, 'Usuario Dueño Cancelación');

  // Crear reserva
  const bkg = await executeCreateBookingCommand(
    adapter,
    actor,
    'key_to_cancel',
    {
      professionalId: 'eduardo',
      startAt: new Date(slot14Sec * 1000).toISOString(),
      patient: {
        name: 'Paciente Cancelación',
        email: 'cancel@gmail.com',
        rut: '16.789.012-1',
        documentType: 'rut'
      },
      consentVersion: 'v1.0'
    },
    nowChile
  );

  const bookingId = bkg.result.result.resourceId;

  // 1. Intentar cancelar con versión obsoleta -> 412 VERSION_CONFLICT
  await assert.rejects(
    async () => {
      await executeCancelBookingCommand(
        adapter,
        { id: actor.id, isTeam: false },
        bookingId,
        '"v99"',
        nowChile
      );
    },
    (err: any) => err instanceof ApiCommandError && err.code === 'VERSION_CONFLICT'
  );

  // 2. Cancelar con versión correcta ("v1") -> Éxito
  const cancelRes = await executeCancelBookingCommand(
    adapter,
    { id: actor.id, isTeam: false },
    bookingId,
    '"v1"',
    nowChile
  );

  assert.strictEqual(cancelRes.result.status, 'cancelled');
  assert.strictEqual(cancelRes.result.version, '"v2"');

  // 3. Comprobar que el slot vuelve a estar disponible en availability
  const slotsAfterCancel = await getAvailableSlots(adapter, {
    professionalId: 'eduardo',
    fromDate: '2026-11-06',
    toDate: '2026-11-07',
    nowSeconds: nowChile
  });

  const slot14Found = slotsAfterCancel.slots.some(
    (s) => new Date(s.startAt).getTime() / 1000 === slot14Sec
  );
  assert.strictEqual(slot14Found, true, 'El cupo debe liberarse tras la cancelación');

  db.close();
});

test('D04: Bloqueos de equipo excluyen disponibilidad', async () => {
  const { db, adapter } = createTestDatabase();

  const nowChile = chileLocalToUtcSeconds(2026, 11, 5, 12, 0);
  const slot15Sec = chileLocalToUtcSeconds(2026, 11, 6, 15, 0);

  // Crear bloqueo de 60 min para Felipe de 15:00 a 16:00
  await executeCreateBlockCommand(
    adapter,
    { id: 'usr_admin' },
    'key_block_test',
    {
      professionalId: 'felipe',
      startAt: new Date(slot15Sec * 1000).toISOString(),
      endAt: new Date((slot15Sec + 3600) * 1000).toISOString()
    },
    nowChile
  );

  // Consultar disponibilidad: el slot de las 15:00 no debe estar disponible
  const slots = await getAvailableSlots(adapter, {
    professionalId: 'felipe',
    fromDate: '2026-11-06',
    toDate: '2026-11-07',
    nowSeconds: nowChile
  });

  const slot15Found = slots.slots.some(
    (s) => new Date(s.startAt).getTime() / 1000 === slot15Sec
  );
  assert.strictEqual(slot15Found, false, 'El slot bloqueado no debe aparecer disponible');

  db.close();
});

test('SLOT-TX: Transacciones atómicas, validación estricta, idempotencia de bloqueos e If-Match sin comillas', async () => {
  const { db, adapter } = createTestDatabase();
  const nowChile = chileLocalToUtcSeconds(2026, 11, 5, 12, 0);

  await insertTestUser(adapter, 'usr_test_tx', 'carlos@example.com', 'Carlos Ruiz');

  // 1. Cancelación con If-Match sin comillas (v1) actualiza la DB a cancelled
  const slot10Sec = chileLocalToUtcSeconds(2026, 11, 6, 10, 0);
  const slot10Iso = new Date(slot10Sec * 1000).toISOString();
  const bkgRes = await executeCreateBookingCommand(
    adapter,
    { id: 'usr_test_tx', email: 'carlos@example.com' },
    'key_tx_001',
    {
      professionalId: 'felipe',
      startAt: slot10Iso,
      patient: {
        name: 'Carlos Ruiz',
        email: 'carlos@example.com',
        rut: '12.345.678-5'
      },
      consentVersion: 'v1.0'
    },
    nowChile
  );
  const bookingId = bkgRes.result.result.resourceId;

  // Cancelar enviando 'v1' sin comillas
  await executeCancelBookingCommand(adapter, { id: 'usr_test_tx', email: 'carlos@example.com' }, bookingId, 'v1', nowChile);

  const dbEntry = await adapter.first<{ status: string; version: string }>(
    'SELECT status, version FROM agenda_entries WHERE id = ?',
    bookingId
  );
  assert.strictEqual(dbEntry?.status, 'cancelled', 'La fila en la DB debe haber cambiado a cancelled');
  assert.strictEqual(dbEntry?.version, '"v2"');

  // 2. Idempotencia de executeCreateBlockCommand
  const slot16Sec = chileLocalToUtcSeconds(2026, 11, 6, 16, 0);
  const blockStartIso = new Date(slot16Sec * 1000).toISOString();
  const blockEndIso = new Date((slot16Sec + 3600) * 1000).toISOString();
  const blockIdemKey = 'key_block_idem_001';

  const blockRes1 = await executeCreateBlockCommand(
    adapter,
    { id: 'usr_admin' },
    blockIdemKey,
    {
      professionalId: 'felipe',
      startAt: blockStartIso,
      endAt: blockEndIso
    },
    nowChile
  );

  const blockId = blockRes1.result.result.resourceId;
  const auditRow = await adapter.first<{ action: string; entity_type: string }>(
    'SELECT action, entity_type FROM audit_events WHERE entity_id = ?',
    blockId
  );
  assert.strictEqual(auditRow?.action, 'create_team_block');

  const cmdRow = await adapter.first<{ idempotency_key: string }>(
    'SELECT idempotency_key FROM command_results WHERE idempotency_key = ?',
    blockIdemKey
  );
  assert.strictEqual(cmdRow?.idempotency_key, blockIdemKey);

  // Replay con misma clave y mismo payload: debe devolver isReplay: true y el mismo resourceId
  const blockResReplay = await executeCreateBlockCommand(
    adapter,
    { id: 'usr_admin' },
    blockIdemKey,
    {
      professionalId: 'felipe',
      startAt: blockStartIso,
      endAt: blockEndIso
    },
    nowChile
  );
  assert.strictEqual(blockResReplay.isReplay, true);
  assert.strictEqual(blockResReplay.result.result.resourceId, blockId);

  // 3. Reintento con distinta hora lanza 409 IDEMPOTENCY_MISMATCH
  const slot17Sec = chileLocalToUtcSeconds(2026, 11, 6, 17, 0);
  await assert.rejects(
    async () => {
      await executeCreateBlockCommand(
        adapter,
        { id: 'usr_admin' },
        blockIdemKey,
        {
          professionalId: 'felipe',
          startAt: new Date(slot17Sec * 1000).toISOString(),
          endAt: new Date((slot17Sec + 3600) * 1000).toISOString()
        },
        nowChile
      );
    },
    (err: any) => err instanceof ApiCommandError && err.code === 'IDEMPOTENCY_MISMATCH' && err.status === 409
  );

  // 4. Validaciones estrictas: profesional inválido y nombre inválido
  await assert.rejects(
    async () => {
      await executeCreateBookingCommand(
        adapter,
        { id: 'usr_test_tx', email: 'carlos@example.com' },
        'key_invalid_pro',
        {
          professionalId: 'otro_medico' as any,
          startAt: slot10Iso,
          patient: { name: 'Juan Pérez', email: 'juan@test.com', rut: '12.345.678-5' },
          consentVersion: 'v1.0'
        },
        nowChile
      );
    },
    (err: any) => err instanceof ApiCommandError && err.code === 'VALIDATION_ERROR' && err.status === 400
  );

  await assert.rejects(
    async () => {
      await executeCreateBookingCommand(
        adapter,
        { id: 'usr_test_tx', email: 'carlos@example.com' },
        'key_invalid_name',
        {
          professionalId: 'felipe',
          startAt: slot10Iso,
          patient: { name: 'J', email: 'juan@test.com', rut: '12.345.678-5' },
          consentVersion: 'v1.0'
        },
        nowChile
      );
    },
    (err: any) => err instanceof ApiCommandError && err.code === 'VALIDATION_ERROR' && err.status === 422
  );

  // 5. Intentar cancelar o editar un 'block' como si fuera cita retorna 404 NOT_FOUND
  await assert.rejects(
    async () => {
      await executeCancelBookingCommand(adapter, { id: 'usr_test_tx', email: 'carlos@example.com' }, blockId, '"v1"', nowChile);
    },
    (err: any) => err instanceof ApiCommandError && err.code === 'NOT_FOUND' && err.status === 404
  );

  db.close();
});

test('POLICY-TZ: Horario de invierno UTC-4, ventana de equipo D04, y getTeamSchedule semiabierto [from, to)', async () => {
  const { db, adapter } = createTestDatabase();

  // 1. Invierno en Chile (julio UTC-4)
  const winterMidnightUtc = chileLocalToUtcSeconds(2026, 7, 15, 0, 0);
  assert.strictEqual(
    new Date(winterMidnightUtc * 1000).toISOString(),
    '2026-07-15T04:00:00.000Z',
    'Medianoche en invierno chileno debe ser 04:00Z'
  );

  const winter9amUtc = chileLocalToUtcSeconds(2026, 7, 15, 9, 0);
  assert.strictEqual(
    new Date(winter9amUtc * 1000).toISOString(),
    '2026-07-15T13:00:00.000Z',
    'Las 09:00 en invierno chileno debe ser 13:00Z'
  );

  // 2. isWithinTeamBookingWindow
  const nowNov25 = chileLocalToUtcSeconds(2026, 11, 25, 12, 0);
  const farFutureSlot = chileLocalToUtcSeconds(2027, 12, 3, 10, 0);
  assert.strictEqual(
    isWithinTeamBookingWindow(farFutureSlot, nowNov25),
    false,
    'Debe rechazar citas a más de un año de distancia'
  );

  const nearFutureSlot = chileLocalToUtcSeconds(2026, 11, 30, 10, 0);
  assert.strictEqual(
    isWithinTeamBookingWindow(nearFutureSlot, nowNov25),
    true,
    'Debe permitir citas dentro de los 31 días autorizados'
  );

  // 3. getTeamSchedule con hoy D+0 (2026-11-06)
  const nowFriNov6 = chileLocalToUtcSeconds(2026, 11, 6, 8, 0);
  const slotSat10 = chileLocalToUtcSeconds(2026, 11, 7, 10, 0);
  await adapter.run(
    `INSERT INTO agenda_entries (
      id, kind, professional_id, start_at, end_at, status, version, encrypted_snapshot, created_at, updated_at
    ) VALUES ('bkg_sat_test', 'appointment', 'felipe', ?, ?, 'confirmed', 'v1', '{"name":"Sábado"}', 1730890000, 1730890000)`,
    slotSat10,
    slotSat10 + 3600
  );

  const teamSched = await getTeamSchedule(adapter, 'felipe', '2026-11-06', '2026-11-07', nowFriNov6);
  assert.strictEqual(teamSched.availableSlots.length, 11, 'El equipo debe ver los turnos disponibles de hoy D+0');
  const hasSatEntry = teamSched.entries.some((e) => e.id === 'bkg_sat_test');
  assert.strictEqual(hasSatEntry, false, 'El rango semiabierto [from, to) no debe incluir citas del día toDate');

  // 4. getAvailableSlots con rango > 35 días lanza 400 VALIDATION_ERROR
  await assert.rejects(
    async () => {
      await getAvailableSlots(adapter, {
        professionalId: 'felipe',
        fromDate: '2026-01-01',
        toDate: '2028-01-01',
        nowSeconds: nowFriNov6
      });
    },
    (err: any) => err instanceof ApiCommandError && err.code === 'VALIDATION_ERROR' && err.status === 400
  );

  db.close();
});

test('AUDIT-FIX: Subsanación de hallazgos de auditoría (Batch en Delete Block, If-Match en Perfil, Idempotencia en Edit Team, Secreto PII)', async () => {
  const { db, adapter } = createTestDatabase();
  const now = chileLocalToUtcSeconds(2026, 11, 5, 12, 0);

  // 1. Inyección y derivación de clave con setPiiEncryptionSecret
  const testSecret = 'cf-staging-super-secret-pii-key-999';
  setPiiEncryptionSecret(testSecret);
  const encrypted = await encryptPiiJson({ rut: '12.345.678-5', name: 'Paciente Cifrado' });
  assert.match(encrypted, /^enc:v1:/);
  const decrypted = await decryptPiiJson<{ rut: string; name: string }>(encrypted);
  assert.strictEqual(decrypted?.rut, '12.345.678-5');
  assert.strictEqual(decrypted?.name, 'Paciente Cifrado');

  // 2. Normalización de If-Match sin comillas en savePatientProfile
  await insertTestUser(adapter, 'usr_prof_test', 'prof@test.com', 'Usuario Perfil');
  await savePatientProfile(adapter, 'usr_prof_test', {
    name: 'Nombre Original',
    email: 'prof@test.com',
    rut: '12.345.678-5'
  }, 'v1.0', {}, now);

  const initialProfile = await getPatientProfile(adapter, 'usr_prof_test');
  assert.strictEqual(initialProfile.version, '"v1"');

  const updateRes = await savePatientProfile(adapter, 'usr_prof_test', {
    name: 'Nombre Actualizado',
    email: 'prof@test.com',
    rut: '12.345.678-5'
  }, 'v1.0', { ifMatch: 'v1' }, now);
  assert.strictEqual(updateRes.version, '"v2"');

  const updatedProfile = await getPatientProfile(adapter, 'usr_prof_test');
  assert.strictEqual(updatedProfile.profile?.name, 'Nombre Actualizado');
  assert.strictEqual(updatedProfile.version, '"v2"');

  // 3. executeDeleteBlockCommand con db.batch atómico
  const blockStartSec = chileLocalToUtcSeconds(2026, 11, 6, 15, 0);
  const blockStartIso = new Date(blockStartSec * 1000).toISOString();
  const blockEndIso = new Date((blockStartSec + 3600) * 1000).toISOString();
  const createBlockRes = await executeCreateBlockCommand(
    adapter,
    { id: 'usr_admin' },
    'idem_del_block_1',
    { professionalId: 'felipe', startAt: blockStartIso, endAt: blockEndIso },
    now
  );
  const blockId = createBlockRes.result.result.resourceId;

  const delBlockRes = await executeDeleteBlockCommand(
    adapter,
    { id: 'usr_admin' },
    blockId,
    'v1',
    now
  );
  assert.strictEqual(delBlockRes.result.status, 'cancelled');
  assert.strictEqual(delBlockRes.result.version, '"v2"');

  const auditDel = await adapter.first<{ action: string }>(
    'SELECT action FROM audit_events WHERE entity_id = ? AND action = ?',
    blockId,
    'delete_team_block'
  );
  assert.strictEqual(auditDel?.action, 'delete_team_block');

  // 4. Idempotencia en executeEditTeamBookingCommand
  await insertTestUser(adapter, 'usr_pat_edit', 'edit@gmail.com', 'Paciente Edit');
  const slotSec = chileLocalToUtcSeconds(2026, 11, 6, 10, 0);
  const slotIso = new Date(slotSec * 1000).toISOString();
  const bkgRes = await executeCreateBookingCommand(
    adapter,
    { id: 'usr_pat_edit', email: 'edit@gmail.com' },
    'idem_bkg_edit_1',
    {
      professionalId: 'felipe',
      startAt: slotIso,
      patient: { name: 'Paciente Inicial', email: 'edit@gmail.com', rut: '12.345.678-5' },
      consentVersion: 'v1.0'
    },
    now
  );
  const bkgId = bkgRes.result.result.resourceId;

  const editIdemKey = 'idem_team_edit_key_44';
  const editUpdate = {
    patient: { name: 'Paciente Nombre Editado', email: 'edit_new@gmail.com', rut: '12.345.678-5' }
  };

  const editRes1 = await executeEditTeamBookingCommand(
    adapter,
    { id: 'usr_admin' },
    bkgId,
    '"v1"',
    editUpdate,
    now,
    editIdemKey
  );
  assert.strictEqual(editRes1.result.version, '"v2"');

  const editReplay = await executeEditTeamBookingCommand(
    adapter,
    { id: 'usr_admin' },
    bkgId,
    '"v1"',
    editUpdate,
    now,
    editIdemKey
  );
  assert.strictEqual(editReplay.result.version, '"v2"');
  assert.strictEqual(editReplay.result.resourceId, bkgId);

  await assert.rejects(
    async () => {
      await executeEditTeamBookingCommand(
        adapter,
        { id: 'usr_admin' },
        bkgId,
        '"v1"',
        { patient: { name: 'Otro Nombre Distinto', email: 'edit_new@gmail.com', rut: '12.345.678-5' } },
        now,
        editIdemKey
      );
    },
    (err: any) => err instanceof ApiCommandError && err.code === 'IDEMPOTENCY_MISMATCH' && err.status === 409
  );

  db.close();
});

test('ATTENDANCE-01: Registro y verificación de asistencia de pacientes (attended, no_show, pending)', async () => {
  const { db, adapter } = createTestDatabase();
  const now = chileLocalToUtcSeconds(2026, 11, 5, 12, 0);
  const targetUtc = new Date(chileLocalToUtcSeconds(2026, 11, 6, 10, 0) * 1000).toISOString();

  await insertTestUser(adapter, 'usr_patient_1', 'paciente@gmail.com', 'Paciente Uno');
  await insertTestUser(adapter, 'usr_felipe_prof', 'felipe.prof@gmail.com', 'Felipe Méndez');
  await insertTestUser(adapter, 'usr_admin', 'centrovida.sanaaustral@gmail.com', 'Admin Centro');

  // 1. Crear una cita confirmada
  const createRes = await executeCreateBookingCommand(
    adapter,
    { id: 'usr_patient_1', email: 'paciente@gmail.com' },
    'idem_att_test_1',
    {
      professionalId: 'felipe',
      startAt: targetUtc,
      patient: {
        name: 'Carlos Asistencia',
        email: 'carlos@gmail.com',
        rut: '12.345.678-5',
        phone: '+56911223344',
        documentType: 'rut'
      },
      consentVersion: 'v1.0'
    },
    now
  );
  const bookingId = createRes.result.result.resourceId;

  // Verificar que inicialmente nace con attendanceStatus = 'attended' (asistió por defecto)
  const scheduleInitial = await getTeamSchedule(adapter, 'felipe', '2026-11-06', '2026-11-07', now);
  const entryInitial = scheduleInitial.entries.find(e => e.id === bookingId);
  assert.ok(entryInitial, 'La cita debe aparecer en getTeamSchedule');
  assert.strictEqual(entryInitial.attendanceStatus, 'attended');

  const detailsInitial = await getBookingDetails(adapter, bookingId, { id: 'usr_admin', isTeam: true });
  assert.strictEqual(detailsInitial.booking.attendanceStatus, 'attended');

  // 2. Conmutar a 'no_show' (inasistencia)
  const recordNoShow = await executeRecordAttendanceCommand(
    adapter,
    { id: 'usr_felipe_prof' },
    bookingId,
    'no_show',
    now + 3600
  );
  assert.strictEqual(recordNoShow.ok, true);
  assert.strictEqual(recordNoShow.bookingId, bookingId);
  assert.strictEqual(recordNoShow.attendanceStatus, 'no_show');
  assert.strictEqual(recordNoShow.attendanceUpdatedAt, new Date((now + 3600) * 1000).toISOString());

  // Verificar que la consulta del equipo refleje 'no_show'
  const scheduleNoShow = await getTeamSchedule(adapter, 'felipe', '2026-11-06', '2026-11-07', now);
  const entryNoShow = scheduleNoShow.entries.find(e => e.id === bookingId);
  assert.strictEqual(entryNoShow?.attendanceStatus, 'no_show');

  // 3. Conmutar de regreso a 'attended'
  const recordAtt = await executeRecordAttendanceCommand(
    adapter,
    { id: 'usr_felipe_prof' },
    bookingId,
    'attended',
    now + 4000
  );
  assert.strictEqual(recordAtt.attendanceStatus, 'attended');

  const scheduleAtt = await getTeamSchedule(adapter, 'felipe', '2026-11-06', '2026-11-07', now);
  const entryAtt = scheduleAtt.entries.find(e => e.id === bookingId);
  assert.strictEqual(entryAtt?.attendanceStatus, 'attended');

  // 4. Rectificar de regreso a 'pending'
  const recordPending = await executeRecordAttendanceCommand(
    adapter,
    { id: 'usr_felipe_prof' },
    bookingId,
    'pending',
    now + 4500
  );
  assert.strictEqual(recordPending.attendanceStatus, 'pending');

  // 5. Rechazo con estado inválido
  await assert.rejects(
    async () => {
      await executeRecordAttendanceCommand(
        adapter,
        { id: 'usr_felipe_prof' },
        bookingId,
        'other_status' as any,
        now
      );
    },
    (err: any) => err instanceof ApiCommandError && err.code === 'VALIDATION_ERROR' && err.status === 400
  );

  // 6. Rechazo con cita inexistente
  await assert.rejects(
    async () => {
      await executeRecordAttendanceCommand(
        adapter,
        { id: 'usr_felipe_prof' },
        'bkg_inexistente_999',
        'attended',
        now
      );
    },
    (err: any) => err instanceof ApiCommandError && err.code === 'NOT_FOUND' && err.status === 404
  );

  // 7. Rechazo si la cita está cancelada
  await executeCancelBookingCommand(adapter, { id: 'usr_admin', isTeam: true }, bookingId, '"v1"', now + 5000);
  await assert.rejects(
    async () => {
      await executeRecordAttendanceCommand(
        adapter,
        { id: 'usr_felipe_prof' },
        bookingId,
        'attended',
        now + 6000
      );
    },
    (err: any) => err instanceof ApiCommandError && err.code === 'BOOKING_CANCELLED' && err.status === 409
  );

  // 8. Verificar que se registraron los eventos en audit_events
  const audits = db.prepare("SELECT action, entity_id FROM audit_events WHERE action = 'record_attendance' AND entity_id = ?").all(bookingId) as any[];
  assert.strictEqual(audits.length, 3, 'Debe haber 3 registros de auditoría por los cambios de asistencia');

  db.close();
});
