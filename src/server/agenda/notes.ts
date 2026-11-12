/**
 * Centro Vida Sana Austral — Servicio de Ficha y Notas de Evolución de Pacientes
 * Gestiona el almacenamiento cifrado en reposo (AES-256-GCM) y consulta del historial de notas clínicas.
 */

import type { DatabaseAdapter } from '../db/adapter.ts';
import { ApiCommandError } from './commands.ts';
import { generateRandomString, encryptPiiJson, decryptPiiJson } from '../auth/crypto.ts';
import type { ProfessionalId, PatientSnapshot } from '../../lib/agendamiento/types.ts';

export interface PatientNoteItem {
  id: string;
  patientKey: string;
  bookingId?: string | null;
  professionalId: ProfessionalId;
  professionalName: string;
  authorName: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  isEdited: boolean;
}

export interface CreateNoteParams {
  patientKey: string;
  bookingId?: string | null;
  professionalId: ProfessionalId;
  content: string;
  actor: { id: string; name: string; isTeam: boolean };
  nowSeconds?: number;
}

/**
 * Normaliza y genera una clave única canónica para el paciente basada en su RUT o documento.
 */
export function normalizePatientKey(rutOrDoc: string, documentType = 'rut'): string {
  if (!rutOrDoc || typeof rutOrDoc !== 'string') {
    throw new ApiCommandError('INVALID_PATIENT_KEY', 'El identificador del paciente es requerido.', 400);
  }

  const trimmed = rutOrDoc.trim();
  if (trimmed.startsWith('RUT:') || trimmed.startsWith('PASSPORT:') || trimmed.startsWith('OTHER:')) {
    return trimmed;
  }

  const docType = (documentType || 'rut').toLowerCase();
  if (docType === 'rut') {
    // Limpiar puntos, espacios y convertir a mayúsculas
    const cleanRut = trimmed.replace(/\./g, '').replace(/\s+/g, '').toUpperCase();
    return `RUT:${cleanRut}`;
  }

  if (docType === 'passport') {
    const cleanPassport = trimmed.replace(/\s+/g, '').toUpperCase();
    return `PASSPORT:${cleanPassport}`;
  }

  return `OTHER:${trimmed}`;
}

/**
 * Obtiene la ficha del paciente y su historial de notas a partir del bookingId.
 */
export async function getPatientNotesByBooking(
  db: DatabaseAdapter,
  bookingId: string,
  actor: { id: string; isTeam: boolean }
): Promise<{ patient: PatientSnapshot; patientKey: string; notes: PatientNoteItem[] }> {
  if (!actor.isTeam) {
    throw new ApiCommandError('FORBIDDEN', 'Acceso denegado a la ficha clínica del paciente.', 403);
  }

  const booking = await db.first<{
    id: string;
    encrypted_snapshot: string | null;
  }>(
    'SELECT id, encrypted_snapshot FROM agenda_entries WHERE id = ?',
    bookingId
  );

  if (!booking) {
    throw new ApiCommandError('BOOKING_NOT_FOUND', `Cita no encontrada con ID: ${bookingId}`, 404);
  }

  let patient: PatientSnapshot = {
    name: 'Paciente',
    email: '',
    rut: '',
    documentType: 'rut'
  };

  if (booking.encrypted_snapshot) {
    const decrypted = await decryptPiiJson<PatientSnapshot>(booking.encrypted_snapshot);
    if (decrypted) {
      patient = decrypted;
    }
  }

  const patientKey = normalizePatientKey(patient.rut || patient.email, patient.documentType);

  const rows = await db.all<{
    id: string;
    patient_key: string;
    booking_id: string | null;
    professional_id: string;
    author_name: string;
    encrypted_content: string;
    created_at: number;
    updated_at: number;
  }>(
    'SELECT id, patient_key, booking_id, professional_id, author_name, encrypted_content, created_at, updated_at FROM patient_notes WHERE patient_key = ? ORDER BY created_at DESC',
    patientKey
  );

  const notes: PatientNoteItem[] = [];
  for (const row of rows) {
    const decrypted = await decryptPiiJson<{ content: string } | string>(row.encrypted_content);
    const content = typeof decrypted === 'string'
      ? decrypted
      : (decrypted?.content || '');

    const proId = row.professional_id as ProfessionalId;
    notes.push({
      id: row.id,
      patientKey: row.patient_key,
      bookingId: row.booking_id,
      professionalId: proId,
      professionalName: proId === 'felipe' ? 'Felipe Méndez' : 'Eduardo Lagos',
      authorName: row.author_name,
      content,
      createdAt: new Date(row.created_at * 1000).toISOString(),
      updatedAt: new Date(row.updated_at * 1000).toISOString(),
      isEdited: row.updated_at > row.created_at
    });
  }

  return { patient, patientKey, notes };
}

/**
 * Crea una nueva nota de atención para el paciente.
 */
export async function createPatientNote(
  db: DatabaseAdapter,
  params: CreateNoteParams
): Promise<PatientNoteItem> {
  if (!params.actor.isTeam) {
    throw new ApiCommandError('FORBIDDEN', 'Solo miembros autorizados del equipo pueden agregar notas.', 403);
  }

  const cleanContent = (params.content || '').trim();
  if (!cleanContent) {
    throw new ApiCommandError('INVALID_NOTE_CONTENT', 'El contenido de la nota no puede estar vacío.', 400);
  }
  if (cleanContent.length > 4000) {
    throw new ApiCommandError('NOTE_TOO_LONG', 'La nota excede el límite máximo de 4000 caracteres.', 400);
  }

  if (params.professionalId !== 'felipe' && params.professionalId !== 'eduardo') {
    throw new ApiCommandError('INVALID_PROFESSIONAL', 'Profesional inválido. Debe ser felipe o eduardo.', 400);
  }

  const noteId = `note_${Date.now()}_${generateRandomString(8)}`;
  const now = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  const encryptedContent = await encryptPiiJson({ content: cleanContent });

  await db.run(
    `INSERT INTO patient_notes (
      id, patient_key, booking_id, professional_id, author_user_id, author_name, encrypted_content, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    noteId,
    params.patientKey,
    params.bookingId || null,
    params.professionalId,
    params.actor.id,
    params.actor.name,
    encryptedContent,
    now,
    now
  );

  return {
    id: noteId,
    patientKey: params.patientKey,
    bookingId: params.bookingId || null,
    professionalId: params.professionalId,
    professionalName: params.professionalId === 'felipe' ? 'Felipe Méndez' : 'Eduardo Lagos',
    authorName: params.actor.name,
    content: cleanContent,
    createdAt: new Date(now * 1000).toISOString(),
    updatedAt: new Date(now * 1000).toISOString(),
    isEdited: false
  };
}

/**
 * Actualiza el contenido de una nota existente (edición con icono de lápiz).
 */
export async function updatePatientNote(
  db: DatabaseAdapter,
  noteId: string,
  content: string,
  actor: { id: string; isTeam: boolean },
  nowSeconds?: number
): Promise<PatientNoteItem> {
  if (!actor.isTeam) {
    throw new ApiCommandError('FORBIDDEN', 'Solo miembros autorizados del equipo pueden editar notas.', 403);
  }

  const cleanContent = (content || '').trim();
  if (!cleanContent) {
    throw new ApiCommandError('INVALID_NOTE_CONTENT', 'El contenido de la nota no puede estar vacío.', 400);
  }
  if (cleanContent.length > 4000) {
    throw new ApiCommandError('NOTE_TOO_LONG', 'La nota excede el límite máximo de 4000 caracteres.', 400);
  }

  const row = await db.first<{
    id: string;
    patient_key: string;
    booking_id: string | null;
    professional_id: string;
    author_name: string;
    created_at: number;
    updated_at: number;
  }>(
    'SELECT id, patient_key, booking_id, professional_id, author_name, created_at, updated_at FROM patient_notes WHERE id = ?',
    noteId
  );

  if (!row) {
    throw new ApiCommandError('NOTE_NOT_FOUND', `Nota no encontrada con ID: ${noteId}`, 404);
  }

  const now = nowSeconds ?? Math.floor(Date.now() / 1000);
  const encryptedContent = await encryptPiiJson({ content: cleanContent });

  await db.run(
    'UPDATE patient_notes SET encrypted_content = ?, updated_at = ? WHERE id = ?',
    encryptedContent,
    now,
    noteId
  );

  const proId = row.professional_id as ProfessionalId;
  return {
    id: row.id,
    patientKey: row.patient_key,
    bookingId: row.booking_id,
    professionalId: proId,
    professionalName: proId === 'felipe' ? 'Felipe Méndez' : 'Eduardo Lagos',
    authorName: row.author_name,
    content: cleanContent,
    createdAt: new Date(row.created_at * 1000).toISOString(),
    updatedAt: new Date(now * 1000).toISOString(),
    isEdited: now > row.created_at
  };
}
