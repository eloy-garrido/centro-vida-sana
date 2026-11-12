/**
 * Centro Vida Sana Austral — Tests para Invitaciones de Calificación en Google (Email y WhatsApp)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { createSqliteAdapter } from '../../src/server/db/adapter.ts';
import { handleApiRequest } from '../../src/server/router.ts';
import { chileLocalToUtcSeconds } from '../../src/server/agenda/policy.ts';
import {
  renderPatientReviewInviteEmailHtml,
  sendPatientReviewInviteEmail
} from '../../src/server/notifications/email.ts';
import { buildWhatsAppLink } from '../../src/lib/agendamiento/validation.ts';
import { clinicInfo } from '../../src/data/clinic.ts';

function createTestDatabase() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  const migrationPath = resolve(process.cwd(), 'migrations/0001_initial_schema.sql');
  const sql = readFileSync(migrationPath, 'utf-8');
  db.exec(sql);
  return { db, adapter: createSqliteAdapter(db) };
}

test('REVIEW-01: Renderizado de plantilla HTML de invitación a Google Reviews', () => {
  const html = renderPatientReviewInviteEmailHtml({
    bookingId: 'bk_test_123',
    professionalId: 'felipe',
    patient: {
      name: 'María Ignacia Poblete',
      email: 'maria.poblete@gmail.com'
    }
  });

  // Saludo personalizado con el primer nombre
  assert.ok(html.includes('María'));
  // Profesional asignado
  assert.ok(html.includes('Felipe Méndez'));
  assert.ok(html.includes('Quiropraxia y Kinesiología Clínica'));
  // Enlace directo de Google Reviews
  assert.ok(html.includes(clinicInfo.social.googleReviews));
  assert.ok(html.includes('https://search.google.com/local/writereview?placeid=ChIJM0LHMS_VFJYRdPlffqEIVW8'));
  // Elemento visual de 5 estrellas
  assert.ok(html.includes('★ ★ ★ ★ ★'));
  // Identidad institucional y dirección
  assert.ok(html.includes('Centro Vida Sana Austral'));
  assert.ok(html.includes('Los Armiños 1620, Temuco'));
});

test('REVIEW-02: Envío de correo en modo mock y validación de correo inválido', async () => {
  // 1. Correo inválido
  const invalidRes = await sendPatientReviewInviteEmail({
    professionalId: 'eduardo',
    patient: {
      name: 'Juan Perez',
      email: 'correo-sin-arroba'
    }
  });
  assert.strictEqual(invalidRes.ok, false);
  assert.ok(invalidRes.error);

  // 2. Correo válido en modo mock (sin RESEND_API_KEY)
  const mockRes = await sendPatientReviewInviteEmail({
    professionalId: 'eduardo',
    patient: {
      name: 'Juan Perez',
      email: 'juan.perez@gmail.com'
    }
  });
  assert.strictEqual(mockRes.ok, true);
  assert.ok(mockRes.messageId);
});

test('REVIEW-03: Generación de enlace de WhatsApp para invitación a calificar en Google', () => {
  const patientPhone = '+56 9 8765 4321';
  const greeting = 'Hola Juan, ';
  const googleReviewsUrl = clinicInfo.social.googleReviews;
  const waReviewMessage = `${greeting}esperamos que te encuentres muy bien tras tu atención en Centro Vida Sana Austral 🌿\n\nTu opinión es muy importante para nosotros y nos ayuda a que más personas encuentren atención de salud integral en Temuco. ¿Nos regalarías 1 minuto para dejarnos tu calificación y comentario en Google? ⭐⭐⭐⭐⭐\n\nPuedes hacerlo directamente aquí: ${googleReviewsUrl}\n\n¡Muchas gracias por tu confianza!`;

  const waUrl = buildWhatsAppLink(patientPhone, waReviewMessage);
  assert.ok(waUrl);
  assert.ok(waUrl.startsWith('https://wa.me/56987654321?text='));
  assert.ok(waUrl.includes(encodeURIComponent('Centro Vida Sana Austral')));
  assert.ok(waUrl.includes(encodeURIComponent(googleReviewsUrl)));
});

test('REVIEW-04: Endpoint POST /api/team/bookings/:id/send-review-invite', async () => {
  const { db, adapter } = createTestDatabase();
  const now = chileLocalToUtcSeconds(2026, 11, 5, 12, 0);

  // 1. Iniciar sesión como Paciente
  const patLogin = await handleApiRequest(
    new Request('http://localhost/api/mock-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'patient', email: 'paciente@gmail.com' })
    }),
    adapter,
    { nowSeconds: now, isDev: true }
  );
  const patData = await patLogin.json() as any;
  const patCookie = `vsa_session=${patLogin.headers.get('Set-Cookie')!.match(/vsa_session=([^;]+)/)![1]}`;

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

  // 3. Crear una cita para tener un bookingId real
  const slotUtc = new Date(chileLocalToUtcSeconds(2026, 11, 6, 10, 0) * 1000).toISOString();
  const bookRes = await handleApiRequest(
    new Request('http://localhost/api/team/bookings', {
      method: 'POST',
      headers: {
        Cookie: teamCookie,
        'Content-Type': 'application/json',
        'X-CSRF-Token': teamCsrf,
        'Idempotency-Key': 'idemp_rev_test_001'
      },
      body: JSON.stringify({
        professionalId: 'felipe',
        startAt: slotUtc,
        patient: {
          name: 'Claudia Andrea Soto',
          email: 'claudia.soto@gmail.com',
          rut: '16.789.012-1',
          documentType: 'rut',
          phone: '+56 9 9123 4567'
        },
        consentVersion: 'v1.0'
      })
    }),
    adapter,
    { nowSeconds: now }
  );
  assert.strictEqual(bookRes.status, 201);
  const bookData = await bookRes.json() as any;
  const bookingId = bookData.result.resourceId;

  // 4. Intentar enviar con sesión de Paciente -> 403 Forbidden
  const patInviteRes = await handleApiRequest(
    new Request(`http://localhost/api/team/bookings/${bookingId}/send-review-invite`, {
      method: 'POST',
      headers: {
        Cookie: patCookie,
        'X-CSRF-Token': patData.csrfToken
      }
    }),
    adapter,
    { nowSeconds: now }
  );
  assert.strictEqual(patInviteRes.status, 403);

  // 5. Intentar enviar sin CSRF -> 403 Forbidden
  const noCsrfRes = await handleApiRequest(
    new Request(`http://localhost/api/team/bookings/${bookingId}/send-review-invite`, {
      method: 'POST',
      headers: {
        Cookie: teamCookie
      }
    }),
    adapter,
    { nowSeconds: now }
  );
  assert.strictEqual(noCsrfRes.status, 403);

  // 6. Intentar enviar con booking inexistente -> 404 Not Found
  const notFoundRes = await handleApiRequest(
    new Request('http://localhost/api/team/bookings/bk_inexistente_999/send-review-invite', {
      method: 'POST',
      headers: {
        Cookie: teamCookie,
        'X-CSRF-Token': teamCsrf
      }
    }),
    adapter,
    { nowSeconds: now }
  );
  assert.strictEqual(notFoundRes.status, 404);

  // 7. Envío exitoso con sesión de Equipo y CSRF válido -> 200 OK
  const successRes = await handleApiRequest(
    new Request(`http://localhost/api/team/bookings/${bookingId}/send-review-invite`, {
      method: 'POST',
      headers: {
        Cookie: teamCookie,
        'X-CSRF-Token': teamCsrf
      }
    }),
    adapter,
    { nowSeconds: now }
  );
  assert.strictEqual(successRes.status, 200);
  const successData = await successRes.json() as any;
  assert.strictEqual(successData.ok, true);
  assert.ok(successData.message.includes('claudia.soto@gmail.com'));

  db.close();
});
