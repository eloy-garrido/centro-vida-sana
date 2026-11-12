/**
 * Centro Vida Sana Austral — Tests de Endpoints REST para Ficha y Notas de Pacientes
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { createSqliteAdapter } from '../../src/server/db/adapter.ts';
import { handleApiRequest } from '../../src/server/router.ts';
import { encryptPiiJson } from '../../src/server/auth/crypto.ts';

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

async function loginAs(adapter: any, email: string, name: string, role: 'team' | 'patient') {
  const req = new Request('http://localhost/api/mock-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name, role })
  });
  const res = await handleApiRequest(req, adapter, { isDev: true });
  const body = await res.json() as any;
  const cookieMatch = (res.headers.get('Set-Cookie') || '').match(/vsa_session=([^;]+)/);
  return {
    cookie: `vsa_session=${cookieMatch![1]}`,
    csrfToken: body.csrfToken as string
  };
}

test('NOTES-API-01: Control de Acceso (401 si anónimo, 403 si paciente)', async () => {
  const { db, adapter } = createTestDatabase();

  // 1. Anónimo
  const anonReq = new Request('http://localhost/api/team/bookings/b1/notes', { method: 'GET' });
  const anonRes = await handleApiRequest(anonReq, adapter);
  assert.strictEqual(anonRes.status, 401);

  // 2. Paciente no autorizado para panel de equipo
  const patientAuth = await loginAs(adapter, 'paciente@gmail.com', 'Paciente Normal', 'patient');
  const patientReq = new Request('http://localhost/api/team/bookings/b1/notes', {
    method: 'GET',
    headers: { Cookie: patientAuth.cookie }
  });
  const patientRes = await handleApiRequest(patientReq, adapter);
  assert.strictEqual(patientRes.status, 403);

  db.close();
});

test('NOTES-API-02: Flujo completo GET, POST y PATCH para Ficha y Notas de Paciente', async () => {
  const { db, adapter } = createTestDatabase();

  const teamAuth = await loginAs(adapter, 'centrovida.sanaaustral@gmail.com', 'Felipe Méndez', 'team');

  // Insertar una cita con paciente
  const piiEnc = await encryptPiiJson({
    name: 'Andrés Morales',
    rut: '16.789.012-3',
    email: 'andres@gmail.com',
    phone: '+56987654321',
    documentType: 'rut'
  });

  db.exec(`
    INSERT INTO agenda_entries (
      id, kind, professional_id, start_at, end_at, status, version, encrypted_snapshot, created_at, updated_at
    ) VALUES (
      'booking_andres_1', 'appointment', 'felipe', 1762440000, 1762443600, 'confirmed', '"v1"', '${piiEnc}', 1762440000, 1762440000
    );
  `);

  // 1. GET inicial sin notas: debe devolver los datos del paciente y lista vacía
  const getReq = new Request('http://localhost/api/team/bookings/booking_andres_1/notes', {
    method: 'GET',
    headers: { Cookie: teamAuth.cookie }
  });
  const getRes = await handleApiRequest(getReq, adapter);
  assert.strictEqual(getRes.status, 200);
  const getBody = await getRes.json() as any;
  assert.strictEqual(getBody.patient.name, 'Andrés Morales');
  assert.strictEqual(getBody.patientKey, 'RUT:16789012-3');
  assert.strictEqual(getBody.notes.length, 0);

  // 2. POST crear nueva nota sin CSRF -> 403
  const noCsrfReq = new Request(`http://localhost/api/team/patients/${getBody.patientKey}/notes`, {
    method: 'POST',
    headers: {
      Cookie: teamAuth.cookie,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      content: 'Primera sesión. Evaluación inicial.',
      professionalId: 'felipe',
      bookingId: 'booking_andres_1'
    })
  });
  const noCsrfRes = await handleApiRequest(noCsrfReq, adapter);
  assert.strictEqual(noCsrfRes.status, 403);

  // 3. POST crear nueva nota con CSRF válido -> 201
  const createReq = new Request(`http://localhost/api/team/patients/${getBody.patientKey}/notes`, {
    method: 'POST',
    headers: {
      Cookie: teamAuth.cookie,
      'X-CSRF-Token': teamAuth.csrfToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      content: 'Primera sesión. Evaluación inicial.',
      professionalId: 'felipe',
      bookingId: 'booking_andres_1'
    })
  });
  const createRes = await handleApiRequest(createReq, adapter);
  assert.strictEqual(createRes.status, 201);
  const createdBody = await createRes.json() as any;
  assert.ok(createdBody.note.id);
  assert.strictEqual(createdBody.note.content, 'Primera sesión. Evaluación inicial.');
  assert.strictEqual(createdBody.note.isEdited, false);

  const noteId = createdBody.note.id;

  // 4. PATCH editar nota existente con CSRF -> 200
  const patchReq = new Request(`http://localhost/api/team/notes/${noteId}`, {
    method: 'PATCH',
    headers: {
      Cookie: teamAuth.cookie,
      'X-CSRF-Token': teamAuth.csrfToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      content: 'Primera sesión. Evaluación inicial ampliada con indicaciones para el hogar.'
    })
  });
  const patchRes = await handleApiRequest(patchReq, adapter);
  assert.strictEqual(patchRes.status, 200);
  const patchBody = await patchRes.json() as any;
  assert.strictEqual(patchBody.note.content, 'Primera sesión. Evaluación inicial ampliada con indicaciones para el hogar.');

  // 5. GET final: debe listar la nota actualizada
  const getFinalRes = await handleApiRequest(getReq, adapter);
  const finalBody = await getFinalRes.json() as any;
  assert.strictEqual(finalBody.notes.length, 1);
  assert.strictEqual(finalBody.notes[0].content, 'Primera sesión. Evaluación inicial ampliada con indicaciones para el hogar.');

  db.close();
});
