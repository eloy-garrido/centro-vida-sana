/**
 * Centro Vida Sana Austral — Tests Contractuales de Agendamiento (S09 / P08)
 * Verifica las garantías contractuales de tipos, validaciones, RUT, idempotencia y privacidad.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cleanRut,
  validateChileanRut,
  formatChileanRut,
  validateDocument,
  isValidRfc3339Utc,
  isAlignedToHour,
  calculateSlotEnd,
  isAllowedProfessional,
  validateStrictPayload,
  formatWhatsAppPhone,
  buildWhatsAppLink
} from '../../src/lib/agendamiento/validation.ts';

import {
  ALLOWED_PROFESSIONALS,
  CLINIC_TIMEZONE,
  SLOT_DURATION_SECONDS,
  TEAM_ALLOWED_EMAILS,
  type CreateBookingRequest,
  type SavePatientProfileRequest
} from '../../src/lib/agendamiento/types.ts';

import {
  mockAnonymousSession,
  mockPatientSession,
  mockTeamAdminSession,
  mockConfirmedBooking,
  mockTeamBlockEntry,
  getSlotsForDate,
  generateCalendarExportUrls
} from '../../src/lib/agendamiento/mocks.ts';

// ============================================================================
// 1. TESTS DE RUT Y DOCUMENTOS (S02 / D05)
// ============================================================================

test('RUT Chileno: validación canónica Módulo 11', () => {
  // Casos válidos conocidos
  assert.strictEqual(validateChileanRut('16.789.012-1'), true);
  assert.strictEqual(validateChileanRut('16789012-1'), true);
  assert.strictEqual(validateChileanRut('167890121'), true);
  assert.strictEqual(validateChileanRut('15.000.005-K'), true);
  assert.strictEqual(validateChileanRut('15000005k'), true);
  assert.strictEqual(validateChileanRut('30.686.957-4'), true);
  assert.strictEqual(validateChileanRut('30686957-4'), true);
  assert.strictEqual(validateChileanRut('11.111.111-1'), true);

  // Casos inválidos (dígito verificador incorrecto)
  assert.strictEqual(validateChileanRut('16.789.012-4'), false);
  assert.strictEqual(validateChileanRut('15.000.005-3'), false);
  assert.strictEqual(validateChileanRut('11.111.111-2'), false);
  assert.strictEqual(validateChileanRut('12345678-9'), false);
  assert.strictEqual(validateChileanRut(''), false);
  assert.strictEqual(validateChileanRut('abc'), false);
});

test('RUT Chileno: formateo estándar XX.XXX.XXX-X', () => {
  assert.strictEqual(formatChileanRut('167890121'), '16.789.012-1');
  assert.strictEqual(formatChileanRut('15000005K'), '15.000.005-K');
  assert.strictEqual(formatChileanRut('306869574'), '30.686.957-4');
  assert.strictEqual(formatChileanRut('111111111'), '11.111.111-1');
});

test('Documento: soporte para RUT y Pasaporte (D05)', () => {
  // RUT válido
  const rutVal = validateDocument('16.789.012-1', 'rut');
  assert.strictEqual(rutVal.valid, true);
  assert.strictEqual(rutVal.formatted, '16.789.012-1');

  // RUT con K válido
  const rutK = validateDocument('15000005k', 'rut');
  assert.strictEqual(rutK.valid, true);
  assert.strictEqual(rutK.formatted, '15.000.005-K');

  // RUT inválido
  const rutInval = validateDocument('16.789.012-9', 'rut');
  assert.strictEqual(rutInval.valid, false);
  assert.strictEqual(rutInval.error, 'INVALID_RUT_FORMAT');

  // Pasaporte válido
  const passVal = validateDocument('FR-99887766', 'passport');
  assert.strictEqual(passVal.valid, true);
  assert.strictEqual(passVal.formatted, 'FR-99887766');

  // Pasaporte inválido (caracteres raros)
  const passInval = validateDocument('PASS$$@', 'passport');
  assert.strictEqual(passInval.valid, false);
  assert.strictEqual(passInval.error, 'INVALID_PASSPORT_FORMAT');
});

// ============================================================================
// 2. TESTS DE RECHAZO DE CAMPOS DESCONOCIDOS (S09 L12)
// ============================================================================

test('Contratos S09: rechazo de campos desconocidos o privilegios inyectados', () => {
  const allowedKeys = ['professionalId', 'startAt', 'patient', 'consentVersion'] as const;
  const requiredKeys = ['professionalId', 'startAt', 'patient', 'consentVersion'] as const;

  // Payload válido
  const validPayload = {
    professionalId: 'felipe',
    startAt: '2026-11-06T13:00:00.000Z',
    patient: {
      name: 'Camila González',
      email: 'camila@example.com',
      rut: '16.789.012-1',
      documentType: 'rut'
    },
    consentVersion: 'v1.0'
  };

  const res1 = validateStrictPayload<CreateBookingRequest>(
    validPayload,
    allowedKeys,
    requiredKeys
  );
  assert.strictEqual(res1.valid, true);
  assert.strictEqual(res1.errors, undefined);

  // Payload con inyección de campos privilegiados ('role', 'duration', 'calendarId')
  const maliciousPayload = {
    ...validPayload,
    role: 'admin',
    calendarId: 'primary',
    duration: 120
  };

  const res2 = validateStrictPayload(maliciousPayload, allowedKeys, requiredKeys);
  assert.strictEqual(res2.valid, false);
  assert.ok(res2.errors?.role === 'UNRECOGNIZED_FIELD');
  assert.ok(res2.errors?.calendarId === 'UNRECOGNIZED_FIELD');
  assert.ok(res2.errors?.duration === 'UNRECOGNIZED_FIELD');
});

// ============================================================================
// 3. TESTS DE HORAS, ALINEACIÓN Y DURACIÓN (S03 / S09 / D01)
// ============================================================================

test('Slots: duración de 60 minutos exactos y formato RFC3339 UTC', () => {
  const startAt = '2026-11-06T12:00:00.000Z';
  assert.strictEqual(isValidRfc3339Utc(startAt), true);
  assert.strictEqual(isAlignedToHour(startAt), true);

  const endAt = calculateSlotEnd(startAt);
  assert.strictEqual(endAt, '2026-11-06T13:00:00.000Z');

  // No alineado a la hora
  assert.strictEqual(isAlignedToHour('2026-11-06T12:30:00.000Z'), false);
  // No UTC Z
  assert.strictEqual(isValidRfc3339Utc('2026-11-06T12:00:00-03:00'), false);
});

test('Jornadas oficiales D01: 11 turnos L-V, 5 turnos sábado, 0 domingo', () => {
  // Viernes 2026-11-06
  const slotsFriday = getSlotsForDate('2026-11-06');
  assert.strictEqual(slotsFriday.length, 11, 'Viernes debe tener 11 turnos');

  // Sábado 2026-11-07
  const slotsSaturday = getSlotsForDate('2026-11-07');
  assert.strictEqual(slotsSaturday.length, 5, 'Sábado debe tener 5 turnos');

  // Domingo 2026-11-08
  const slotsSunday = getSlotsForDate('2026-11-08');
  assert.strictEqual(slotsSunday.length, 0, 'Domingo debe estar cerrado');
});

// ============================================================================
// 4. TESTS DE PRIVACIDAD EN COPIA A CALENDARIO PERSONAL (S06 / D06)
// ============================================================================

test('Privacidad S06: copia a calendario no expone RUT ni datos clínicos', () => {
  const { googleUrl } = generateCalendarExportUrls(mockConfirmedBooking);
  const parsed = new URL(googleUrl);

  const title = parsed.searchParams.get('text') || '';
  const details = parsed.searchParams.get('details') || '';

  // Verificar que el RUT de Camila ('16.789.012-1') NUNCA aparezca en la URL
  assert.strictEqual(googleUrl.includes('16.789.012-1'), false);
  assert.strictEqual(googleUrl.includes('167890121'), false);

  // Verificar que el teléfono tampoco aparezca
  assert.strictEqual(googleUrl.includes('76543210'), false);

  // Verificar datos institucionales correctos
  assert.ok(title.includes('Centro Vida Sana Austral'));
  assert.ok(title.includes('Felipe Méndez'));
  assert.ok(details.includes('Centro Vida Sana Austral'));
});

// ============================================================================
// 5. TESTS DE CAPACIDADES DE SESIÓN Y EQUIPO (S01 / S05 / D03)
// ============================================================================

test('Sesiones S01/S05: distinción de capacidades entre paciente y equipo', () => {
  assert.strictEqual(mockAnonymousSession.authenticated, false);

  if (mockPatientSession.authenticated) {
    assert.strictEqual(mockPatientSession.capabilities.teamAgenda, false);
    assert.strictEqual(mockPatientSession.user.email, 'camila.gonzalez@gmail.com');
  }

  if (mockTeamAdminSession.authenticated) {
    assert.strictEqual(mockTeamAdminSession.capabilities.teamAgenda, true);
    assert.strictEqual(
      mockTeamAdminSession.user.email,
      TEAM_ALLOWED_EMAILS[0],
      'El correo del admin coincide con la allowlist oficial'
    );
  }
});

test('Profesionales permitidos: exactamente felipe y eduardo', () => {
  assert.strictEqual(isAllowedProfessional('felipe'), true);
  assert.strictEqual(isAllowedProfessional('eduardo'), true);
  assert.strictEqual(isAllowedProfessional('juan'), false);
  assert.strictEqual(isAllowedProfessional(''), false);
});

// ============================================================================
// 6. TESTS DE CONTACTO WHATSAPP (wa.me)
// ============================================================================

test('WhatsApp: normalización de teléfonos chilenos e internacionales para wa.me', () => {
  // Móvil chileno estándar con código país
  assert.strictEqual(formatWhatsAppPhone('+56 9 7370 0616'), '56973700616');
  assert.strictEqual(formatWhatsAppPhone('+56973700616'), '56973700616');
  assert.strictEqual(formatWhatsAppPhone('+56-9-7370-0616'), '56973700616');

  // Móvil chileno 9 dígitos sin código país (9XXXXXXXX)
  assert.strictEqual(formatWhatsAppPhone('973700616'), '56973700616');
  assert.strictEqual(formatWhatsAppPhone('9 7370 0616'), '56973700616');

  // Marcación local 09XXXXXXXX
  assert.strictEqual(formatWhatsAppPhone('09 7370 0616'), '56973700616');

  // Teléfono 8 dígitos
  assert.strictEqual(formatWhatsAppPhone('73700616'), '56973700616');

  // Número internacional
  assert.strictEqual(formatWhatsAppPhone('+33 1 23 45 67 89'), '33123456789');

  // Inválidos o incompletos
  assert.strictEqual(formatWhatsAppPhone(''), null);
  assert.strictEqual(formatWhatsAppPhone('abc'), null);
  assert.strictEqual(formatWhatsAppPhone('12345'), null);
  assert.strictEqual(formatWhatsAppPhone(undefined), null);
});

test('WhatsApp: generación de enlaces wa.me con o sin mensaje predefinido', () => {
  // Enlace simple
  const linkSimple = buildWhatsAppLink('+56 9 7370 0616');
  assert.strictEqual(linkSimple, 'https://wa.me/56973700616');

  // Enlace con texto codificado
  const linkWithText = buildWhatsAppLink('+56 9 7370 0616', 'Hola Camila, te contactamos de Centro Vida Sana');
  assert.strictEqual(
    linkWithText,
    'https://wa.me/56973700616?text=Hola%20Camila%2C%20te%20contactamos%20de%20Centro%20Vida%20Sana'
  );

  // Teléfono inválido retorna null
  assert.strictEqual(buildWhatsAppLink('123', 'Mensaje'), null);
});

