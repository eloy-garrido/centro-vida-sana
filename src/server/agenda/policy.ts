/**
 * Centro Vida Sana Austral — Políticas de Jornadas, Horarios y Ventanas
 * Conforme a S03 (motor de agenda) y Decisiones D01, D02, D04.
 */

import {
  CLINIC_TIMEZONE,
  SLOT_DURATION_SECONDS,
  type ProfessionalId
} from '../../lib/agendamiento/types.ts';
import { ApiCommandError } from './errors.ts';

const CHILE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: CLINIC_TIMEZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hour12: false
});

/**
 * Obtiene los componentes de fecha y hora locales en la zona horaria de Chile (America/Santiago).
 */
export function getChileTime(date: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
} {
  const parts = CHILE_FORMATTER.formatToParts(date);
  const partMap: Record<string, number> = {};

  for (const part of parts) {
    if (part.type !== 'literal') {
      partMap[part.type] = parseInt(part.value, 10);
    }
  }

  // Corregir formato si el formateador entrega hora 24
  let hour = partMap.hour ?? 0;
  if (hour === 24) hour = 0;

  // Calcular día de la semana local en Chile
  // Construimos una fecha UTC a mediodía para calcular el día de la semana sin problemas de DST
  const localDateObj = new Date(Date.UTC(partMap.year, partMap.month - 1, partMap.day, 12, 0, 0));
  const weekday = localDateObj.getUTCDay();

  return {
    year: partMap.year,
    month: partMap.month,
    day: partMap.day,
    hour,
    minute: partMap.minute ?? 0,
    weekday
  };
}

/**
 * Devuelve la fecha local de Chile en formato YYYY-MM-DD para un timestamp Unix en segundos.
 */
export function getChileDateString(utcSeconds: number): string {
  const t = getChileTime(new Date(utcSeconds * 1000));
  const m = String(t.month).padStart(2, '0');
  const d = String(t.day).padStart(2, '0');
  return `${t.year}-${m}-${d}`;
}

/**
 * Convierte una fecha y hora local de Chile a un Unix timestamp UTC (en segundos).
 * Usa aproximación segura y refinamiento de dos pasadas con Intl para garantizar exactitud con DST e invierno UTC-4.
 */
export function chileLocalToUtcSeconds(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0
): number {
  // Estimación inicial en UTC+0
  let guessDate = new Date(Date.UTC(year, month - 1, day, hour + 3, minute, 0));
  const targetUtc = Date.UTC(year, month - 1, day, hour, minute, 0);

  // Pasada 1 de alineación de desfase horario
  let localParts = getChileTime(guessDate);
  let currentLocalUtc = Date.UTC(localParts.year, localParts.month - 1, localParts.day, localParts.hour, localParts.minute, 0);
  let diffMs = targetUtc - currentLocalUtc;
  if (diffMs !== 0) {
    guessDate = new Date(guessDate.getTime() + diffMs);
  }

  // Pasada 2 de refinamiento (por si el salto cruza una transición de cambio de hora DST)
  localParts = getChileTime(guessDate);
  currentLocalUtc = Date.UTC(localParts.year, localParts.month - 1, localParts.day, localParts.hour, localParts.minute, 0);
  diffMs = targetUtc - currentLocalUtc;
  if (diffMs !== 0) {
    guessDate = new Date(guessDate.getTime() + diffMs);
  }

  return Math.floor(guessDate.getTime() / 1000);
}

/**
 * Verifica si un horario corresponde a una jornada oficial aprobada en D01:
 * - Lunes a Viernes: 09:00 a 21:00 con colación 13:00 a 14:00 (11 turnos)
 * - Sábados: 09:00 a 14:00 continuo (5 turnos)
 * - Domingos: Cerrado
 */
export function isValidWorkingSlot(startSeconds: number): boolean {
  const date = new Date(startSeconds * 1000);
  const { weekday, hour, minute } = getChileTime(date);

  // Cada slot debe iniciar exactamente en el minuto 00
  if (minute !== 0) {
    return false;
  }

  // Domingos cerrado
  if (weekday === 0) {
    return false;
  }

  // Sábados: 09:00 a 14:00 (turnos: 9, 10, 11, 12, 13)
  if (weekday === 6) {
    return hour >= 9 && hour < 14;
  }

  // Lunes a Viernes: 09:00 a 21:00 excepto colación 13:00 a 14:00
  if (weekday >= 1 && weekday <= 5) {
    if (hour === 13) {
      return false; // Pausa de colación
    }
    return hour >= 9 && hour < 21;
  }

  return false;
}

/**
 * Verifica si la fecha del slot está dentro de la ventana autorizada para el paciente (D02):
 * - Desde mañana (D+1) hasta 7 días inclusive (D+7) en fecha local de Chile.
 */
export function isWithinPatientBookingWindow(
  slotSeconds: number,
  nowSeconds = Math.floor(Date.now() / 1000)
): boolean {
  const slotDate = new Date(slotSeconds * 1000);
  const nowDate = new Date(nowSeconds * 1000);

  const slotLocal = getChileTime(slotDate);
  const nowLocal = getChileTime(nowDate);

  // Comparar días de calendario en Chile
  const startOfNowChile = new Date(Date.UTC(nowLocal.year, nowLocal.month - 1, nowLocal.day, 0, 0, 0));
  const startOfSlotChile = new Date(Date.UTC(slotLocal.year, slotLocal.month - 1, slotLocal.day, 0, 0, 0));

  const diffDays = Math.round(
    (startOfSlotChile.getTime() - startOfNowChile.getTime()) / (24 * 60 * 60 * 1000)
  );

  // D+1 a D+7 inclusive
  return diffDays >= 1 && diffDays <= 7;
}

/**
 * Verifica si la fecha está dentro de la ventana autorizada para el equipo (D04):
 * - Permite agendar hoy (D+0) y dentro del mes corriente (o primeros 7 días del mes siguiente, hasta 31 días hacia adelante).
 */
export function isWithinTeamBookingWindow(
  slotSeconds: number,
  nowSeconds = Math.floor(Date.now() / 1000)
): boolean {
  const slotDate = new Date(slotSeconds * 1000);
  const nowDate = new Date(nowSeconds * 1000);

  const slotLocal = getChileTime(slotDate);
  const nowLocal = getChileTime(nowDate);

  // No permitir fechas en el pasado anterior a hoy en Chile
  const startOfNowChile = new Date(Date.UTC(nowLocal.year, nowLocal.month - 1, nowLocal.day, 0, 0, 0));
  const startOfSlotChile = new Date(Date.UTC(slotLocal.year, slotLocal.month - 1, slotLocal.day, 0, 0, 0));

  const diffDays = Math.round(
    (startOfSlotChile.getTime() - startOfNowChile.getTime()) / (24 * 60 * 60 * 1000)
  );

  if (diffDays < 0 || diffDays > 31) {
    return false;
  }

  // Mismo año y mes corriente, o primeros 7 días del mes siguiente inmediato
  const isSameMonth = slotLocal.year === nowLocal.year && slotLocal.month === nowLocal.month;
  const isNextMonthNear =
    ((slotLocal.year === nowLocal.year && slotLocal.month === nowLocal.month + 1) ||
      (slotLocal.year === nowLocal.year + 1 && nowLocal.month === 12 && slotLocal.month === 1)) &&
    slotLocal.day <= 7;

  return isSameMonth || isNextMonthNear;
}

/**
 * Valida un rango de fechas [fromDate, toDate] verificando formato YYYY-MM-DD,
 * que toDate > fromDate y que el rango no supere maxDays días.
 * Retorna los límites de tiempo Unix en segundos calculados con precisión local de Chile.
 */
export function validateDateRange(
  fromDate: string,
  toDate: string,
  maxDays = 35
): { fromSec: number; toSec: number } {
  if (!fromDate || !toDate || typeof fromDate !== 'string' || typeof toDate !== 'string') {
    throw new ApiCommandError('VALIDATION_ERROR', 'Parámetros fromDate y toDate requeridos.', 400);
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(fromDate) || !dateRegex.test(toDate)) {
    throw new ApiCommandError('VALIDATION_ERROR', 'Formato de fecha inválido. Debe ser YYYY-MM-DD.', 400);
  }

  const [fY, fM, fD] = fromDate.split('-').map(Number);
  const [tY, tM, tD] = toDate.split('-').map(Number);

  const fUtc = Date.UTC(fY, fM - 1, fD);
  const tUtc = Date.UTC(tY, tM - 1, tD);
  const diffDays = Math.round((tUtc - fUtc) / (24 * 3600 * 1000));

  if (diffDays <= 0) {
    throw new ApiCommandError('VALIDATION_ERROR', 'toDate debe ser estrictamente posterior a fromDate.', 400);
  }

  if (diffDays > maxDays) {
    throw new ApiCommandError(
      'VALIDATION_ERROR',
      `El rango de fechas no puede exceder ${maxDays} días.`,
      400
    );
  }

  const fromSec = chileLocalToUtcSeconds(fY, fM, fD, 0, 0);
  const toSec = chileLocalToUtcSeconds(tY, tM, tD, 0, 0);

  return { fromSec, toSec };
}

/**
 * Genera todos los slots oficiales de atención para una fecha específica (YYYY-MM-DD en Chile).
 */
export function generateDaySlotsUtc(dateStr: string): { startAt: number; endAt: number }[] {
  const [year, month, day] = dateStr.split('-').map(Number);
  const slots: { startAt: number; endAt: number }[] = [];

  // Probar cada hora del día de 0 a 23
  for (let hour = 0; hour < 24; hour++) {
    const startSec = chileLocalToUtcSeconds(year, month, day, hour, 0);
    if (isValidWorkingSlot(startSec)) {
      slots.push({
        startAt: startSec,
        endAt: startSec + SLOT_DURATION_SECONDS
      });
    }
  }

  return slots;
}
