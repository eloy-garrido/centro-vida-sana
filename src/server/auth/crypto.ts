/**
 * Centro Vida Sana Austral — Criptografía y tokens de seguridad
 * Compatible con Cloudflare Workers (WebCrypto API) y Node 22.
 * Conforme a S01 (PKCE S256, hash de sesiones y CSRF).
 */

/**
 * Convierte un ArrayBuffer a cadena hexadecimal.
 */
export function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Convierte un ArrayBuffer a base64url (sin padding '=', reemplazando + por - y / por _).
 */
export function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Genera una cadena aleatoria criptográficamente segura.
 */
export function generateRandomString(bytesCount = 32): string {
  const bytes = new Uint8Array(bytesCount);
  crypto.getRandomValues(bytes);
  return bufferToBase64Url(bytes.buffer);
}

/**
 * Calcula el hash SHA-256 de una cadena y lo retorna en hexadecimal.
 */
export async function sha256Hex(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  return bufferToHex(hashBuffer);
}

/**
 * Calcula el hash SHA-256 de una cadena y lo retorna en base64url.
 */
export async function sha256Base64Url(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  return bufferToBase64Url(hashBuffer);
}

/**
 * Genera el par PKCE (code_verifier y code_challenge con método S256).
 */
export async function generatePkce(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  // Código verificador aleatorio de 64 bytes
  const codeVerifier = generateRandomString(48);
  const codeChallenge = await sha256Base64Url(codeVerifier);
  return { codeVerifier, codeChallenge };
}

/**
 * Comparación segura contra ataques de temporización (timing attack).
 */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Convierte una cadena base64url a Uint8Array.
 */
export function base64UrlToBuffer(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

const DEFAULT_PII_KEY = 'vsa-local-dev-pii-key-2026';

let globalPiiSecret: string | null = null;

/**
 * Establece el secreto global de cifrado de PII (ej. desde Cloudflare Workers env.PII_ENCRYPTION_SECRET).
 */
export function setPiiEncryptionSecret(secret: string): void {
  if (secret && typeof secret === 'string' && secret.trim()) {
    globalPiiSecret = secret.trim();
  }
}

/**
 * Obtiene el secreto global configurado de cifrado de PII si existe.
 */
export function getPiiEncryptionSecret(): string | null {
  return globalPiiSecret;
}

/**
 * Deriva una CryptoKey de 256 bits para AES-GCM a partir de un secreto mediante SHA-256.
 */
async function deriveAesGcmKey(secret?: string): Promise<CryptoKey> {
  const envSecret = typeof process !== 'undefined'
    ? (process.env?.PII_ENCRYPTION_SECRET || process.env?.PII_ENCRYPTION_KEY)
    : undefined;
  const effectiveSecret = secret || globalPiiSecret || envSecret || DEFAULT_PII_KEY;
  const encoder = new TextEncoder();
  const rawKeyHash = await crypto.subtle.digest('SHA-256', encoder.encode(effectiveSecret));
  return crypto.subtle.importKey(
    'raw',
    rawKeyHash,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Cifra un payload de datos personales (PII / RUT) en formato AES-256-GCM retornando 'enc:v1:iv:ciphertext'.
 */
export async function encryptPiiJson(payload: unknown, secret?: string): Promise<string> {
  if (payload === null || payload === undefined) {
    return '';
  }
  const key = await deriveAesGcmKey(secret);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const encoder = new TextEncoder();
  const encodedData = encoder.encode(JSON.stringify(payload));
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedData
  );
  return `enc:v1:${bufferToBase64Url(iv.buffer)}:${bufferToBase64Url(ciphertextBuffer)}`;
}

/**
 * Descifra un payload cifrado con AES-256-GCM.
 * Si el contenido no tiene el prefijo 'enc:v1:', intenta parsearlo como JSON directamente (compatibilidad con datos legados).
 */
export async function decryptPiiJson<T = Record<string, any>>(
  stored: string | null | undefined,
  secret?: string
): Promise<T | null> {
  if (!stored) return null;
  const trimmed = stored.trim();
  if (!trimmed) return null;

  if (!trimmed.startsWith('enc:v1:')) {
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      return null;
    }
  }

  try {
    const parts = trimmed.split(':');
    if (parts.length !== 4) return null;
    const iv = base64UrlToBuffer(parts[2]);
    const ciphertext = base64UrlToBuffer(parts[3]);
    const key = await deriveAesGcmKey(secret);
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decryptedBuffer)) as T;
  } catch {
    return null;
  }
}

