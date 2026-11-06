/**
 * Centro Vida Sana Austral — Validadores canónicos de agendamiento
 * Conforme a S02 (privacidad y RUT), S09 (contratos y rechazo de campos desconocidos) y D05.
 */

import {
  ALLOWED_PROFESSIONALS,
  SLOT_DURATION_SECONDS,
  type DocumentType,
  type ProfessionalId
} from './types.ts';

// ============================================================================
// 1. VALIDACIÓN Y FORMATEO DE RUT (Módulo 11) Y DOCUMENTOS
// ============================================================================

/**
 * Normaliza un RUT removiendo puntos, espacios y pasando la 'k' a mayúscula.
 */
export function cleanRut(rawRut: string): string {
  return rawRut.replace(/[^0-9kK]/g, '').toUpperCase();
}

/**
 * Valida un RUT chileno utilizando el algoritmo canónico Módulo 11.
 */
export function validateChileanRut(rawRut: string): boolean {
  const cleaned = cleanRut(rawRut);
  if (cleaned.length < 8 || cleaned.length > 9) {
    return false;
  }

  const cuerpo = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);

  // Asegurar que el cuerpo sean solo dígitos
  if (!/^\d+$/.test(cuerpo)) {
    return false;
  }

  let suma = 0;
  let multiplo = 2;

  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i], 10) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }

  const resto = suma % 11;
  const dvCalculado = 11 - resto;

  let dvEsperado = '';
  if (dvCalculado === 11) {
    dvEsperado = '0';
  } else if (dvCalculado === 10) {
    dvEsperado = 'K';
  } else {
    dvEsperado = dvCalculado.toString();
  }

  return dv === dvEsperado;
}

/**
 * Formatea un RUT chileno a formato estándar XX.XXX.XXX-X.
 */
export function formatChileanRut(rawRut: string): string {
  const cleaned = cleanRut(rawRut);
  if (!cleaned) return '';
  const cuerpo = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);

  let formatted = '';
  let count = 0;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    formatted = cuerpo[i] + formatted;
    count++;
    if (count % 3 === 0 && i > 0) {
      formatted = '.' + formatted;
    }
  }

  return `${formatted}-${dv}`;
}

/**
 * Valida un documento de identidad según su tipo (RUT chileno o Pasaporte/Extranjero).
 */
export function validateDocument(
  docNumber: string,
  docType: DocumentType = 'rut'
): { valid: boolean; formatted: string; error?: string } {
  if (!docNumber || typeof docNumber !== 'string') {
    return { valid: false, formatted: '', error: 'DOCUMENT_REQUIRED' };
  }

  const trimmed = docNumber.trim();

  if (docType === 'rut') {
    if (!validateChileanRut(trimmed)) {
      return { valid: false, formatted: trimmed, error: 'INVALID_RUT_FORMAT' };
    }
    return { valid: true, formatted: formatChileanRut(trimmed) };
  }

  // Pasaporte u otro documento extranjero: alfanumérico entre 4 y 20 caracteres
  if (!/^[A-Za-z0-9\-]{4,20}$/.test(trimmed)) {
    return { valid: false, formatted: trimmed, error: 'INVALID_PASSPORT_FORMAT' };
  }

  return { valid: true, formatted: trimmed.toUpperCase() };
}

// ============================================================================
// 2. VALIDACIÓN DE EMAIL Y TELÉFONO
// ============================================================================

export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  // Regex segura y estricta para formato de email
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(
    email.trim()
  );
}

export function validatePhone(phone?: string): boolean {
  if (!phone) return true; // El teléfono puede ser opcional
  // Acepta formato chileno (+569XXXXXXXX, 9XXXXXXXX) o internacional
  return /^\+?[0-9\s\-]{8,15}$/.test(phone.trim());
}

// ============================================================================
// 3. VALIDACIÓN DE FECHAS Y HORAS UTC (RFC3339)
// ============================================================================

/**
 * Verifica si un string es un timestamp RFC3339 UTC válido con terminación 'Z'.
 */
export function isValidRfc3339Utc(dateStr: string): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  if (!dateStr.endsWith('Z')) return false;

  const date = new Date(dateStr);
  return !isNaN(date.getTime()) && date.toISOString() === dateStr;
}

/**
 * Valida que un instante empiece en punto (:00:00.000Z) conforme a los bloques de 60m.
 */
export function isAlignedToHour(dateStr: string): boolean {
  if (!isValidRfc3339Utc(dateStr)) return false;
  const date = new Date(dateStr);
  return (
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  );
}

/**
 * Calcula el final de un slot sumando 3600 segundos exactos.
 */
export function calculateSlotEnd(startAt: string): string {
  const start = new Date(startAt);
  const end = new Date(start.getTime() + SLOT_DURATION_SECONDS * 1000);
  return end.toISOString();
}

// ============================================================================
// 4. VALIDACIÓN DE PROFESIONALES
// ============================================================================

export function isAllowedProfessional(id: unknown): id is ProfessionalId {
  return typeof id === 'string' && ALLOWED_PROFESSIONALS.includes(id as ProfessionalId);
}

// ============================================================================
// 5. RECHAZO DE CAMPOS DESCONOCIDOS / ESTRICTO (S09 L12)
// ============================================================================

/**
 * Valida un objeto asegurando que no contenga claves ajenas a la lista permitida
 * y que contenga todos los campos obligatorios.
 */
export function validateStrictPayload<T extends Record<string, any>>(
  payload: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[]
): { valid: boolean; sanitized?: T; errors?: Record<string, string> } {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { valid: false, errors: { payload: 'PAYLOAD_MUST_BE_OBJECT' } };
  }

  const obj = payload as Record<string, any>;
  const keys = Object.keys(obj);
  const errors: Record<string, string> = {};

  // 1. Detectar campos prohibidos o desconocidos
  for (const key of keys) {
    if (!allowedKeys.includes(key)) {
      errors[key] = 'UNRECOGNIZED_FIELD';
    }
  }

  // 2. Verificar campos obligatorios
  for (const required of requiredKeys) {
    if (obj[required] === undefined || obj[required] === null || obj[required] === '') {
      errors[required] = 'REQUIRED_FIELD_MISSING';
    }
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, sanitized: obj as T };
}

// ============================================================================
// 6. ENLACES DE CONTACTO WHATSAPP (wa.me)
// ============================================================================

/**
 * Normaliza un número telefónico al formato numérico internacional requerido por WhatsApp (wa.me).
 * Elimina caracteres no numéricos y antepone el código de país chileno 56 cuando corresponde.
 */
export function formatWhatsAppPhone(phone?: string): string | null {
  if (!phone || typeof phone !== 'string') return null;
  let digits = phone.replace(/\D/g, '');
  if (!digits) return null;

  // Teléfono chileno estándar de 9 dígitos (móvil 9XXXXXXXX o fijo 2XXXXXXXX)
  if (digits.length === 9) {
    digits = '56' + digits;
  } else if (digits.length === 8) {
    // 8 dígitos antiguos sin 9 inicial
    digits = '569' + digits;
  } else if (digits.length === 10 && digits.startsWith('09')) {
    // Formato discado local 09XXXXXXXX -> 569XXXXXXXX
    digits = '56' + digits.slice(1);
  }

  // Si tiene menos de 8 dígitos, no es un teléfono válido
  if (digits.length < 8) return null;

  return digits;
}

/**
 * Genera una URL canónica para WhatsApp (https://wa.me/<digits>?text=...).
 * Si se incluye texto, se codifica adecuadamente en el query parameter.
 */
export function buildWhatsAppLink(phone?: string, text?: string): string | null {
  const digits = formatWhatsAppPhone(phone);
  if (!digits) return null;

  if (text && text.trim()) {
    return `https://wa.me/${digits}?text=${encodeURIComponent(text.trim())}`;
  }
  return `https://wa.me/${digits}`;
}

