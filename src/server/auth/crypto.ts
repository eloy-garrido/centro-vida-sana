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
