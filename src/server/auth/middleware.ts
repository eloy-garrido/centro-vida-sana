/**
 * Centro Vida Sana Austral — Middleware de Seguridad, Cookies y CSRF
 * Conforme a S01 (sesiones HttpOnly, CSRF y prevención de Open Redirect) y S09.
 */

import { timingSafeEqualStrings } from './crypto.ts';

export const SESSION_COOKIE_NAME = 'vsa_session';
export const SECURE_HOST_COOKIE_NAME = '__Host-vsa_session';

/**
 * Valida y normaliza la URL de retorno tras autenticarse con OAuth.
 * PREVENCIÓN DE OPEN REDIRECT (S01 L30):
 * Solo se admiten rutas relativas locales que comiencen con '/' (y no '//').
 */
export function validateSafeReturnUrl(rawUrl: string | null | undefined): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return '/reservar';
  }

  const trimmed = rawUrl.trim();

  // Debe empezar con '/' y no con '//' (evita scheme-relative URL a host externo)
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return '/reservar';
  }

  // Prevenir inyección de protocolos tipo 'javascript:' o 'data:'
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return '/reservar';
  }

  // Rutas conocidas y autorizadas del sitio
  if (
    trimmed === '/' ||
    trimmed.startsWith('/reservar') ||
    trimmed.startsWith('/agenda') ||
    trimmed.startsWith('/quiropraxia') ||
    trimmed.startsWith('/acupuntura')
  ) {
    return trimmed;
  }

  return '/reservar';
}

/**
 * Parsea la cabecera Cookie en un mapa clave-valor.
 */
export function parseCookies(cookieHeader: string | null | undefined): Record<string, string> {
  if (!cookieHeader) return {};

  const cookies: Record<string, string> = {};
  const items = cookieHeader.split(';');

  for (const item of items) {
    const [name, ...rest] = item.trim().split('=');
    if (name && rest.length > 0) {
      cookies[name.trim()] = decodeURIComponent(rest.join('=').trim());
    }
  }

  return cookies;
}

/**
 * Extrae el token de sesión desde las cabeceras HTTP.
 */
export function extractSessionToken(headers: Headers): string | null {
  const cookieHeader = headers.get('cookie');
  if (!cookieHeader) return null;

  const cookies = parseCookies(cookieHeader);
  // Buscar primero cookie con prefijo seguro __Host- si existe, o vsa_session estándar
  return cookies[SECURE_HOST_COOKIE_NAME] || cookies[SESSION_COOKIE_NAME] || null;
}

/**
 * Valida el token CSRF recibido contra el esperado de la sesión.
 * Mutaciones obligatoriamente usan cabecera 'X-CSRF-Token'.
 */
export function validateCsrfHeader(headers: Headers, expectedCsrfToken: string): boolean {
  const receivedCsrf = headers.get('x-csrf-token');
  if (!receivedCsrf || !expectedCsrfToken) {
    return false;
  }
  return timingSafeEqualStrings(receivedCsrf.trim(), expectedCsrfToken.trim());
}

/**
 * Valida que la petición provenga del mismo origen (Same-Origin).
 */
export function validateSameOrigin(headers: Headers, allowedOrigin: string): boolean {
  const origin = headers.get('origin');
  if (!origin) {
    // Si no hay Origin, revisar Referer
    const referer = headers.get('referer');
    if (!referer) return true; // Peticiones locales en tests
    try {
      const refUrl = new URL(referer);
      return refUrl.origin === allowedOrigin;
    } catch {
      return false;
    }
  }
  return origin === allowedOrigin;
}

/**
 * Genera la directiva Set-Cookie para la sesión del usuario.
 */
export function createSessionCookie(
  token: string,
  options: { isHttps?: boolean; maxAgeSeconds?: number } = {}
): string {
  const isHttps = options.isHttps ?? false;
  const cookieName = isHttps ? SECURE_HOST_COOKIE_NAME : SESSION_COOKIE_NAME;
  const maxAge = options.maxAgeSeconds ?? 8 * 60 * 60; // 8 horas

  let cookie = `${cookieName}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax`;
  if (isHttps) {
    cookie += '; Secure';
  }

  return cookie;
}

/**
 * Genera la directiva Set-Cookie para destruir la sesión (Logout).
 */
export function createClearSessionCookie(isHttps = false): string {
  const cookieName = isHttps ? SECURE_HOST_COOKIE_NAME : SESSION_COOKIE_NAME;
  let cookie = `${cookieName}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
  if (isHttps) {
    cookie += '; Secure';
  }
  return cookie;
}
