/**
 * Centro Vida Sana Austral — Consulta de Detalles de Reserva y Exportación a Calendario (S04 / S05 / S06 / S09)
 */

import type { DatabaseAdapter } from '../db/adapter.ts';
import { ApiCommandError } from './commands.ts';
import { generateCalendarExportUrls } from '../../lib/agendamiento/mocks.ts';
import type { ProfessionalId } from '../../lib/agendamiento/types.ts';
import { decryptPiiJson } from '../auth/crypto.ts';

const CALENDAR_DISCLAIMER =
  'Se añadirá una copia. Si la hora cambia o se cancela, debes actualizar tu calendario personal.';

export interface BookingDetailResult {
  booking: {
    id: string;
    professionalId: ProfessionalId;
    startAt: string;
    endAt: string;
    status: 'confirmed' | 'cancelled';
    version: string;
    patient?: {
      name: string;
      email: string;
      rut: string;
      documentType: 'rut' | 'passport';
      phone?: string;
    };
  };
}

export interface CalendarExportResult {
  googleUrl: string;
  icsUrl: string;
  warning: string;
  bookingVersion: string;
}

/**
 * Recupera el detalle de una reserva solo si el actor es el dueño reservante o miembro del equipo.
 */
export async function getBookingDetails(
  db: DatabaseAdapter,
  bookingId: string,
  actor: { id: string; isTeam: boolean }
): Promise<BookingDetailResult> {
  const row = await db.first<{
    id: string;
    kind: string;
    professional_id: string;
    start_at: number;
    end_at: number;
    status: string;
    version: string;
    booked_by_user_id: string | null;
    encrypted_snapshot: string | null;
  }>("SELECT * FROM agenda_entries WHERE id = ? AND kind = 'appointment'", bookingId);

  // Aislamiento: Si no existe, o si no es equipo y no es el dueño reservante -> 404
  if (!row || (!actor.isTeam && row.booked_by_user_id !== actor.id)) {
    throw new ApiCommandError('NOT_FOUND', 'Reserva no encontrada.', 404);
  }

  let patientData: any = undefined;
  if (row.encrypted_snapshot) {
    patientData = (await decryptPiiJson(row.encrypted_snapshot)) ?? undefined;
  }

  return {
    booking: {
      id: row.id,
      professionalId: row.professional_id as ProfessionalId,
      startAt: new Date(row.start_at * 1000).toISOString(),
      endAt: new Date(row.end_at * 1000).toISOString(),
      status: row.status as any,
      version: row.version,
      patient: patientData
    }
  };
}

/**
 * Obtiene los enlaces de exportación a calendario personal sin PII (S06).
 */
export async function getCalendarExportData(
  db: DatabaseAdapter,
  bookingId: string,
  actor: { id: string; isTeam: boolean }
): Promise<CalendarExportResult> {
  const row = await db.first<{
    id: string;
    professional_id: string;
    start_at: number;
    end_at: number;
    status: string;
    version: string;
    booked_by_user_id: string | null;
  }>('SELECT id, professional_id, start_at, end_at, status, version, booked_by_user_id FROM agenda_entries WHERE id = ?', bookingId);

  if (!row || (!actor.isTeam && row.booked_by_user_id !== actor.id)) {
    throw new ApiCommandError('NOT_FOUND', 'Reserva no encontrada.', 404);
  }

  if (row.status === 'cancelled') {
    throw new ApiCommandError(
      'BOOKING_CANCELLED',
      'No es posible exportar una cita que ha sido cancelada.',
      409
    );
  }

  const exportUrls = generateCalendarExportUrls({
    id: row.id,
    professionalId: row.professional_id as ProfessionalId,
    startAt: new Date(row.start_at * 1000).toISOString(),
    endAt: new Date(row.end_at * 1000).toISOString(),
    status: row.status as any,
    version: row.version,
    patient: {
      name: 'Paciente',
      email: '',
      rut: '',
      documentType: 'rut'
    }
  });

  return {
    googleUrl: exportUrls.googleUrl,
    icsUrl: `/api/bookings/${bookingId}/calendar?format=ics`,
    warning: CALENDAR_DISCLAIMER,
    bookingVersion: row.version
  };
}

/**
 * Genera el archivo .ics conforme a RFC 5545 sin datos sensibles de pacientes (S06).
 */
export async function generateIcsFileContent(
  db: DatabaseAdapter,
  bookingId: string,
  actor: { id: string; isTeam: boolean }
): Promise<string> {
  const row = await db.first<{
    id: string;
    professional_id: string;
    start_at: number;
    end_at: number;
    status: string;
    version: string;
    booked_by_user_id: string | null;
  }>('SELECT id, professional_id, start_at, end_at, status, version, booked_by_user_id FROM agenda_entries WHERE id = ?', bookingId);

  if (!row || (!actor.isTeam && row.booked_by_user_id !== actor.id)) {
    throw new ApiCommandError('NOT_FOUND', 'Reserva no encontrada.', 404);
  }

  if (row.status === 'cancelled') {
    throw new ApiCommandError('BOOKING_CANCELLED', 'Cita cancelada.', 409);
  }

  const proTitle =
    row.professional_id === 'felipe'
      ? 'Felipe Méndez (Quiropraxia & Kinesiología)'
      : 'Eduardo Lagos (Acupuntura & MTC)';

  const startIso = new Date(row.start_at * 1000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const endIso = new Date(row.end_at * 1000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const nowIso = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Centro Vida Sana Austral//Agenda Propia//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${row.id}@centrovidasana.cl`,
    `DTSTAMP:${nowIso}`,
    `DTSTART:${startIso}`,
    `DTEND:${endIso}`,
    `SUMMARY:Cita Centro Vida Sana — ${proTitle}`,
    'DESCRIPTION:Atención de salud en Centro Vida Sana Austral. Los Armiños 1620, Temuco. Rogamos puntualidad.',
    'LOCATION:Los Armiños 1620, Temuco, Chile',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}
