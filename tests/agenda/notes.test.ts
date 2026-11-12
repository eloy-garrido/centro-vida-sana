/**
 * Centro Vida Sana Austral — Tests de Servicio de Ficha y Notas Clínicas de Pacientes
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { createSqliteAdapter } from '../../src/server/db/adapter.ts';
import { encryptPiiJson } from '../../src/server/auth/crypto.ts';
import {
  normalizePatientKey,
  getPatientNotesByBooking,
  createPatientNote,
  updatePatientNote
} from '../../src/server/agenda/notes.ts';

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

test('NOTES-01: normalizePatientKey genera claves unificadas canónicas', () => {
  assert.strictEqual(normalizePatientKey('12.345.678-k', 'rut'), 'RUT:12345678-K');
  assert.strictEqual(normalizePatientKey('  12345678-K  '), 'RUT:12345678-K');
  assert.strictEqual(normalizePatientKey('AB123456', 'passport'), 'PASSPORT:AB123456');
  assert.strictEqual(normalizePatientKey('paciente@correo.cl', 'other'), 'OTHER:paciente@correo.cl');
});

test('NOTES-02: createPatientNote cifra en D1 y devuelve nota desencriptada', async () => {
  const { db, adapter } = createTestDatabase();

  db.exec(`
    INSERT INTO users (id, google_sub, name, email, created_at, updated_at)
    VALUES ('usr_felipe', 'sub_felipe', 'Felipe Méndez', 'felipe@centrovidasana.cl', 1762440000, 1762440000);
  `);

  const teamActor = { id: 'usr_felipe', name: 'Felipe Méndez', isTeam: true };

  const note = await createPatientNote(adapter, {
    patientKey: 'RUT:12345678-K',
    professionalId: 'felipe',
    content: 'Dolor agudo en trapecio derecho. Se realiza ajuste y masoterapia.',
    actor: teamActor,
    nowSeconds: 1762445000
  });

  assert.ok(note.id);
  assert.strictEqual(note.professionalId, 'felipe');
  assert.strictEqual(note.professionalName, 'Felipe Méndez');
  assert.strictEqual(note.authorName, 'Felipe Méndez');
  assert.strictEqual(note.content, 'Dolor agudo en trapecio derecho. Se realiza ajuste y masoterapia.');
  assert.strictEqual(note.isEdited, false);

  // Verificar en la base de datos SQL cruda que el texto está cifrado
  const rawRow = db.prepare('SELECT encrypted_content FROM patient_notes WHERE id = ?').get(note.id) as any;
  assert.ok(rawRow.encrypted_content.startsWith('enc:v1:'), 'El texto clínico debe estar cifrado');
  assert.ok(!rawRow.encrypted_content.includes('trapecio'), 'No debe contener texto plano en la DB');

  db.close();
});

test('NOTES-03: getPatientNotesByBooking recupera notas vinculadas por RUT a través de distintas citas', async () => {
  const { db, adapter } = createTestDatabase();

  db.exec(`
    INSERT INTO users (id, google_sub, name, email, created_at, updated_at)
    VALUES ('usr_team', 'sub_team', 'Felipe Méndez', 'felipe@centrovidasana.cl', 1762440000, 1762440000);
  `);

  // Crear 2 citas para el mismo paciente (mismo RUT) en distintas fechas
  const snapshotEnc = await encryptPiiJson({
    name: 'Camila Silva',
    rut: '17.890.123-4',
    email: 'camila@gmail.com',
    phone: '+56911223344',
    documentType: 'rut'
  });

  db.exec(`
    INSERT INTO agenda_entries (
      id, kind, professional_id, start_at, end_at, status, version, encrypted_snapshot, created_at, updated_at
    ) VALUES 
      ('booking_1', 'appointment', 'felipe', 1762440000, 1762443600, 'confirmed', '"v1"', '${snapshotEnc}', 1762440000, 1762440000),
      ('booking_2', 'appointment', 'eduardo', 1762526400, 1762530000, 'confirmed', '"v1"', '${snapshotEnc}', 1762440000, 1762440000);
  `);

  const teamActor = { id: 'usr_team', name: 'Felipe Méndez', isTeam: true };

  // Crear una nota en la primera sesión
  await createPatientNote(adapter, {
    patientKey: 'RUT:17890123-4',
    bookingId: 'booking_1',
    professionalId: 'felipe',
    content: 'Evaluación quiropráctica inicial.',
    actor: teamActor,
    nowSeconds: 1762441000
  });

  // Crear una segunda nota posterior en sesión de acupuntura
  await createPatientNote(adapter, {
    patientKey: 'RUT:17890123-4',
    bookingId: 'booking_2',
    professionalId: 'eduardo',
    content: 'Sesión de acupuntura para manejo de estrés y dolor.',
    actor: { id: 'usr_team', name: 'Eduardo Lagos', isTeam: true },
    nowSeconds: 1762527000
  });

  // Al consultar desde cualquiera de las dos citas, debe devolver ambas notas ordenadas (la más reciente primero)
  const resultFromBooking2 = await getPatientNotesByBooking(adapter, 'booking_2', teamActor);
  assert.strictEqual(resultFromBooking2.patient.name, 'Camila Silva');
  assert.strictEqual(resultFromBooking2.patientKey, 'RUT:17890123-4');
  assert.strictEqual(resultFromBooking2.notes.length, 2);
  assert.strictEqual(resultFromBooking2.notes[0].professionalId, 'eduardo');
  assert.strictEqual(resultFromBooking2.notes[1].professionalId, 'felipe');

  db.close();
});

test('NOTES-04: updatePatientNote actualiza contenido y marca isEdited', async () => {
  const { db, adapter } = createTestDatabase();

  db.exec(`
    INSERT INTO users (id, google_sub, name, email, created_at, updated_at)
    VALUES ('usr_felipe', 'sub_felipe', 'Felipe Méndez', 'felipe@centrovidasana.cl', 1762440000, 1762440000);
  `);

  const teamActor = { id: 'usr_felipe', name: 'Felipe Méndez', isTeam: true };

  const note = await createPatientNote(adapter, {
    patientKey: 'RUT:12345678-K',
    professionalId: 'felipe',
    content: 'Texto original con error de tipeo.',
    actor: teamActor,
    nowSeconds: 1762445000
  });

  const updatedNote = await updatePatientNote(adapter, note.id, 'Texto corregido y ampliado.', teamActor, 1762446000);
  assert.strictEqual(updatedNote.content, 'Texto corregido y ampliado.');
  assert.strictEqual(updatedNote.isEdited, true);
  assert.strictEqual(updatedNote.updatedAt, new Date(1762446000 * 1000).toISOString());

  // Intento de nota vacía debe fallar
  await assert.rejects(
    async () => updatePatientNote(adapter, note.id, '   ', teamActor),
    /El contenido de la nota no puede estar vacío/
  );

  db.close();
});
