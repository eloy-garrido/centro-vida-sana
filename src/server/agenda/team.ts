/**
 * Centro Vida Sana Austral — Servicio de Gestión de Agenda de Equipo (S05 / D04 / D07 / S09)
 * Permite a administradores y profesionales gestionar las dos agendas con control de versiones.
 */

import type { DatabaseAdapter } from '../db/adapter.ts';
import { ApiCommandError, calculatePayloadFingerprint } from './commands.ts';
import { generateRandomString, encryptPiiJson, decryptPiiJson } from '../auth/crypto.ts';
import {
  type ProfessionalId,
  type CreateBookingRequest,
  type MutationResult,
  type AttendanceStatus,
  SLOT_DURATION_SECONDS
} from '../../lib/agendamiento/types.ts';
import {
  isAlignedToHour,
  isValidRfc3339Utc,
  validateDocument,
  validateEmail,
  validatePhone,
  isAllowedProfessional
} from '../../lib/agendamiento/validation.ts';
import {
  getChileDateString,
  getChileTime,
  isValidWorkingSlot,
  isWithinTeamBookingWindow,
  validateDateRange
} from './policy.ts';
import { getAvailableSlots } from './availability.ts';

export interface TeamScheduleEntry {
  id: string;
  kind: 'appointment' | 'block';
  professionalId: ProfessionalId;
  startAt: string;
  endAt: string;
  status: 'confirmed' | 'cancelled';
  attendanceStatus?: AttendanceStatus;
  version: string;
  patient?: {
    name: string;
    email: string;
    phone?: string;
  };
}

export interface TeamScheduleResult {
  professionalId: ProfessionalId;
  timeZone: string;
  eligibleDateRange: {
    from: string;
    to: string;
  };
  policy: {
    slotDurationMinutes: number;
    teamBookingPolicy: string;
  };
  availableSlots: Array<{ startAt: string; endAt: string }>;
  entries: TeamScheduleEntry[];
}

/**
 * Consulta la agenda del equipo para un profesional en un rango de fechas.
 * Regla de privacidad: El listado no expone el RUT del paciente.
 */
export async function getTeamSchedule(
  db: DatabaseAdapter,
  professionalId: ProfessionalId,
  fromDate: string,
  toDate: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): Promise<TeamScheduleResult> {
  const { fromSec, toSec } = validateDateRange(fromDate, toDate, 35);

  // 1. Obtener slots disponibles pasando forTeam: true (para incluir cupos de hoy D+0)
  const availability = await getAvailableSlots(db, {
    professionalId,
    fromDate,
    toDate,
    nowSeconds,
    forTeam: true
  });

  // 2. Obtener las entradas de agenda del intervalo acotado [fromSec, toSec) en SQL
  const rows = await db.all<{
    id: string;
    kind: string;
    professional_id: string;
    start_at: number;
    end_at: number;
    status: string;
    version: string;
    encrypted_snapshot: string | null;
    attendance_status: string | null;
  }>(
    `SELECT id, kind, professional_id, start_at, end_at, status, version, encrypted_snapshot, attendance_status
     FROM agenda_entries
     WHERE professional_id = ?
       AND start_at >= ?
       AND start_at < ?
     ORDER BY start_at ASC`,
    professionalId,
    fromSec,
    toSec
  );

  const entries: TeamScheduleEntry[] = [];

  for (const r of rows) {
    let patientSummary: { name: string; email: string; phone?: string } | undefined;
    if (r.kind === 'appointment' && r.encrypted_snapshot) {
      const snap = await decryptPiiJson<{ name?: string; email?: string; phone?: string }>(r.encrypted_snapshot);
      if (snap) {
        patientSummary = {
          name: snap.name || 'Paciente',
          email: snap.email || '',
          phone: snap.phone || ''
        };
      } else {
        patientSummary = { name: 'Paciente', email: '' };
      }
    }

    entries.push({
      id: r.id,
      kind: r.kind as any,
      professionalId: r.professional_id as ProfessionalId,
      startAt: new Date(r.start_at * 1000).toISOString(),
      endAt: new Date(r.end_at * 1000).toISOString(),
      status: r.status as any,
      attendanceStatus: (r.attendance_status as AttendanceStatus) || 'pending',
      version: r.version,
      patient: patientSummary
    });
  }

  return {
    professionalId,
    timeZone: 'America/Santiago',
    eligibleDateRange: {
      from: fromDate,
      to: toDate
    },
    policy: {
      slotDurationMinutes: 60,
      teamBookingPolicy: 'D04: Permite agendamiento hoy (D+0) y dentro del mes corriente'
    },
    availableSlots: availability.slots,
    entries
  };
}

/**
 * Agendamiento manual por parte de un miembro del equipo (S05 / D04).
 * Permite agendar hoy (D+0) y dentro del mes corriente.
 */
export async function executeTeamBookingCommand(
  db: DatabaseAdapter,
  actor: { id: string; email: string },
  idempotencyKey: string,
  request: CreateBookingRequest,
  nowSeconds = Math.floor(Date.now() / 1000)
): Promise<{ result: MutationResult; isReplay: boolean }> {
  const method = 'POST';
  const path = '/api/team/bookings';
  const fingerprint = await calculatePayloadFingerprint(request);

  // 1. Idempotencia: Verificar recibo existente
  const existingReceipt = await db.first<{
    http_status: number;
    resource_id: string;
    kind: string;
    version: string;
    payload_fingerprint: string;
    start_at: number;
    end_at: number;
    status: string;
    professional_id: string;
  }>(
    `SELECT c.http_status, c.resource_id, c.kind, c.version, c.payload_fingerprint,
            a.start_at, a.end_at, a.status, a.professional_id
     FROM command_results c
     LEFT JOIN agenda_entries a ON c.resource_id = a.id
     WHERE c.actor_id = ? AND c.idempotency_key = ?`,
    actor.id,
    idempotencyKey
  );

  if (existingReceipt) {
    if (existingReceipt.payload_fingerprint !== fingerprint) {
      throw new ApiCommandError(
        'IDEMPOTENCY_MISMATCH',
        'La clave de idempotencia ya fue utilizada con un cuerpo diferente.',
        409
      );
    }
    return {
      isReplay: true,
      result: {
        command: { id: idempotencyKey, status: 'committed' },
        result: {
          resourceId: existingReceipt.resource_id,
          kind: 'appointment',
          professionalId: existingReceipt.professional_id as ProfessionalId,
          startAt: new Date(existingReceipt.start_at * 1000).toISOString(),
          endAt: new Date(existingReceipt.end_at * 1000).toISOString(),
          status: existingReceipt.status as any,
          version: existingReceipt.version
        }
      }
    };
  }

  // 2. Validación de reglas de negocio para el equipo (D04)
  if (!isAllowedProfessional(request.professionalId)) {
    throw new ApiCommandError('VALIDATION_ERROR', 'Profesional no válido.', 400);
  }

  if (!isValidRfc3339Utc(request.startAt) || !isAlignedToHour(request.startAt)) {
    throw new ApiCommandError('VALIDATION_ERROR', 'Timestamp UTC alineado a la hora requerido.', 400);
  }

  const startSeconds = Math.floor(new Date(request.startAt).getTime() / 1000);
  const endSeconds = startSeconds + SLOT_DURATION_SECONDS;

  if (!isValidWorkingSlot(startSeconds)) {
    throw new ApiCommandError('VALIDATION_ERROR', 'Horario fuera de la jornada de atención.', 422);
  }

  if (!isWithinTeamBookingWindow(startSeconds, nowSeconds)) {
    throw new ApiCommandError(
      'VALIDATION_ERROR',
      'El equipo solo puede agendar citas dentro del mes corriente (D04).',
      422
    );
  }

  if (!request.patient || typeof request.patient !== 'object') {
    throw new ApiCommandError('VALIDATION_ERROR', 'Datos del paciente requeridos.', 422);
  }

  const trimmedName = (request.patient.name || '').trim();
  if (trimmedName.length < 2 || trimmedName.length > 120) {
    throw new ApiCommandError('VALIDATION_ERROR', 'Nombre debe tener entre 2 y 120 caracteres.', 422);
  }

  const docVal = validateDocument(request.patient.rut, request.patient.documentType);
  if (!docVal.valid) {
    throw new ApiCommandError('VALIDATION_ERROR', 'Documento no válido.', 422);
  }

  if (!validateEmail(request.patient.email)) {
    throw new ApiCommandError('VALIDATION_ERROR', 'Email no válido.', 422);
  }

  if (!validatePhone(request.patient.phone)) {
    throw new ApiCommandError('VALIDATION_ERROR', 'Teléfono no válido.', 422);
  }

  const bookingId = `bkg_${generateRandomString(16)}`;
  const version = '"v1"';
  const auditId = `aud_${generateRandomString(12)}`;

  const snapshotJson = await encryptPiiJson({
    name: trimmedName,
    email: request.patient.email,
    rut: docVal.formatted,
    documentType: request.patient.documentType,
    phone: request.patient.phone
  });

  try {
    await db.batch([
      {
        sql: `INSERT INTO agenda_entries (
          id, kind, professional_id, start_at, end_at, status, version,
          booked_by_user_id, encrypted_snapshot, created_at, updated_at
        ) VALUES (?, 'appointment', ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?)`,
        params: [
          bookingId,
          request.professionalId,
          startSeconds,
          endSeconds,
          version,
          null,
          snapshotJson,
          nowSeconds,
          nowSeconds
        ]
      },
      {
        sql: `INSERT INTO audit_events (
          id, actor_id, action, entity_type, entity_id, version, created_at
        ) VALUES (?, ?, 'create_team_booking', 'appointment', ?, ?, ?)`,
        params: [auditId, actor.id, bookingId, version, nowSeconds]
      },
      {
        sql: `INSERT INTO command_results (
          actor_id, idempotency_key, method, path, payload_fingerprint,
          http_status, resource_id, kind, version, created_at
        ) VALUES (?, ?, ?, ?, ?, 201, ?, 'appointment', ?, ?)`,
        params: [
          actor.id,
          idempotencyKey,
          method,
          path,
          fingerprint,
          bookingId,
          version,
          nowSeconds
        ]
      }
    ]);
  } catch (err: any) {
    if (err.message && err.message.includes('SLOT_CONFLICT')) {
      throw new ApiCommandError('SLOT_CONFLICT', 'El horario seleccionado ya no está disponible.', 409);
    }
    throw err;
  }

  return {
    isReplay: false,
    result: {
      command: { id: idempotencyKey, status: 'committed' },
      result: {
        resourceId: bookingId,
        kind: 'appointment',
        professionalId: request.professionalId,
        startAt: new Date(startSeconds * 1000).toISOString(),
        endAt: new Date(endSeconds * 1000).toISOString(),
        status: 'confirmed',
        version
      }
    }
  };
}

/**
 * Edición de una cita por parte del equipo con control de versión If-Match (S05 / D07).
 */
export async function executeEditTeamBookingCommand(
  db: DatabaseAdapter,
  actor: { id: string },
  bookingId: string,
  expectedVersion: string,
  update: {
    startAt?: string;
    patient?: {
      name: string;
      email: string;
      rut: string;
      documentType?: 'rut' | 'passport';
      phone?: string;
    };
  },
  nowSeconds = Math.floor(Date.now() / 1000),
  idempotencyKey?: string
): Promise<MutationResult> {
  let fingerprint = '';
  if (idempotencyKey) {
    fingerprint = await calculatePayloadFingerprint({ bookingId, expectedVersion, update });
    const existingReceipt = await db.first<{
      http_status: number;
      resource_id: string;
      kind: string;
      version: string;
      payload_fingerprint: string;
      start_at: number;
      end_at: number;
      status: string;
      professional_id: string;
    }>(
      `SELECT c.http_status, c.resource_id, c.kind, c.version, c.payload_fingerprint,
              a.start_at, a.end_at, a.status, a.professional_id
       FROM command_results c
       LEFT JOIN agenda_entries a ON c.resource_id = a.id
       WHERE c.actor_id = ? AND c.idempotency_key = ?`,
      actor.id,
      idempotencyKey
    );

    if (existingReceipt) {
      if (existingReceipt.payload_fingerprint !== fingerprint) {
        throw new ApiCommandError(
          'IDEMPOTENCY_MISMATCH',
          'La clave de idempotencia ya fue utilizada con un cuerpo diferente.',
          409
        );
      }
      return {
        command: { id: idempotencyKey, status: 'committed' },
        result: {
          resourceId: existingReceipt.resource_id,
          kind: 'appointment',
          professionalId: existingReceipt.professional_id as ProfessionalId,
          startAt: new Date(existingReceipt.start_at * 1000).toISOString(),
          endAt: new Date(existingReceipt.end_at * 1000).toISOString(),
          status: existingReceipt.status as any,
          version: existingReceipt.version
        }
      };
    }
  }

  const existing = await db.first<{
    id: string;
    kind: string;
    professional_id: string;
    start_at: number;
    end_at: number;
    status: string;
    version: string;
    encrypted_snapshot: string;
  }>("SELECT * FROM agenda_entries WHERE id = ? AND kind = 'appointment'", bookingId);

  if (!existing) {
    throw new ApiCommandError('NOT_FOUND', 'Cita no encontrada.', 404);
  }

  if (existing.status === 'cancelled') {
    throw new ApiCommandError('BOOKING_CANCELLED', 'No se puede editar una cita cancelada.', 409);
  }

  const normExpected = (expectedVersion || '').replace(/^"|"$/g, '').trim();
  const normExisting = (existing.version || '').replace(/^"|"$/g, '').trim();
  if (normExisting !== normExpected) {
    throw new ApiCommandError(
      'VERSION_CONFLICT',
      'La cita fue modificada por otro usuario. Actualice la página.',
      412
    );
  }

  let newStart = existing.start_at;
  let newEnd = existing.end_at;

  if (update.startAt) {
    if (!isValidRfc3339Utc(update.startAt) || !isAlignedToHour(update.startAt)) {
      throw new ApiCommandError('VALIDATION_ERROR', 'Nuevo horario no válido.', 400);
    }
    newStart = Math.floor(new Date(update.startAt).getTime() / 1000);
    newEnd = newStart + SLOT_DURATION_SECONDS;

    if (!isValidWorkingSlot(newStart) || !isWithinTeamBookingWindow(newStart, nowSeconds)) {
      throw new ApiCommandError('VALIDATION_ERROR', 'Nuevo horario fuera de jornada o ventana.', 422);
    }
  }

  let newSnapshot = existing.encrypted_snapshot;
  if (update.patient) {
    const docVal = validateDocument(update.patient.rut, update.patient.documentType);
    if (!docVal.valid) {
      throw new ApiCommandError('VALIDATION_ERROR', 'Documento del paciente no válido.', 422);
    }
    if (!validateEmail(update.patient.email)) {
      throw new ApiCommandError('VALIDATION_ERROR', 'Email del paciente no válido.', 422);
    }
    newSnapshot = await encryptPiiJson({
      name: update.patient.name,
      email: update.patient.email,
      rut: docVal.formatted,
      documentType: update.patient.documentType || 'rut',
      phone: update.patient.phone || ''
    });
  }

  const nextVersionNum = parseInt(existing.version.replace(/[^0-9]/g, '') || '1', 10) + 1;
  const nextVersion = `"v${nextVersionNum}"`;
  const auditId = `aud_${generateRandomString(12)}`;

  try {
    const batchStmts: Array<{ sql: string; params?: any[] }> = [
      {
        sql: `UPDATE agenda_entries
         SET start_at = ?, end_at = ?, encrypted_snapshot = ?, version = ?, updated_at = ?
         WHERE id = ? AND version = ?`,
        params: [
          newStart,
          newEnd,
          newSnapshot,
          nextVersion,
          nowSeconds,
          bookingId,
          existing.version
        ]
      },
      {
        sql: `INSERT INTO audit_events (
          id, actor_id, action, entity_type, entity_id, version, created_at
        ) VALUES (?, ?, 'edit_team_booking', 'appointment', ?, ?, ?)`,
        params: [auditId, actor.id, bookingId, nextVersion, nowSeconds]
      }
    ];

    if (idempotencyKey) {
      batchStmts.push({
        sql: `INSERT INTO command_results (
          actor_id, idempotency_key, method, path, payload_fingerprint,
          http_status, resource_id, kind, version, created_at
        ) VALUES (?, ?, 'PATCH', ?, ?, 200, ?, 'appointment', ?, ?)`,
        params: [
          actor.id,
          idempotencyKey,
          `/api/team/bookings/${bookingId}`,
          fingerprint,
          bookingId,
          nextVersion,
          nowSeconds
        ]
      });
    }

    await db.batch(batchStmts);
  } catch (err: any) {
    if (err.message && err.message.includes('SLOT_CONFLICT')) {
      throw new ApiCommandError('SLOT_CONFLICT', 'El nuevo horario ya se encuentra ocupado.', 409);
    }
    throw err;
  }

  return {
    command: { id: generateRandomString(16), status: 'committed' },
    result: {
      resourceId: bookingId,
      kind: 'appointment',
      professionalId: existing.professional_id as ProfessionalId,
      startAt: new Date(newStart * 1000).toISOString(),
      endAt: new Date(newEnd * 1000).toISOString(),
      status: 'confirmed',
      version: nextVersion
    }
  };
}

/**
 * Elimina un bloqueo administrativo de la agenda liberando el horario (S05).
 */
export async function executeDeleteBlockCommand(
  db: DatabaseAdapter,
  actor: { id: string },
  blockId: string,
  expectedVersion: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): Promise<MutationResult> {
  const existing = await db.first<{
    id: string;
    professional_id: string;
    start_at: number;
    end_at: number;
    status: string;
    version: string;
  }>('SELECT * FROM agenda_entries WHERE id = ? AND kind = \'block\'', blockId);

  if (!existing) {
    throw new ApiCommandError('NOT_FOUND', 'Bloqueo no encontrado.', 404);
  }

  if (existing.status === 'cancelled') {
    throw new ApiCommandError('BOOKING_CANCELLED', 'El bloqueo ya fue cancelado previamente.', 409);
  }

  const normExpected = (expectedVersion || '').replace(/^"|"$/g, '').trim();
  const normExisting = (existing.version || '').replace(/^"|"$/g, '').trim();
  if (normExisting !== normExpected) {
    throw new ApiCommandError('VERSION_CONFLICT', 'El bloqueo fue modificado previamente.', 412);
  }

  const nextVersionNum = parseInt(existing.version.replace(/[^0-9]/g, '') || '1', 10) + 1;
  const nextVersion = `"v${nextVersionNum}"`;
  const auditId = `aud_${generateRandomString(12)}`;

  await db.batch([
    {
      sql: `UPDATE agenda_entries
       SET status = 'cancelled', version = ?, updated_at = ?
       WHERE id = ? AND version = ?`,
      params: [nextVersion, nowSeconds, blockId, existing.version]
    },
    {
      sql: `INSERT INTO audit_events (
        id, actor_id, action, entity_type, entity_id, version, created_at
      ) VALUES (?, ?, 'delete_team_block', 'block', ?, ?, ?)`,
      params: [auditId, actor.id, blockId, nextVersion, nowSeconds]
    }
  ]);

  return {
    command: { id: generateRandomString(16), status: 'committed' },
    result: {
      resourceId: blockId,
      kind: 'block',
      professionalId: existing.professional_id as ProfessionalId,
      startAt: new Date(existing.start_at * 1000).toISOString(),
      endAt: new Date(existing.end_at * 1000).toISOString(),
      status: 'cancelled',
      version: nextVersion
    }
  };
}

/**
 * Registra o actualiza la asistencia de un paciente a su cita programada.
 * Exclusivo para miembros del equipo (S05).
 */
export async function executeRecordAttendanceCommand(
  db: DatabaseAdapter,
  actor: { id: string },
  bookingId: string,
  attendanceStatus: AttendanceStatus,
  nowSeconds = Math.floor(Date.now() / 1000)
): Promise<{ ok: boolean; bookingId: string; attendanceStatus: AttendanceStatus; attendanceUpdatedAt: string }> {
  // 1. Validar estado permitido
  if (!['pending', 'attended', 'no_show'].includes(attendanceStatus)) {
    throw new ApiCommandError(
      'VALIDATION_ERROR',
      'El estado de asistencia debe ser pending, attended o no_show.',
      400,
      { attendanceStatus: 'INVALID_STATUS' }
    );
  }

  // 2. Verificar existencia de la cita
  const existing = await db.first<{
    id: string;
    status: string;
    kind: string;
    version: string;
  }>("SELECT id, status, kind, version FROM agenda_entries WHERE id = ? AND kind = 'appointment'", bookingId);

  if (!existing) {
    throw new ApiCommandError('NOT_FOUND', 'Cita médica no encontrada.', 404);
  }

  if (existing.status === 'cancelled') {
    throw new ApiCommandError(
      'BOOKING_CANCELLED',
      'No es posible registrar o modificar la asistencia en una cita cancelada.',
      409
    );
  }

  const auditId = `aud_${generateRandomString(12)}`;
  const updatedAtIso = new Date(nowSeconds * 1000).toISOString();

  await db.batch([
    {
      sql: `UPDATE agenda_entries
            SET attendance_status = ?,
                attendance_updated_at = ?,
                attendance_updated_by = ?,
                updated_at = ?
            WHERE id = ?`,
      params: [attendanceStatus, nowSeconds, actor.id, nowSeconds, bookingId]
    },
    {
      sql: `INSERT INTO audit_events (
              id, actor_id, action, entity_type, entity_id, version, created_at
            ) VALUES (?, ?, 'record_attendance', 'appointment', ?, ?, ?)`,
      params: [auditId, actor.id, bookingId, existing.version, nowSeconds]
    }
  ]);

  return {
    ok: true,
    bookingId,
    attendanceStatus,
    attendanceUpdatedAt: updatedAtIso
  };
}

export interface PatientSearchResultItem {
  id: string;
  professionalId: ProfessionalId;
  startAt: string;
  endAt: string;
  status: 'confirmed' | 'cancelled';
  attendanceStatus: AttendanceStatus;
  version: string;
  patient: {
    name: string;
    email: string;
    phone?: string;
    rut?: string;
    documentType?: string;
  };
}

export interface PatientSearchStats {
  totalAppointments: number;
  attendedCount: number;
  noShowCount: number;
  cancelledCount: number;
  upcomingCount: number;
}

export interface PatientSearchResult {
  query: string;
  totalMatches: number;
  stats: PatientSearchStats;
  results: PatientSearchResultItem[];
}

function normalizeSearchText(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizeSearchRut(rut: string): string {
  return (rut || '').replace(/[^0-9kK]/g, '').toLowerCase();
}

/**
 * Busca atenciones agendadas de pacientes por nombre, email o RUT en toda la historia clínica.
 * Exclusivo para equipo clínico. Descifra los snapshots en memoria de forma segura.
 */
export async function searchPatientAppointments(
  db: DatabaseAdapter,
  rawQuery: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): Promise<PatientSearchResult> {
  const query = (rawQuery || '').trim();
  const normalizedQuery = normalizeSearchText(query);
  const cleanRutQuery = normalizeSearchRut(query);

  const emptyStats: PatientSearchStats = {
    totalAppointments: 0,
    attendedCount: 0,
    noShowCount: 0,
    cancelledCount: 0,
    upcomingCount: 0
  };

  if (!normalizedQuery || normalizedQuery.length < 2) {
    return {
      query,
      totalMatches: 0,
      stats: emptyStats,
      results: []
    };
  }

  // Consultar todas las citas de la agenda ordenadas descendentemente por fecha
  const rows = await db.all<{
    id: string;
    professional_id: string;
    start_at: number;
    end_at: number;
    status: string;
    version: string;
    encrypted_snapshot: string | null;
    attendance_status: string | null;
  }>(
    `SELECT id, professional_id, start_at, end_at, status, version, encrypted_snapshot, attendance_status
     FROM agenda_entries
     WHERE kind = 'appointment'
     ORDER BY start_at DESC`
  );

  const results: PatientSearchResultItem[] = [];
  const stats: PatientSearchStats = { ...emptyStats };

  for (const r of rows) {
    if (!r.encrypted_snapshot) continue;

    const snap = await decryptPiiJson<{
      name?: string;
      email?: string;
      phone?: string;
      rut?: string;
      documentType?: string;
    }>(r.encrypted_snapshot);

    if (!snap) continue;

    const patientName = snap.name || '';
    const patientEmail = snap.email || '';
    const patientRut = snap.rut || '';

    const normName = normalizeSearchText(patientName);
    const normEmail = (patientEmail || '').toLowerCase();
    const normRut = normalizeSearchRut(patientRut);

    // Coincidencia por nombre (parcial, sin tildes)
    const matchName = normName.includes(normalizedQuery);
    // Coincidencia por email (parcial)
    const matchEmail = normEmail.includes(normalizedQuery);
    // Coincidencia por RUT (si la consulta tiene al menos 3 dígitos/caracteres válidos de RUT)
    const matchRut = cleanRutQuery.length >= 3 && normRut.includes(cleanRutQuery);

    if (matchName || matchEmail || matchRut) {
      const attendanceStatus = (r.attendance_status as AttendanceStatus) || 'pending';
      const isConfirmed = r.status === 'confirmed';

      stats.totalAppointments++;
      if (r.status === 'cancelled') {
        stats.cancelledCount++;
      } else {
        if (r.start_at >= nowSeconds) {
          stats.upcomingCount++;
        }
        if (attendanceStatus === 'no_show') {
          stats.noShowCount++;
        } else if (attendanceStatus === 'attended') {
          stats.attendedCount++;
        }
      }

      results.push({
        id: r.id,
        professionalId: r.professional_id as ProfessionalId,
        startAt: new Date(r.start_at * 1000).toISOString(),
        endAt: new Date(r.end_at * 1000).toISOString(),
        status: r.status as any,
        attendanceStatus,
        version: r.version,
        patient: {
          name: patientName,
          email: patientEmail,
          phone: snap.phone || '',
          rut: patientRut,
          documentType: snap.documentType || 'rut'
        }
      });
    }
  }

  return {
    query,
    totalMatches: results.length,
    stats,
    results
  };
}
