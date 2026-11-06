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

function createTestDatabase() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  const migrationPath = resolve(process.cwd(), 'migrations/0001_initial_schema.sql');
  const sql = readFileSync(migrationPath, 'utf-8');
  db.exec(sql);
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
