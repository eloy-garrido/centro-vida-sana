/**
 * Centro Vida Sana Austral — Servicio de Perfil de Paciente (S02 / D05 / S09)
 * Almacena y recupera el último perfil recordado por cuenta Google con control de versión.
 */

import type { DatabaseAdapter } from '../db/adapter.ts';
import { ApiCommandError } from './commands.ts';
import { validateDocument, validateEmail } from '../../lib/agendamiento/validation.ts';
import type { PatientProfilePayload } from '../../lib/agendamiento/types.ts';

export interface StoredProfileResult {
  profile: PatientProfilePayload | null;
  version: string | null;
}

/**
 * Obtiene el perfil del paciente asociado a la cuenta del usuario.
 */
export async function getPatientProfile(
  db: DatabaseAdapter,
  userId: string
): Promise<StoredProfileResult> {
  const row = await db.first<{
    encrypted_payload: string;
    version: string;
  }>(
    'SELECT encrypted_payload, version FROM patient_profiles WHERE user_id = ?',
    userId
  );

  if (!row) {
    return { profile: null, version: null };
  }

  try {
    const parsed = JSON.parse(row.encrypted_payload);
    return {
      profile: {
        name: parsed.name,
        email: parsed.email,
        rut: parsed.rut,
        documentType: parsed.documentType || 'rut',
        phone: parsed.phone || ''
      },
      version: row.version
    };
  } catch {
    return { profile: null, version: null };
  }
}

/**
 * Guarda o actualiza el perfil recordado con control de concurrencia optimista (ETag / If-Match).
 */
export async function savePatientProfile(
  db: DatabaseAdapter,
  userId: string,
  payload: PatientProfilePayload,
  consentVersion: string,
  options: {
    ifMatch?: string | null;
    ifNoneMatch?: string | null;
  },
  nowSeconds = Math.floor(Date.now() / 1000)
): Promise<{ profile: PatientProfilePayload; version: string }> {
  // 1. Validaciones de documento y formato
  const docVal = validateDocument(payload.rut, payload.documentType);
  if (!docVal.valid) {
    throw new ApiCommandError(
      'VALIDATION_ERROR',
      'El número de documento de identidad ingresado no es válido.',
      422,
      { rut: docVal.error || 'INVALID_DOCUMENT' }
    );
  }

  if (!validateEmail(payload.email)) {
    throw new ApiCommandError(
      'VALIDATION_ERROR',
      'El correo electrónico ingresado no tiene un formato válido.',
      422,
      { email: 'INVALID_EMAIL' }
    );
  }

  const cleanPayload: PatientProfilePayload = {
    name: payload.name.trim(),
    email: payload.email.trim().toLowerCase(),
    rut: docVal.formatted,
    documentType: payload.documentType,
    phone: payload.phone ? payload.phone.trim() : ''
  };

  const payloadJson = JSON.stringify(cleanPayload);

  // 2. Comprobar existencia actual
  const existing = await db.first<{
    version: string;
  }>('SELECT version FROM patient_profiles WHERE user_id = ?', userId);

  if (!existing) {
    // Si no existe, crear nuevo perfil
    const version = '"v1"';
    await db.run(
      `INSERT INTO patient_profiles (user_id, encrypted_payload, version, consent_version, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      userId,
      payloadJson,
      version,
      consentVersion,
      nowSeconds
    );
    return { profile: cleanPayload, version };
  }

  // Si existe pero se pidió If-None-Match: * -> conflicto
  if (options.ifNoneMatch === '*') {
    throw new ApiCommandError(
      'VERSION_CONFLICT',
      'El perfil ya existe. Debe enviar If-Match para actualizarlo.',
      412
    );
  }

  // Si existe, se requiere If-Match coincidente
  if (!options.ifMatch) {
    throw new ApiCommandError(
      'VERSION_REQUIRED',
      'Se requiere la cabecera If-Match con la versión actual para modificar el perfil.',
      428
    );
  }

  if (existing.version !== options.ifMatch) {
    throw new ApiCommandError(
      'VERSION_CONFLICT',
      'El perfil ha sido modificado por otra operación. Actualice la página e intente de nuevo.',
      412
    );
  }

  const nextVersionNum = parseInt(existing.version.replace(/[^0-9]/g, '') || '1', 10) + 1;
  const nextVersion = `"v${nextVersionNum}"`;

  await db.run(
    `UPDATE patient_profiles
     SET encrypted_payload = ?, version = ?, consent_version = ?, updated_at = ?
     WHERE user_id = ? AND version = ?`,
    payloadJson,
    nextVersion,
    consentVersion,
    nowSeconds,
    userId,
    existing.version
  );

  return { profile: cleanPayload, version: nextVersion };
}
