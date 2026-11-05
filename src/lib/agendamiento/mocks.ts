/**
 * Centro Vida Sana Austral — Mocks y fixtures canónicos de agendamiento
 * Conforme a S01–S09, D01–D07 y arnés de pruebas QA P08.
 */

import {
  CLINIC_TIMEZONE,
  WORKING_SCHEDULE_CONFIG,
  type BookingDetail,
  type CalendarExportUrls,
  type MutationResult,
  type PatientProfile,
  type PatientSnapshot,
  type ProfessionalId,
  type ResolveCommandResponse,
  type SessionResponse,
  type TeamScheduleEntry,
  type TimeSlot
} from './types.ts';
import { calculateSlotEnd } from './validation.ts';

// ============================================================================
// 1. SESIONES CANÓNICAS SIMULADAS (S01 / S09)
// ============================================================================

export const mockAnonymousSession: SessionResponse = {
  authenticated: false
};

export const mockPatientSession: SessionResponse = {
  authenticated: true,
  user: {
    id: 'usr_pat_987654321',
    name: 'Camila González',
    email: 'camila.gonzalez@gmail.com'
  },
  capabilities: {
    teamAgenda: false
  },
  csrfToken: 'csrf_tok_mock_patient_xyz123'
};

export const mockTeamAdminSession: SessionResponse = {
  authenticated: true,
  user: {
    id: 'usr_adm_123456789',
    name: 'Centro Vida Sana Austral',
    email: 'centrovida.sanaaustral@gmail.com'
  },
  capabilities: {
    teamAgenda: true
  },
  csrfToken: 'csrf_tok_mock_team_abc789'
};

// ============================================================================
// 2. PERFILES DE PACIENTE RECORDADOS (S02 / D05)
// ============================================================================

export const mockPatientProfile: PatientProfile = {
  name: 'Camila González',
  email: 'camila.gonzalez@gmail.com',
  rut: '16.789.012-1',
  documentType: 'rut',
  phone: '+56976543210',
  consentVersion: 'v1.0-2026-11',
  updatedAt: '2026-11-05T12:00:00Z'
};

export const mockForeignPatientProfile: PatientProfile = {
  name: 'Jean-Luc Picard',
  email: 'jeanluc@example.com',
  rut: 'FR-99887766',
  documentType: 'passport',
  phone: '+33123456789',
  consentVersion: 'v1.0-2026-11',
  updatedAt: '2026-11-05T12:30:00Z'
};

// ============================================================================
// 3. GENERADOR DE SLOTS DE DISPONIBILIDAD (D01 / S03)
// ============================================================================

/**
 * Genera slots para un día específico basándose en la configuración horaria oficial:
 * L-V: 09:00 a 21:00 (pausa 13:00-14:00, 11 turnos)
 * Sábados: 09:00 a 14:00 (5 turnos continuos)
 * Domingos: Cerrado (0 turnos)
 */
export function getSlotsForDate(dateStr: string): TimeSlot[] {
  // dateStr en formato 'YYYY-MM-DD'
  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = dateObj.getUTCDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado

  // Domingo cerrado
  if (dayOfWeek === 0) {
    return [];
  }

  const hours: number[] = [];

  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    // Lunes a Viernes: 09:00 a 13:00 y 14:00 a 21:00 (en hora local Chile)
    // 09, 10, 11, 12 (colación 13), 14, 15, 16, 17, 18, 19, 20
    for (let h = 9; h < 21; h++) {
      if (h !== 13) {
        hours.push(h);
      }
    }
  } else if (dayOfWeek === 6) {
    // Sábado: 09:00 a 14:00
    // 09, 10, 11, 12, 13
    for (let h = 9; h < 14; h++) {
      hours.push(h);
    }
  }

  // En horario de invierno Chile es UTC-4, en verano UTC-3.
  // Para mock estandarizado usamos offset UTC-3 (verano en noviembre en Chile)
  const offsetHours = 3;

  return hours.map((localHour) => {
    const utcH = localHour + offsetHours;
    const pad = (n: number) => n.toString().padStart(2, '0');
    const startAt = `${year}-${pad(month)}-${pad(day)}T${pad(utcH)}:00:00.000Z`;
    return {
      startAt,
      endAt: calculateSlotEnd(startAt)
    };
  });
}

// ============================================================================
// 4. FIXTURES DE RESERVAS Y BLOQUEOS (S03 / S05)
// ============================================================================

export const mockConfirmedBooking: BookingDetail = {
  id: 'bkg_conf_abc123456789',
  professionalId: 'felipe',
  startAt: '2026-11-06T13:00:00.000Z',
  endAt: '2026-11-06T14:00:00.000Z',
  status: 'confirmed',
  version: '"v_bkg_1"',
  patient: {
    name: 'Camila González',
    email: 'camila.gonzalez@gmail.com',
    rut: '16.789.012-1',
    documentType: 'rut',
    phone: '+56976543210'
  },
  createdAt: '2026-11-05T13:00:00.000Z'
};

export const mockCancelledBooking: BookingDetail = {
  id: 'bkg_canc_xyz987654321',
  professionalId: 'eduardo',
  startAt: '2026-11-06T14:00:00.000Z',
  endAt: '2026-11-06T15:00:00.000Z',
  status: 'cancelled',
  version: '"v_bkg_canc_2"',
  patient: {
    name: 'Pedro Soto',
    email: 'pedro.soto@gmail.com',
    rut: '18.901.234-5',
    documentType: 'rut'
  },
  createdAt: '2026-11-05T12:00:00.000Z'
};

export const mockTeamBlockEntry: TeamScheduleEntry = {
  id: 'blk_team_999888777',
  kind: 'block',
  professionalId: 'felipe',
  startAt: '2026-11-06T15:00:00.000Z',
  endAt: '2026-11-06T16:00:00.000Z',
  status: 'confirmed',
  version: '"v_blk_1"'
};

// ============================================================================
// 5. RECEPCIÓN Y RESOLVE DE IDEMPOTENCIA (S09 / P03)
// ============================================================================

export const mockCommittedReceipt: ResolveCommandResponse = {
  status: 'committed',
  httpStatus: 201,
  commandId: 'cmd_idemp_rec_001',
  result: {
    resourceId: 'bkg_conf_abc123456789',
    kind: 'appointment',
    version: '"v_bkg_1"'
  }
};

export const mockNotFoundReceipt: ResolveCommandResponse = {
  status: 'not_found'
};

// ============================================================================
// 6. GENERADOR DE COPIA DE CALENDARIO SEGURO (S06 / D06)
// ============================================================================

/**
 * Genera el enlace de Google Calendar y la URL para descarga de ICS.
 * REGLA DE PRIVACIDAD OBLIGATORIA (S06):
 * NUNCA incluir RUT ni datos clínicos en el título, descripción ni URL.
 */
export function generateCalendarExportUrls(booking: BookingDetail): CalendarExportUrls {
  const proTitle =
    booking.professionalId === 'felipe'
      ? 'Felipe Méndez (Quiropraxia & Kinesiología)'
      : 'Eduardo Lagos (Acupuntura & MTC)';

  const title = `Cita en Centro Vida Sana Austral — ${proTitle}`;
  const location = 'Los Armiños 1620, Temuco, Chile';
  const description =
    'Atención agendada en Centro Vida Sana Austral. Recuerda llegar 5 minutos antes.';

  // Formato Google Calendar: YYYYMMDDTHHmmssZ
  const formatGoogleDate = (isoStr: string) =>
    isoStr.replace(/[-:]/g, '').split('.')[0] + 'Z';

  const datesParam = `${formatGoogleDate(booking.startAt)}/${formatGoogleDate(booking.endAt)}`;

  const googleUrl = new URL('https://calendar.google.com/calendar/render');
  googleUrl.searchParams.set('action', 'TEMPLATE');
  googleUrl.searchParams.set('text', title);
  googleUrl.searchParams.set('dates', datesParam);
  googleUrl.searchParams.set('details', description);
  googleUrl.searchParams.set('location', location);

  return {
    googleUrl: googleUrl.toString(),
    icsDownloadUrl: `/api/bookings/${booking.id}/calendar?format=ics`
  };
}
