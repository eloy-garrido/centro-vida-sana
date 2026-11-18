/**
 * Centro Vida Sana Austral — Tests para la Plantilla de Notificación por Correo al Profesional
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  renderBookingEmailHtml,
  type BookingNotificationData
} from '../../src/server/notifications/email.ts';

test('EMAIL-01: Notificación al profesional contiene meta viewport y configuración responsiva móvil', () => {
  const sampleData: BookingNotificationData = {
    bookingId: 'bk_test_prof_01',
    professionalId: 'felipe',
    startAt: '2026-11-12T14:00:00Z',
    patient: {
      name: 'Pamela Gajardo Burgos',
      phone: '+56 9 5999 0388',
      email: 'pamela.gajardo@gmail.com',
      rut: '16.789.123-4'
    }
  };

  const html = renderBookingEmailHtml(sampleData);

  // 1. Debe incluir meta viewport para evitar corte en móviles (Gmail Android / iOS)
  assert.match(html, /<meta\s+name=["']viewport["']\s+content=["'][^"']*width=device-width[^"']*["']/i);

  // 2. Debe incluir meta de idioma o compatibilidad móvil
  assert.ok(html.includes('lang="es"'));
  assert.ok(html.includes('x-apple-disable-message-reformatting'));

  // 3. Debe incluir estilos para pantallas pequeñas
  assert.ok(html.includes('@media only screen and (max-width: 600px)'));
});

test('EMAIL-02: Notificación al profesional incluye datos del paciente y enlaces de acción rápida', () => {
  const sampleData: BookingNotificationData = {
    bookingId: 'bk_test_prof_02',
    professionalId: 'felipe',
    startAt: '2026-11-12T14:00:00Z',
    patient: {
      name: 'Pamela Gajardo Burgos',
      phone: '+56 9 5999 0388',
      email: 'pamela.gajardo@gmail.com',
      rut: '16.789.123-4'
    }
  };

  const html = renderBookingEmailHtml(sampleData);

  // Datos del paciente
  assert.ok(html.includes('Pamela Gajardo Burgos'));
  assert.ok(html.includes('+56 9 5999 0388'));
  assert.ok(html.includes('pamela.gajardo@gmail.com'));
  assert.ok(html.includes('16.789.123-4'));
  assert.ok(html.includes('bk_test_prof_02'));

  // Acción rápida 1: Enlace directo de WhatsApp al paciente con mensaje predeterminado
  assert.ok(html.includes('wa.me/56959990388'));

  // Acción rápida 2: Enlace directo para llamar al paciente
  assert.ok(html.includes('tel:'));

  // Acción rápida 3: Enlace para añadir a Google Calendar
  assert.ok(html.includes('calendar.google.com/calendar/render'));

  // Acción rápida 4: Enlace al panel de agenda clínica
  assert.ok(html.includes('https://centrovidasana.cl/agenda'));
});

test('EMAIL-03: Notificación adapta estilo y colores según el profesional asignado', () => {
  // Caso Felipe Méndez (Quiropraxia - Azul Petróleo #134E5E)
  const felipeHtml = renderBookingEmailHtml({
    bookingId: 'bk_felipe',
    professionalId: 'felipe',
    startAt: '2026-11-12T14:00:00Z',
    patient: {
      name: 'Carlos Muñoz',
      phone: '+56912345678',
      email: 'carlos@test.com'
    }
  });

  assert.ok(felipeHtml.includes('Felipe Méndez'));
  assert.ok(felipeHtml.includes('Quiropraxia y Kinesiología Clínica'));
  assert.ok(felipeHtml.includes('#134E5E'));

  // Caso Eduardo Lagos (Acupuntura - Verde Salvia #2E4D38)
  const eduardoHtml = renderBookingEmailHtml({
    bookingId: 'bk_eduardo',
    professionalId: 'eduardo',
    startAt: '2026-11-12T15:00:00Z',
    patient: {
      name: 'Andrea Morales',
      phone: '+56987654321',
      email: 'andrea@test.com'
    }
  });

  assert.ok(eduardoHtml.includes('Eduardo Lagos'));
  assert.ok(eduardoHtml.includes('Acupuntura y Medicina Tradicional China'));
  assert.ok(eduardoHtml.includes('#2E4D38'));
});

test('EMAIL-04: Notificación maneja pacientes sin RUT sin romper el layout', () => {
  const html = renderBookingEmailHtml({
    bookingId: 'bk_sin_rut',
    professionalId: 'felipe',
    startAt: '2026-11-12T14:00:00Z',
    patient: {
      name: 'Paciente Sin RUT',
      phone: '+56900000000',
      email: 'sinrut@test.com'
    }
  });

  assert.ok(html.includes('Paciente Sin RUT'));
  assert.ok(!html.includes('undefined'));
  assert.ok(!html.includes('null'));
});
