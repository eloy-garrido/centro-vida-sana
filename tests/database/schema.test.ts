/**
 * Centro Vida Sana Austral — Tests de Base de Datos D1 Local y Triggers
 * Conforme a S02 (esquema D1), S03 (exclusión atómica transaccional) y S09 (idempotencia).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function createTestDatabase(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');

  const migrationPath = resolve(process.cwd(), 'migrations/0001_initial_schema.sql');
  const sql = readFileSync(migrationPath, 'utf-8');
  db.exec(sql);

  return db;
}

test('D1 Schema: tablas, profesionales y miembros iniciales', () => {
  const db = createTestDatabase();

  const proQuery = db.prepare('SELECT id, name FROM professionals ORDER BY id');
  const pros = proQuery.all() as { id: string; name: string }[];
  assert.strictEqual(pros.length, 2);
  assert.strictEqual(pros[0].id, 'eduardo');
  assert.strictEqual(pros[1].id, 'felipe');

  const memberQuery = db.prepare('SELECT email, role FROM team_members');
  const members = memberQuery.all() as { email: string; role: string }[];
  assert.strictEqual(members.length, 1);
  assert.strictEqual(members[0].email, 'centrovida.sanaaustral@gmail.com');
  assert.strictEqual(members[0].role, 'admin');

  db.close();
});

test('SLOT-02: Exclusión atómica de solapamientos en mismo profesional', () => {
  const db = createTestDatabase();

  // 1. Insertar una cita válida para Felipe: 10:00 a 11:00 (1730894400 a 1730898000)
  const startAt = 1730894400; // 10:00:00 UTC
  const endAt = startAt + 3600; // 11:00:00 UTC

  const insertStmt = db.prepare(`
    INSERT INTO agenda_entries (
      id, kind, professional_id, start_at, end_at, status, version, encrypted_snapshot, created_at, updated_at
    ) VALUES (?, 'appointment', 'felipe', ?, ?, 'confirmed', 'v1', '{"patient":"test"}', 1730890000, 1730890000)
  `);

  insertStmt.run('bkg_1', startAt, endAt);

  // 2. Intentar insertar en el mismo horario exacto (debe fallar con SLOT_CONFLICT)
  assert.throws(
    () => {
      insertStmt.run('bkg_conflict_exact', startAt, endAt);
    },
    (err: any) => err.message.includes('SLOT_CONFLICT'),
    'Debe rechazar solapamiento exacto con SLOT_CONFLICT'
  );

  // 3. Intentar insertar con solapamiento parcial hacia adelante (10:30 a 11:30)
  assert.throws(
    () => {
      insertStmt.run('bkg_conflict_forward', startAt + 1800, startAt + 1800 + 3600);
    },
    (err: any) => err.message.includes('SLOT_CONFLICT'),
    'Debe rechazar solapamiento parcial hacia adelante'
  );

  // 4. Intentar insertar con solapamiento parcial hacia atrás (09:30 a 10:30)
  assert.throws(
    () => {
      insertStmt.run('bkg_conflict_backward', startAt - 1800, startAt - 1800 + 3600);
    },
    (err: any) => err.message.includes('SLOT_CONFLICT'),
    'Debe rechazar solapamiento parcial hacia atrás'
  );

  // 5. Cita inmediatamente antes (09:00 a 10:00, fin coincide con inicio) -> PERMITIDA
  assert.doesNotThrow(() => {
    insertStmt.run('bkg_before', startAt - 3600, startAt);
  }, 'Debe permitir cita adyacente anterior');

  // 6. Cita inmediatamente después (11:00 a 12:00, inicio coincide con fin) -> PERMITIDA
  assert.doesNotThrow(() => {
    insertStmt.run('bkg_after', endAt, endAt + 3600);
  }, 'Debe permitir cita adyacente posterior');

  db.close();
});

test('SLOT-03: Agendas independientes permiten turnos simultáneos en profesionales distintos', () => {
  const db = createTestDatabase();

  const startAt = 1730894400; // 10:00:00 UTC
  const endAt = startAt + 3600; // 11:00:00 UTC

  const insertStmt = db.prepare(`
    INSERT INTO agenda_entries (
      id, kind, professional_id, start_at, end_at, status, version, encrypted_snapshot, created_at, updated_at
    ) VALUES (?, 'appointment', ?, ?, ?, 'confirmed', 'v1', '{"patient":"test"}', 1730890000, 1730890000)
  `);

  // Felipe atiende de 10:00 a 11:00
  insertStmt.run('bkg_felipe', 'felipe', startAt, endAt);

  // Eduardo atiende EN EL MISMO HORARIO (10:00 a 11:00) en su propio box
  assert.doesNotThrow(() => {
    insertStmt.run('bkg_eduardo', 'eduardo', startAt, endAt);
  }, 'Debe permitir atenciones simultáneas en boxes diferentes');

  const countQuery = db.prepare('SELECT COUNT(*) as count FROM agenda_entries WHERE start_at = ?');
  const result = countQuery.get(startAt) as { count: number };
  assert.strictEqual(result.count, 2, 'Deben existir 2 citas confirmadas en el mismo horario');

  db.close();
});

test('SLOT-03 / D04: Bloqueos de agenda excluyen citas y viceversa', () => {
  const db = createTestDatabase();

  const startAt = 1730900000;
  const endAt = startAt + 3600;

  // Insertar un bloqueo de 60 min para Felipe
  db.prepare(`
    INSERT INTO agenda_entries (
      id, kind, professional_id, start_at, end_at, status, version, created_at, updated_at
    ) VALUES ('block_1', 'block', 'felipe', ?, ?, 'confirmed', 'v1', 1730890000, 1730890000)
  `).run(startAt, endAt);

  // Intentar agendar una cita sobre ese bloqueo (debe fallar con SLOT_CONFLICT)
  assert.throws(
    () => {
      db.prepare(`
        INSERT INTO agenda_entries (
          id, kind, professional_id, start_at, end_at, status, version, encrypted_snapshot, created_at, updated_at
        ) VALUES ('bkg_over_block', 'appointment', 'felipe', ?, ?, 'confirmed', 'v1', '{"patient":"test"}', 1730890000, 1730890000)
      `).run(startAt, endAt);
    },
    (err: any) => err.message.includes('SLOT_CONFLICT'),
    'Una cita no puede solapar un bloqueo activo'
  );

  db.close();
});

test('SLOT-06: Cancelación lógica libera el intervalo sin borrar el registro', () => {
  const db = createTestDatabase();

  const startAt = 1730894400;
  const endAt = startAt + 3600;

  // 1. Crear cita confirmada
  db.prepare(`
    INSERT INTO agenda_entries (
      id, kind, professional_id, start_at, end_at, status, version, encrypted_snapshot, created_at, updated_at
    ) VALUES ('bkg_cancel_test', 'appointment', 'felipe', ?, ?, 'confirmed', 'v1', '{"patient":"test"}', 1730890000, 1730890000)
  `).run(startAt, endAt);

  // 2. Cancelar la cita (soft-delete lógico)
  db.prepare(`
    UPDATE agenda_entries
    SET status = 'cancelled', version = 'v2', updated_at = 1730891000
    WHERE id = 'bkg_cancel_test'
  `).run();

  // 3. Verificar que la cita sigue existiendo en el historial
  const row = db.prepare('SELECT status, version FROM agenda_entries WHERE id = ?').get('bkg_cancel_test') as {
    status: string;
    version: string;
  };
  assert.strictEqual(row.status, 'cancelled');
  assert.strictEqual(row.version, 'v2');

  // 4. Ahora debe ser posible crear una nueva cita activa en ese mismo horario
  assert.doesNotThrow(() => {
    db.prepare(`
      INSERT INTO agenda_entries (
        id, kind, professional_id, start_at, end_at, status, version, encrypted_snapshot, created_at, updated_at
      ) VALUES ('bkg_new_after_cancel', 'appointment', 'felipe', ?, ?, 'confirmed', 'v1', '{"patient":"nuevo"}', 1730892000, 1730892000)
    `).run(startAt, endAt);
  }, 'El intervalo debe quedar libre tras cancelar la cita previa');

  db.close();
});

test('Duración estricta de atención: 3600 segundos exactos', () => {
  const db = createTestDatabase();

  const startAt = 1730894400;

  // Cita de 30 minutos (1800s) -> Debe ser rechazada por CHECK constraint
  assert.throws(() => {
    db.prepare(`
      INSERT INTO agenda_entries (
        id, kind, professional_id, start_at, end_at, status, version, encrypted_snapshot, created_at, updated_at
      ) VALUES ('bkg_invalid_dur', 'appointment', 'felipe', ?, ?, 'confirmed', 'v1', '{"patient":"test"}', 1730890000, 1730890000)
    `).run(startAt, startAt + 1800);
  });

  db.close();
});

test('Idempotencia: unicidad de (actor_id, idempotency_key)', () => {
  const db = createTestDatabase();

  const insertCmd = db.prepare(`
    INSERT INTO command_results (
      actor_id, idempotency_key, method, path, payload_fingerprint, http_status, resource_id, kind, version, created_at
    ) VALUES (?, ?, 'POST', '/api/bookings', 'fp_hash_123', 201, 'bkg_res_1', 'appointment', 'v1', 1730890000)
  `);

  insertCmd.run('usr_1', 'idem_key_abc');

  // Intentar reinsertar con la misma clave para el mismo actor debe fallar por unicidad
  assert.throws(() => {
    insertCmd.run('usr_1', 'idem_key_abc');
  });

  // Pero otro actor SÍ puede usar su propia clave
  assert.doesNotThrow(() => {
    insertCmd.run('usr_2', 'idem_key_abc');
  });

  db.close();
});
