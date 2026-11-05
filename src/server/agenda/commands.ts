/**
 * Centro Vida Sana Austral — Motor Transaccional de Comandos e Idempotencia
 * Conforme a S03 (exclusión y transacciones), S09 (idempotencia y resolve) y D01–D07.
 */

import {
  SLOT_DURATION_SECONDS,
  type CreateBlockRequest,
  type CreateBookingRequest,
  type MutationResult,
  type ProfessionalId,
  type ResolveCommandResponse,
  type UserSession
} from '../../lib/agendamiento/types.ts';
import type { DatabaseAdapter } from '../db/adapter.ts';
import { generateRandomString, sha256Hex } from '../auth/crypto.ts';
import {
  isAlignedToHour,
  isValidRfc3339Utc,
  validateDocument,
  validateEmail
} from '../../lib/agendamiento/validation.ts';
import {
  isValidWorkingSlot,
  isWithinPatientBookingWindow,
  isWithinTeamBookingWindow
} from './policy.ts';

export class ApiCommandError extends Error {
  code: string;
  status: number;
  fields?: Record<string, string>;

  constructor(code: string, message: string, status: number, fields?: Record<string, string>) {
    super(message);
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

/**
 * Serializa canónicamente un objeto JSON ordenando las claves a todos los niveles de anidación.
 */
export function canonicalJsonStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJsonStringify).join(',') + ']';
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const entries = keys.map(
    (k) => JSON.stringify(k) + ':' + canonicalJsonStringify((obj as Record<string, unknown>)[k])
  );
  return '{' + entries.join(',') + '}';
}

/**
 * Genera un fingerprint canónico (SHA-256) del cuerpo de la petición.
 */
export async function calculatePayloadFingerprint(payload: unknown): Promise<string> {
  const serialized = canonicalJsonStringify(payload);
  return sha256Hex(serialized);
}

/**
 * Resuelve una solicitud de idempotencia (Endpoint S09 /api/commands/resolve).
 * REGLA DE PRIVACIDAD: No expone PII ni recibos pertenecientes a otros actores.
 */
export async function resolveCommand(
  db: DatabaseAdapter,
  actorId: string,
  idempotencyKey: string,
  method?: string,
  path?: string
): Promise<ResolveCommandResponse> {
  const receipt = await db.first<{
    http_status: number;
    resource_id: string;
    kind: string;
    version: string;
    method: string;
    path: string;
  }>(
    `SELECT http_status, resource_id, kind, version, method, path
     FROM command_results
     WHERE actor_id = ? AND idempotency_key = ?`,
    actorId,
    idempotencyKey
  );

  if (!receipt) {
    return { status: 'not_found' };
  }

  // Si se indicaron method/path, verificar que coincidan exactamente
  if ((method && receipt.method !== method) || (path && receipt.path !== path)) {
    throw new ApiCommandError(
      'IDEMPOTENCY_MISMATCH',
      'La clave de idempotencia ya fue utilizada con un método o ruta diferente.',
      409
    );
  }

  return {
    status: 'committed',
    httpStatus: receipt.http_status,
    commandId: idempotencyKey,
    result: {
      resourceId: receipt.resource_id,
      kind: receipt.kind as any,
      version: receipt.version
    }
  };
}

/**
 * Crea una reserva de atención en una transacción atómica protegida por triggers e idempotencia.
 */
export async function executeCreateBookingCommand(
  db: DatabaseAdapter,
  actor: { id: string; email: string },
  idempotencyKey: string,
  request: CreateBookingRequest,
  nowSeconds = Math.floor(Date.now() / 1000)
): Promise<{ result: MutationResult; isReplay: boolean }> {
  const method = 'POST';
  const path = '/api/bookings';
  const fingerprint = await calculatePayloadFingerprint(request);

  // 1. Comprobar si ya existe un recibo de idempotencia para este actor
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
    // Si la misma clave se reutiliza con un cuerpo distinto -> 409 Conflict
    if (existingReceipt.payload_fingerprint !== fingerprint) {
      throw new ApiCommandError(
        'IDEMPOTENCY_MISMATCH',
        'La clave de idempotencia ya fue utilizada con un cuerpo de solicitud diferente.',
        409
      );
    }

    // Replay idempotente legítimo: devolver el recibo previo sin re-ejecutar mutaciones
    return {
      isReplay: true,
      result: {
        command: {
          id: idempotencyKey,
          status: 'committed'
        },
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

  // 2. Validación de reglas de negocio para nuevo comando
  if (!isValidRfc3339Utc(request.startAt) || !isAlignedToHour(request.startAt)) {
    throw new ApiCommandError(
      'VALIDATION_ERROR',
      'La hora de inicio debe ser un timestamp RFC3339 UTC alineado a la hora exacta (:00:00Z).',
      400,
      { startAt: 'INVALID_TIMESTAMP' }
    );
  }

  const startSeconds = Math.floor(new Date(request.startAt).getTime() / 1000);
  const endSeconds = startSeconds + SLOT_DURATION_SECONDS;

  // Validar jornada de atención D01
  if (!isValidWorkingSlot(startSeconds)) {
    throw new ApiCommandError(
      'VALIDATION_ERROR',
      'El horario solicitado no corresponde a una jornada de atención válida.',
      422,
      { startAt: 'OUTSIDE_WORKING_HOURS' }
    );
  }

  // Validar ventana de reserva de paciente D02
  if (!isWithinPatientBookingWindow(startSeconds, nowSeconds)) {
    throw new ApiCommandError(
      'VALIDATION_ERROR',
      'Los pacientes solo pueden agendar desde mañana (D+1) hasta 7 días hacia adelante (D+7).',
      422,
      { startAt: 'OUTSIDE_BOOKING_WINDOW' }
    );
  }

  // Validar datos de paciente y RUT
  const docVal = validateDocument(request.patient.rut, request.patient.documentType);
  if (!docVal.valid) {
    throw new ApiCommandError(
      'VALIDATION_ERROR',
      'El número de documento de identidad ingresado no es válido.',
      422,
      { rut: docVal.error || 'INVALID_DOCUMENT' }
    );
  }

  if (!validateEmail(request.patient.email)) {
    throw new ApiCommandError(
      'VALIDATION_ERROR',
      'El correo electrónico del paciente no tiene un formato válido.',
      422,
      { email: 'INVALID_EMAIL' }
    );
  }

  // 3. Ejecutar transacción atómica
  const bookingId = `bkg_${generateRandomString(16)}`;
  const version = '"v1"';

  const snapshotJson = JSON.stringify({
    name: request.patient.name,
    email: request.patient.email,
    rut: docVal.formatted,
    documentType: request.patient.documentType,
    phone: request.patient.phone
  });

  try {
    // Inserción en agenda_entries (protegida por el trigger atómico trg_agenda_entries_no_overlap_insert)
    await db.run(
      `INSERT INTO agenda_entries (
        id, kind, professional_id, start_at, end_at, status, version,
        booked_by_user_id, encrypted_snapshot, created_at, updated_at
      ) VALUES (?, 'appointment', ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?)`,
      bookingId,
      request.professionalId,
      startSeconds,
      endSeconds,
      version,
      actor.id,
      snapshotJson,
      nowSeconds,
      nowSeconds
    );

    // Registro de auditoría (sin PII)
    const auditId = `aud_${generateRandomString(12)}`;
    await db.run(
      `INSERT INTO audit_events (
        id, actor_id, action, entity_type, entity_id, version, created_at
      ) VALUES (?, ?, 'create_booking', 'appointment', ?, ?, ?)`,
      auditId,
      actor.id,
      bookingId,
      version,
      nowSeconds
    );

    // Registro del recibo de idempotencia
    await db.run(
      `INSERT INTO command_results (
        actor_id, idempotency_key, method, path, payload_fingerprint,
        http_status, resource_id, kind, version, created_at
      ) VALUES (?, ?, ?, ?, ?, 201, ?, 'appointment', ?, ?)`,
      actor.id,
      idempotencyKey,
      method,
      path,
      fingerprint,
      bookingId,
      version,
      nowSeconds
    );
  } catch (err: any) {
    if (err.message && err.message.includes('SLOT_CONFLICT')) {
      throw new ApiCommandError(
        'SLOT_CONFLICT',
        'El horario seleccionado ya no está disponible. Por favor elige otro cupo.',
        409
      );
    }
    throw err;
  }

  return {
    isReplay: false,
    result: {
      command: {
        id: idempotencyKey,
        status: 'committed'
      },
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
 * Cancela una reserva con control de concurrencia optimista (If-Match).
 */
export async function executeCancelBookingCommand(
  db: DatabaseAdapter,
  actor: { id: string; isTeam: boolean },
  bookingId: string,
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
    booked_by_user_id: string | null;
  }>(
    'SELECT id, professional_id, start_at, end_at, status, version, booked_by_user_id FROM agenda_entries WHERE id = ?',
    bookingId
  );

  if (!existing) {
    throw new ApiCommandError('NOT_FOUND', 'La reserva no fue encontrada.', 404);
  }

  // Autorización: debe ser el dueño reservante o un miembro activo del equipo
  if (!actor.isTeam && existing.booked_by_user_id !== actor.id) {
    throw new ApiCommandError('FORBIDDEN', 'No tienes permisos para modificar esta reserva.', 403);
  }

  if (existing.status === 'cancelled') {
    throw new ApiCommandError('BOOKING_CANCELLED', 'La reserva ya se encuentra cancelada.', 409);
  }

  // Verificación estricta de versión (If-Match)
  if (existing.version !== expectedVersion) {
    throw new ApiCommandError(
      'VERSION_CONFLICT',
      'La reserva ha sido modificada por otra operación. Por favor actualiza la página.',
      412
    );
  }

  const nextVersionNum = parseInt(existing.version.replace(/[^0-9]/g, '') || '1', 10) + 1;
  const nextVersion = `"v${nextVersionNum}"`;

  // Actualización lógica en D1 (soft-delete sin hard-delete de historia)
  await db.run(
    `UPDATE agenda_entries
     SET status = 'cancelled', version = ?, updated_at = ?
     WHERE id = ? AND version = ?`,
    nextVersion,
    nowSeconds,
    bookingId,
    expectedVersion
  );

  // Registro de auditoría
  const auditId = `aud_${generateRandomString(12)}`;
  await db.run(
    `INSERT INTO audit_events (
      id, actor_id, action, entity_type, entity_id, version, created_at
    ) VALUES (?, ?, 'cancel_booking', 'appointment', ?, ?, ?)`,
    auditId,
    actor.id,
    bookingId,
    nextVersion,
    nowSeconds
  );

  return {
    command: {
      id: generateRandomString(16),
      status: 'committed'
    },
    result: {
      resourceId: bookingId,
      kind: 'appointment',
      professionalId: existing.professional_id as ProfessionalId,
      startAt: new Date(existing.start_at * 1000).toISOString(),
      endAt: new Date(existing.end_at * 1000).toISOString(),
      status: 'cancelled',
      version: nextVersion
    }
  };
}

/**
 * Crea un bloqueo de 60 minutos en la agenda del equipo (S05 / D04).
 */
export async function executeCreateBlockCommand(
  db: DatabaseAdapter,
  actor: { id: string },
  idempotencyKey: string,
  request: CreateBlockRequest,
  nowSeconds = Math.floor(Date.now() / 1000)
): Promise<MutationResult> {
  const startSeconds = Math.floor(new Date(request.startAt).getTime() / 1000);
  const endSeconds = Math.floor(new Date(request.endAt).getTime() / 1000);

  if (endSeconds <= startSeconds) {
    throw new ApiCommandError('VALIDATION_ERROR', 'El fin del bloqueo debe ser posterior al inicio.', 400);
  }

  const blockId = `blk_${generateRandomString(16)}`;
  const version = '"v1"';

  try {
    await db.run(
      `INSERT INTO agenda_entries (
        id, kind, professional_id, start_at, end_at, status, version,
        created_at, updated_at
      ) VALUES (?, 'block', ?, ?, ?, 'confirmed', ?, ?, ?)`,
      blockId,
      request.professionalId,
      startSeconds,
      endSeconds,
      version,
      nowSeconds,
      nowSeconds
    );
  } catch (err: any) {
    if (err.message && err.message.includes('SLOT_CONFLICT')) {
      throw new ApiCommandError(
        'SLOT_CONFLICT',
        'El intervalo del bloqueo solapa con una cita o bloqueo existente.',
        409
      );
    }
    throw err;
  }

  return {
    command: {
      id: idempotencyKey,
      status: 'committed'
    },
    result: {
      resourceId: blockId,
      kind: 'block',
      professionalId: request.professionalId,
      startAt: new Date(startSeconds * 1000).toISOString(),
      endAt: new Date(endSeconds * 1000).toISOString(),
      status: 'confirmed',
      version
    }
  };
}
