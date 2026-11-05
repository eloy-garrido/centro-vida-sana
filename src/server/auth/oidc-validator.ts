/**
 * Centro Vida Sana Austral — Validador Canónico OIDC de Google
 * Conforme a S01 (identidad sin Calendar API) y D08.
 */

export interface GoogleIdTokenClaims {
  iss: string;
  aud: string;
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  nonce?: string;
  exp: number; // Unix timestamp en segundos
  iat?: number;
}

export interface OidcValidationResult {
  valid: boolean;
  user?: {
    googleSub: string;
    name: string;
    email: string;
  };
  error?: string;
}

export const GOOGLE_VALID_ISSUERS = [
  'https://accounts.google.com',
  'accounts.google.com'
] as const;

/**
 * Valida de forma estricta los claims de un ID Token de Google OIDC.
 * Cumple los criterios de AUTH-02:
 * 1. Emisor admitido (iss)
 * 2. Audiencia exacta (aud == clientId)
 * 3. Token no expirado (exp > now)
 * 4. Nonce coincidente con el intento de OAuth
 * 5. Correo verificado (email_verified == true)
 * 6. Identificador único de usuario presente (sub)
 */
export function validateGoogleIdTokenClaims(
  claims: unknown,
  params: {
    expectedClientId: string;
    expectedNonce: string;
    nowSeconds?: number;
  }
): OidcValidationResult {
  if (!claims || typeof claims !== 'object') {
    return { valid: false, error: 'OIDC_CLAIMS_INVALID_OBJECT' };
  }

  const c = claims as GoogleIdTokenClaims;
  const now = params.nowSeconds ?? Math.floor(Date.now() / 1000);

  // 1. Validar emisor (iss)
  if (!GOOGLE_VALID_ISSUERS.includes(c.iss as any)) {
    return { valid: false, error: 'OIDC_INVALID_ISSUER' };
  }

  // 2. Validar audiencia exacta (aud)
  if (!c.aud || c.aud !== params.expectedClientId) {
    return { valid: false, error: 'OIDC_AUDIENCE_MISMATCH' };
  }

  // 3. Validar expiración (exp)
  if (!c.exp || typeof c.exp !== 'number' || c.exp <= now) {
    return { valid: false, error: 'OIDC_TOKEN_EXPIRED' };
  }

  // 4. Validar nonce (anti-replay)
  if (!c.nonce || c.nonce !== params.expectedNonce) {
    return { valid: false, error: 'OIDC_NONCE_MISMATCH' };
  }

  // 5. Validar correo verificado
  if (c.email_verified !== true) {
    return { valid: false, error: 'OIDC_EMAIL_NOT_VERIFIED' };
  }

  // 6. Validar identidad del usuario (sub y email)
  if (!c.sub || typeof c.sub !== 'string' || c.sub.trim() === '') {
    return { valid: false, error: 'OIDC_SUB_MISSING' };
  }

  if (!c.email || typeof c.email !== 'string' || !c.email.includes('@')) {
    return { valid: false, error: 'OIDC_EMAIL_INVALID' };
  }

  const name = (c.name && typeof c.name === 'string' && c.name.trim()) || c.email.split('@')[0];

  return {
    valid: true,
    user: {
      googleSub: c.sub,
      name,
      email: c.email.toLowerCase().trim()
    }
  };
}

/**
 * Generador de claims OIDC simulados para pruebas locales y arnés QA.
 */
export function createMockIdTokenClaims(overrides?: Partial<GoogleIdTokenClaims>): GoogleIdTokenClaims {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: 'https://accounts.google.com',
    aud: 'vsa-google-client-id-local.apps.googleusercontent.com',
    sub: 'google_sub_mock_11223344',
    email: 'paciente.test@gmail.com',
    email_verified: true,
    name: 'Paciente Test',
    nonce: 'nonce_mock_default_123',
    exp: now + 3600,
    iat: now,
    ...overrides
  };
}
