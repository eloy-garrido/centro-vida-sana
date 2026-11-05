/**
 * Centro Vida Sana Austral — Servicio de Disponibilidad
 * Conforme a S03 (cálculo de cupos y exclusión de citas activas) y S09.
 */

import {
  CLINIC_TIMEZONE,
  type AvailabilityResponse,
  type ProfessionalId,
  type TimeSlot
} from '../../lib/agendamiento/types.ts';
import type { DatabaseAdapter } from '../db/adapter.ts';
import {
  generateDaySlotsUtc,
  isWithinPatientBookingWindow
} from './policy.ts';

/**
 * Consulta la disponibilidad de cupos de un profesional en un rango de fechas [from, to).
 * REGLA DE PRIVACIDAD ESTRICTA (S03 L18 / S09 L26):
 * La respuesta solo contiene fechas y horas disponibles; NUNCA nombres, identidades
 * ni datos personales de otras citas reservadas.
 */
export async function getAvailableSlots(
  db: DatabaseAdapter,
  params: {
    professionalId: ProfessionalId;
    fromDate: string; // YYYY-MM-DD
    toDate: string;   // YYYY-MM-DD
    nowSeconds?: number;
    forTeam?: boolean;
  }
): Promise<AvailabilityResponse> {
  const now = params.nowSeconds ?? Math.floor(Date.now() / 1000);

  // 1. Iterar sobre los días del rango [fromDate, toDate)
  const candidateSlots: { startAt: number; endAt: number }[] = [];

  const [fromY, fromM, fromD] = params.fromDate.split('-').map(Number);
  const [toY, toM, toD] = params.toDate.split('-').map(Number);

  const curDate = new Date(Date.UTC(fromY, fromM - 1, fromD));
  const endDate = new Date(Date.UTC(toY, toM - 1, toD));

  while (curDate < endDate) {
    const y = curDate.getUTCFullYear();
    const m = (curDate.getUTCMonth() + 1).toString().padStart(2, '0');
    const d = curDate.getUTCDate().toString().padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    const daySlots = generateDaySlotsUtc(dateStr);
    for (const slot of daySlots) {
      // Para pacientes, aplicar filtro de ventana D+1 a D+7 (D02)
      if (!params.forTeam && !isWithinPatientBookingWindow(slot.startAt, now)) {
        continue;
      }
      candidateSlots.push(slot);
    }

    curDate.setUTCDate(curDate.getUTCDate() + 1);
  }

  if (candidateSlots.length === 0) {
    return {
      professionalId: params.professionalId,
      timeZone: CLINIC_TIMEZONE,
      eligibleDateRange: {
        from: params.fromDate,
        to: params.toDate
      },
      slots: [],
      generatedAt: new Date(now * 1000).toISOString()
    };
  }

  // 2. Consultar en D1 las citas activas del profesional en el rango
  const minStart = candidateSlots[0].startAt;
  const maxEnd = candidateSlots[candidateSlots.length - 1].endAt;

  const busyEntries = await db.all<{ start_at: number; end_at: number }>(
    `SELECT start_at, end_at
     FROM agenda_entries
     WHERE professional_id = ?
       AND status = 'confirmed'
       AND start_at < ?
       AND end_at > ?`,
    params.professionalId,
    maxEnd,
    minStart
  );

  // 3. Filtrar los slots que colisionen con citas activas o bloqueos
  const availableSlots: TimeSlot[] = [];

  for (const slot of candidateSlots) {
    const isOccupied = busyEntries.some(
      (busy) => busy.start_at < slot.endAt && busy.end_at > slot.startAt
    );

    if (!isOccupied) {
      availableSlots.push({
        startAt: new Date(slot.startAt * 1000).toISOString(),
        endAt: new Date(slot.endAt * 1000).toISOString()
      });
    }
  }

  return {
    professionalId: params.professionalId,
    timeZone: CLINIC_TIMEZONE,
    eligibleDateRange: {
      from: params.fromDate,
      to: params.toDate
    },
    slots: availableSlots,
    generatedAt: new Date(now * 1000).toISOString()
  };
}
