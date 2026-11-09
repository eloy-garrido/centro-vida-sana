/**
 * Centro Vida Sana Austral — Router HTTP Canónico (S09 / S01–S07)
 * Procesa peticiones Web estándar (Request -> Response) para Worker y Entorno Local.
 */

import type { DatabaseAdapter } from './db/adapter.ts';
import {
  extractSessionToken,
  createSessionCookie,
  createClearSessionCookie,
  validateCsrfHeader,
  validateSafeReturnUrl,
  validateSameOrigin,
  escapeHtml
} from './auth/middleware.ts';
import {
  validateSession,
  revokeSession,
  createSession,
  findOrCreateUser,
  createOAuthAttempt,
  consumeOAuthAttempt
} from './auth/session-service.ts';
import {
  generateRandomString,
  sha256Base64Url,
  sha256Hex,
  setPiiEncryptionSecret
} from './auth/crypto.ts';
import {
  validateGoogleIdTokenClaims
} from './auth/oidc-validator.ts';
import {
  ApiCommandError,
  resolveCommand,
  executeCreateBookingCommand,
  executeCancelBookingCommand,
  executeCreateBlockCommand
} from './agenda/commands.ts';
import { getAvailableSlots } from './agenda/availability.ts';
import { getPatientProfile, savePatientProfile } from './agenda/profile.ts';
import {
  getTeamSchedule,
  executeTeamBookingCommand,
  executeEditTeamBookingCommand,
  executeDeleteBlockCommand
} from './agenda/team.ts';
import { getBookingDetails, getCalendarExportData, generateIcsFileContent } from './agenda/details.ts';
import type { ProfessionalId } from '../lib/agendamiento/types.ts';

function jsonResponse(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      ...extraHeaders
    }
  });
}

function errorResponse(code: string, message: string, status: number, fields?: Record<string, string>): Response {
  return jsonResponse({
    error: {
      code,
      message,
      requestId: `req_${Math.random().toString(36).substring(2, 10)}`,
      fields
    }
  }, status);
}

function parseJwtPayload(token: string): any {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('JWT malformado');
  const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const jsonStr = decodeURIComponent(
    atob(base64)
      .split('')
      .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
  return JSON.parse(jsonStr);
}

export interface RouterOptions {
  nowSeconds?: number;
  isDev?: boolean;
  googleClientId?: string;
  googleClientSecret?: string;
  googleRedirectUri?: string;
  env?: Record<string, any>;
}

export async function handleApiRequest(
  request: Request,
  db: DatabaseAdapter,
  options: RouterOptions = {}
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const nowSeconds = options.nowSeconds || Math.floor(Date.now() / 1000);

  if (options.env?.PII_ENCRYPTION_SECRET || options.env?.PII_ENCRYPTION_KEY) {
    setPiiEncryptionSecret(options.env.PII_ENCRYPTION_SECRET || options.env.PII_ENCRYPTION_KEY);
  }

  // 1. Identificar sesión si existe
  const sessionToken = extractSessionToken(request.headers);
  const sessionData = sessionToken ? await validateSession(db, sessionToken, nowSeconds) : null;
  const user = sessionData ? sessionData.user : null;
  const isTeam = sessionData ? sessionData.capabilities.teamAgenda : false;

  // Función interna para verificar CSRF en peticiones mutantes
  function requireCsrf() {
    if (!sessionToken || !sessionData) {
      throw new ApiCommandError('UNAUTHORIZED', 'Sesión no iniciada.', 401);
    }
    if (!validateSameOrigin(request.headers, url.origin)) {
      throw new ApiCommandError('INVALID_CSRF', 'Origen de petición no autorizado.', 403);
    }
    if (!validateCsrfHeader(request.headers, sessionData.csrfToken)) {
      throw new ApiCommandError('INVALID_CSRF', 'Token CSRF inválido o ausente.', 403);
    }
  }

  try {
    // ========================================================================
    // SESIÓN Y AUTENTICACIÓN (S01 / S09)
    // ========================================================================

    if (method === 'GET' && path === '/api/session') {
      if (!user || !sessionToken || !sessionData) {
        return jsonResponse({
          authenticated: false,
          capabilities: { teamAgenda: false }
        });
      }

      return jsonResponse({
        authenticated: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        },
        role: isTeam ? 'team' : 'patient',
        capabilities: {
          teamAgenda: isTeam
        },
        csrfToken: sessionData.csrfToken
      });
    }

    if (method === 'POST' && path === '/api/logout') {
      requireCsrf();
      if (sessionToken) {
        await revokeSession(db, sessionToken, nowSeconds);
      }
      const isHttps = url.protocol === 'https:';
      return jsonResponse(
        { loggedOut: true },
        200,
        { 'Set-Cookie': createClearSessionCookie(isHttps) }
      );
    }

    // Endpoint de autenticación simulada para desarrollo local (D08 / E5)
    if (method === 'POST' && path === '/api/mock-login') {
      const allowMock = options.isDev === true;
      if (!allowMock) {
        return errorResponse('FORBIDDEN', 'Mock login deshabilitado en este entorno.', 403);
      }

      const body = await request.json() as any;
      const targetRole = body.role === 'team' ? 'team' : 'patient';
      const email = targetRole === 'team'
        ? 'centrovida.sanaaustral@gmail.com'
        : (body.email || 'paciente.test@gmail.com');
      const name = targetRole === 'team'
        ? 'Equipo Vida Sana'
        : (body.name || 'Paciente Ficticio');

      const emailHash = (await sha256Hex(email)).slice(0, 24);
      const mockSub = `mock_sub_${emailHash}`;
      const dbUser = await findOrCreateUser(db, { googleSub: mockSub, name, email });
      const newSession = await createSession(db, dbUser.id, { nowSeconds });

      const isHttps = url.protocol === 'https:';
      return jsonResponse(
        {
          success: true,
          user: { id: dbUser.id, name: dbUser.name, email: dbUser.email },
          role: targetRole,
          csrfToken: newSession.csrfToken
        },
        200,
        { 'Set-Cookie': createSessionCookie(newSession.rawToken, { isHttps }) }
      );
    }

    // ========================================================================
    // OAUTH GOOGLE DE IDENTIDAD (S01 / D08 / S09)
    // ========================================================================

    if (method === 'GET' && path === '/auth/google/start') {
      const returnTo = validateSafeReturnUrl(url.searchParams.get('returnTo'));
      const clientId = options.googleClientId || options.env?.GOOGLE_CLIENT_ID || (typeof process !== 'undefined' ? process.env?.GOOGLE_CLIENT_ID : undefined);
      const redirectUri = options.googleRedirectUri || options.env?.GOOGLE_REDIRECT_URI || (typeof process !== 'undefined' ? process.env?.GOOGLE_REDIRECT_URI : undefined) || `${url.origin}/auth/google/callback`;

      if (!clientId) {
        return errorResponse('OIDC_NOT_CONFIGURED', 'Google OAuth no está configurado aún en este entorno.', 503);
      }

      const codeVerifier = generateRandomString(32);
      const codeChallenge = await sha256Base64Url(codeVerifier);
      const nonce = generateRandomString(24);

      const attempt = await createOAuthAttempt(db, {
        returnTo,
        codeVerifier,
        nonce
      });

      const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      googleAuthUrl.searchParams.set('client_id', clientId);
      googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
      googleAuthUrl.searchParams.set('response_type', 'code');
      googleAuthUrl.searchParams.set('scope', 'openid email profile');
      googleAuthUrl.searchParams.set('state', attempt.state);
      googleAuthUrl.searchParams.set('nonce', nonce);
      googleAuthUrl.searchParams.set('code_challenge', codeChallenge);
      googleAuthUrl.searchParams.set('code_challenge_method', 'S256');
      googleAuthUrl.searchParams.set('prompt', 'select_account');

      return new Response(null, {
        status: 302,
        headers: {
          Location: googleAuthUrl.toString(),
          'Cache-Control': 'no-store'
        }
      });
    }

    if (method === 'GET' && path === '/auth/google/callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (error || !code || !state) {
        const safeError = escapeHtml(error || 'código o estado ausente');
        return new Response(`Error de autenticación con Google: ${safeError}. <a href="/">Volver al inicio</a>`, {
          status: 400,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'"
          }
        });
      }

      const attempt = await consumeOAuthAttempt(db, state, nowSeconds);
      if (!attempt) {
        return new Response('El intento de inicio de sesión ha expirado o ya fue utilizado. Por favor intenta nuevamente. <a href="/">Volver al inicio</a>', {
          status: 400,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'"
          }
        });
      }

      const clientId = options.googleClientId || options.env?.GOOGLE_CLIENT_ID || (typeof process !== 'undefined' ? process.env?.GOOGLE_CLIENT_ID : undefined);
      const clientSecret = options.googleClientSecret || options.env?.GOOGLE_CLIENT_SECRET || (typeof process !== 'undefined' ? process.env?.GOOGLE_CLIENT_SECRET : undefined);
      const redirectUri = options.googleRedirectUri || options.env?.GOOGLE_REDIRECT_URI || (typeof process !== 'undefined' ? process.env?.GOOGLE_REDIRECT_URI : undefined) || `${url.origin}/auth/google/callback`;

      if (!clientId || !clientSecret) {
        return errorResponse('OIDC_NOT_CONFIGURED', 'Credenciales de Google OAuth no configuradas.', 503);
      }

      // Intercambio de código por tokens con Google
      const tokenParams = new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: attempt.codeVerifier
      });

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenParams.toString()
      });

      if (!tokenRes.ok) {
        const errBody = await tokenRes.text();
        console.error('Error al intercambiar código con Google:', errBody);
        return new Response('Error al verificar las credenciales con Google. <a href="/">Volver al inicio</a>', {
          status: 502,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'"
          }
        });
      }

      const tokenData = await tokenRes.json() as { id_token?: string };
      if (!tokenData.id_token) {
        return new Response('Google no retornó un id_token válido. <a href="/">Volver al inicio</a>', {
          status: 502,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'"
          }
        });
      }

      let claims: any;
      try {
        claims = parseJwtPayload(tokenData.id_token);
      } catch {
        return new Response('No se pudieron leer los datos del token de Google. <a href="/">Volver al inicio</a>', {
          status: 400,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'"
          }
        });
      }

      const validation = validateGoogleIdTokenClaims(claims, {
        expectedClientId: clientId,
        expectedNonce: attempt.nonce,
        nowSeconds
      });

      if (!validation.valid || !validation.user) {
        const safeError = escapeHtml(validation.error || 'error desconocido');
        return new Response(`Token de Google rechazado por seguridad: ${safeError}. <a href="/">Volver al inicio</a>`, {
          status: 403,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'"
          }
        });
      }

      const dbUser = await findOrCreateUser(db, validation.user);
      const session = await createSession(db, dbUser.id, { nowSeconds });
      const isHttps = url.protocol === 'https:';

      return new Response(null, {
        status: 302,
        headers: {
          Location: attempt.returnTo,
          'Set-Cookie': createSessionCookie(session.rawToken, { isHttps }),
          'Cache-Control': 'no-store'
        }
      });
    }

    // ========================================================================
    // PERFIL DE PACIENTE (S02 / D05 / S09)
    // ========================================================================

    if (method === 'GET' && path === '/api/patient-profile') {
      if (!user) {
        return errorResponse('UNAUTHORIZED', 'Debe iniciar sesión para ver su perfil.', 401);
      }
      const profile = await getPatientProfile(db, user.id);
      return jsonResponse(profile);
    }

    if (method === 'PUT' && path === '/api/patient-profile') {
      if (!user) {
        return errorResponse('UNAUTHORIZED', 'Debe iniciar sesión para guardar su perfil.', 401);
      }
      requireCsrf();
      const body = await request.json() as any;
      const ifMatch = request.headers.get('If-Match');
      const ifNoneMatch = request.headers.get('If-None-Match');

      const saved = await savePatientProfile(
        db,
        user.id,
        {
          name: body.name,
          email: body.email,
          rut: body.rut,
          documentType: body.documentType || 'rut',
          phone: body.phone || ''
        },
        body.consentVersion || 'v1.0',
        { ifMatch, ifNoneMatch },
        nowSeconds
      );
      return jsonResponse(saved);
    }

    // ========================================================================
    // DISPONIBILIDAD (S03 / S09)
    // ========================================================================

    if (method === 'GET' && path === '/api/availability') {
      const prof = url.searchParams.get('professionalId') as ProfessionalId;
      const from = url.searchParams.get('from');
      const to = url.searchParams.get('to');

      if (!prof || (prof !== 'felipe' && prof !== 'eduardo')) {
        return errorResponse('VALIDATION_ERROR', 'Profesional inválido. Debe ser felipe o eduardo.', 400);
      }
      if (!from || !to) {
        return errorResponse('VALIDATION_ERROR', 'Parámetros from y to (YYYY-MM-DD) requeridos.', 400);
      }

      const avail = await getAvailableSlots(db, {
        professionalId: prof,
        fromDate: from,
        toDate: to,
        nowSeconds
      });
      return jsonResponse(avail);
    }

    // ========================================================================
    // RESERVAS DE PACIENTES (S04 / S09)
    // ========================================================================

    if (method === 'POST' && path === '/api/bookings') {
      if (!user) {
        return errorResponse('UNAUTHORIZED', 'Debe iniciar sesión para agendar una cita.', 401);
      }
      requireCsrf();
      const idempotencyKey = request.headers.get('Idempotency-Key');
      if (!idempotencyKey) {
        return errorResponse('VALIDATION_ERROR', 'Cabecera Idempotency-Key requerida.', 400);
      }

      const body = await request.json() as any;
      const result = await executeCreateBookingCommand(
        db,
        { id: user.id, email: user.email },
        idempotencyKey,
        body,
        nowSeconds
      );

      const status = result.isReplay ? 200 : 201;
      const headers = result.isReplay ? { 'Idempotent-Replay': 'true' } : {};
      return jsonResponse(result.result, status, headers);
    }

    // ========================================================================
    // RESOLVE DE COMANDOS E IDEMPOTENCIA (S09 / P03)
    // ========================================================================

    if (method === 'POST' && path === '/api/commands/resolve') {
      if (!user) {
        return errorResponse('UNAUTHORIZED', 'Sesión requerida.', 401);
      }
      requireCsrf();
      const body = await request.json() as any;
      if (!body.idempotencyKey) {
        return errorResponse('VALIDATION_ERROR', 'idempotencyKey requerido.', 400);
      }

      const resolved = await resolveCommand(
        db,
        user.id,
        body.idempotencyKey,
        body.method,
        body.path
      );
      return jsonResponse(resolved);
    }

    // ========================================================================
    // DETALLE DE RESERVA Y CALENDARIO (S04 / S05 / S06 / S09)
    // ========================================================================

    const bookingCalendarMatch = path.match(/^\/api\/bookings\/([^/]+)\/calendar$/);
    if (method === 'GET' && bookingCalendarMatch) {
      if (!user) {
        return errorResponse('UNAUTHORIZED', 'Sesión requerida.', 401);
      }
      const bookingId = bookingCalendarMatch[1];
      const format = url.searchParams.get('format');

      if (format === 'ics') {
        const icsContent = await generateIcsFileContent(db, bookingId, { id: user.id, isTeam });
        return new Response(icsContent, {
          status: 200,
          headers: {
            'Content-Type': 'text/calendar; charset=utf-8',
            'Content-Disposition': `attachment; filename="cita-vidasana-${bookingId}.ics"`,
            'Cache-Control': 'private, no-store'
          }
        });
      }

      const exportData = await getCalendarExportData(db, bookingId, { id: user.id, isTeam });
      return jsonResponse(exportData);
    }

    const bookingDetailMatch = path.match(/^\/api\/bookings\/([^/]+)$/);
    if (method === 'GET' && bookingDetailMatch) {
      if (!user) {
        return errorResponse('UNAUTHORIZED', 'Sesión requerida.', 401);
      }
      const bookingId = bookingDetailMatch[1];
      const detail = await getBookingDetails(db, bookingId, { id: user.id, isTeam });
      return jsonResponse(detail);
    }

    // ========================================================================
    // ENDPOINTS DEL EQUIPO (S05 / S09)
    // ========================================================================

    if (path.startsWith('/api/team/')) {
      if (!user) {
        return errorResponse('UNAUTHORIZED', 'Sesión requerida.', 401);
      }
      if (!isTeam) {
        return errorResponse('FORBIDDEN', 'Acceso restringido al equipo de la clínica.', 403);
      }

      // 1. Horario / Agenda del equipo
      if (method === 'GET' && path === '/api/team/schedule') {
        const prof = url.searchParams.get('professionalId') as ProfessionalId;
        const from = url.searchParams.get('from');
        const to = url.searchParams.get('to');

        if (!prof || (prof !== 'felipe' && prof !== 'eduardo')) {
          return errorResponse('VALIDATION_ERROR', 'professionalId inválido.', 400);
        }
        if (!from || !to) {
          return errorResponse('VALIDATION_ERROR', 'from y to requeridos.', 400);
        }

        const schedule = await getTeamSchedule(db, prof, from, to, nowSeconds);
        return jsonResponse(schedule);
      }

      // 2. Agendamiento manual del equipo
      if (method === 'POST' && path === '/api/team/bookings') {
        requireCsrf();
        const idempotencyKey = request.headers.get('Idempotency-Key');
        if (!idempotencyKey) {
          return errorResponse('VALIDATION_ERROR', 'Idempotency-Key requerida.', 400);
        }
        const body = await request.json() as any;
        const result = await executeTeamBookingCommand(
          db,
          { id: user.id, email: user.email },
          idempotencyKey,
          body,
          nowSeconds
        );
        return jsonResponse(result.result, result.isReplay ? 200 : 201);
      }

      // 3. Edición de cita por equipo (PATCH)
      const teamBookingEditMatch = path.match(/^\/api\/team\/bookings\/([^/]+)$/);
      if (method === 'PATCH' && teamBookingEditMatch) {
        requireCsrf();
        const bookingId = teamBookingEditMatch[1];
        const ifMatch = request.headers.get('If-Match');
        if (!ifMatch) {
          return errorResponse('VERSION_REQUIRED', 'Cabecera If-Match requerida para modificar.', 428);
        }
        const idempotencyKey = request.headers.get('Idempotency-Key') || undefined;
        const body = await request.json() as any;
        const result = await executeEditTeamBookingCommand(
          db,
          { id: user.id },
          bookingId,
          ifMatch,
          body,
          nowSeconds,
          idempotencyKey
        );
        return jsonResponse(result, 200);
      }

      // 4. Cancelación de cita por equipo (DELETE)
      if (method === 'DELETE' && teamBookingEditMatch) {
        requireCsrf();
        const bookingId = teamBookingEditMatch[1];
        const ifMatch = request.headers.get('If-Match');
        if (!ifMatch) {
          return errorResponse('VERSION_REQUIRED', 'Cabecera If-Match requerida para cancelar.', 428);
        }
        const result = await executeCancelBookingCommand(
          db,
          { id: user.id, isTeam: true },
          bookingId,
          ifMatch,
          nowSeconds
        );
        return jsonResponse(result, 200);
      }

      // 5. Creación de bloqueo de agenda
      if (method === 'POST' && path === '/api/team/blocks') {
        requireCsrf();
        const idempotencyKey = request.headers.get('Idempotency-Key');
        if (!idempotencyKey) {
          return errorResponse('VALIDATION_ERROR', 'Idempotency-Key requerida.', 400);
        }
        const body = await request.json() as any;
        const result = await executeCreateBlockCommand(
          db,
          { id: user.id },
          idempotencyKey,
          body,
          nowSeconds
        );
        return jsonResponse(result.result, result.isReplay ? 200 : 201);
      }

      // 6. Eliminación de bloqueo de agenda
      const teamBlockMatch = path.match(/^\/api\/team\/blocks\/([^/]+)$/);
      if (method === 'DELETE' && teamBlockMatch) {
        requireCsrf();
        const blockId = teamBlockMatch[1];
        const ifMatch = request.headers.get('If-Match');
        if (!ifMatch) {
          return errorResponse('VERSION_REQUIRED', 'Cabecera If-Match requerida.', 428);
        }
        const result = await executeDeleteBlockCommand(
          db,
          { id: user.id },
          blockId,
          ifMatch,
          nowSeconds
        );
        return jsonResponse(result, 200);
      }
    }

    return errorResponse('NOT_FOUND', `Ruta API no encontrada: ${method} ${path}`, 404);
  } catch (err: any) {
    if (err instanceof ApiCommandError) {
      return errorResponse(err.code, err.message, err.status, err.fields);
    }
    console.error('Unhandled API Router Error:', err);
    return errorResponse('INTERNAL_SERVER_ERROR', 'Ocurrió un error inesperado en el servidor.', 500);
  }
}
