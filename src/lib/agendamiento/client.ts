/**
 * Centro Vida Sana Austral — Cliente API Frontend (S04 / S05 / S09)
 * Abstracción de red typed para los flujos de Paciente y Panel de Equipo.
 */

import type {
  CreateBookingRequest,
  MutationResult,
  PatientProfilePayload,
  ProfessionalId,
  ResolveCommandResponse,
  SessionResponse
} from './types.ts';

export class ApiError extends Error {
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

async function requestJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  const res = await fetch(url, { ...options, headers });
  const isJson = res.headers.get('content-type')?.includes('application/json');

  if (!res.ok) {
    let errorData: any = null;
    if (isJson) {
      try {
        errorData = await res.json();
      } catch {
        // fallback
      }
    }
    const err = errorData?.error;
    throw new ApiError(
      err?.code || 'HTTP_ERROR',
      err?.message || `Error del servidor (${res.status})`,
      res.status,
      err?.fields
    );
  }

  return isJson ? await res.json() : (null as unknown as T);
}

export const AgendamientoClient = {
  /**
   * Consulta la sesión actual del usuario.
   */
  async getSession(): Promise<SessionResponse> {
    return requestJson<SessionResponse>('/api/session');
  },

  /**
   * Login simulado para entorno de desarrollo local.
   */
  async mockLogin(role: 'patient' | 'team', email?: string, name?: string): Promise<any> {
    return requestJson('/api/mock-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, email, name })
    });
  },

  /**
   * Cierra la sesión activa.
   */
  async logout(csrfToken: string): Promise<void> {
    await requestJson('/api/logout', {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken }
    });
  },

  /**
   * Obtiene el perfil del paciente guardado en la cuenta.
   */
  async getPatientProfile(): Promise<{ profile: PatientProfilePayload | null; version: string | null }> {
    return requestJson('/api/patient-profile');
  },

  /**
   * Guarda o actualiza el perfil del paciente.
   */
  async savePatientProfile(
    profile: PatientProfilePayload,
    version: string | null,
    csrfToken: string
  ): Promise<{ profile: PatientProfilePayload; version: string }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken
    };
    if (version) {
      headers['If-Match'] = version;
    } else {
      headers['If-None-Match'] = '*';
    }

    return requestJson('/api/patient-profile', {
      method: 'PUT',
      headers,
      body: JSON.stringify({ ...profile, consentVersion: 'v1.0' })
    });
  },

  /**
   * Consulta los cupos disponibles para un profesional en un rango de fechas.
   */
  async getAvailability(
    professionalId: ProfessionalId,
    fromDate: string,
    toDate: string
  ): Promise<{
    professionalId: ProfessionalId;
    timeZone: string;
    slots: Array<{ startAt: string; endAt: string }>;
  }> {
    const query = new URLSearchParams({ professionalId, from: fromDate, to: toDate });
    return requestJson(`/api/availability?${query.toString()}`);
  },

  /**
   * Crea una reserva como paciente con idempotencia y protección CSRF.
   */
  async createBooking(
    payload: CreateBookingRequest,
    idempotencyKey: string,
    csrfToken: string
  ): Promise<MutationResult> {
    return requestJson<MutationResult>('/api/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
        'Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify(payload)
    });
  },

  /**
   * Recupera el recibo de un comando de forma segura tras timeout o pérdida de respuesta (S09).
   */
  async resolveCommand(
    idempotencyKey: string,
    csrfToken: string,
    method = 'POST',
    path = '/api/bookings'
  ): Promise<ResolveCommandResponse> {
    return requestJson<ResolveCommandResponse>('/api/commands/resolve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
      },
      body: JSON.stringify({ idempotencyKey, method, path })
    });
  },

  /**
   * Obtiene el detalle de una reserva confirmada.
   */
  async getBooking(bookingId: string): Promise<{ booking: any }> {
    return requestJson(`/api/bookings/${bookingId}`);
  },

  /**
   * Obtiene las opciones de exportación a calendario personal sin PII (S06).
   */
  async getCalendarExport(bookingId: string): Promise<{
    googleUrl: string;
    icsUrl: string;
    warning: string;
    bookingVersion: string;
  }> {
    return requestJson(`/api/bookings/${bookingId}/calendar`);
  },

  // ==========================================================================
  // OPERACIONES DE EQUIPO (S05)
  // ==========================================================================

  /**
   * Consulta la agenda completa del equipo para un profesional.
   */
  async getTeamSchedule(
    professionalId: ProfessionalId,
    fromDate: string,
    toDate: string
  ): Promise<any> {
    const query = new URLSearchParams({ professionalId, from: fromDate, to: toDate });
    return requestJson(`/api/team/schedule?${query.toString()}`);
  },

  /**
   * Crea una cita manual por parte del equipo.
   */
  async createTeamBooking(
    payload: CreateBookingRequest,
    idempotencyKey: string,
    csrfToken: string
  ): Promise<MutationResult> {
    return requestJson<MutationResult>('/api/team/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
        'Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify(payload)
    });
  },

  /**
   * Cancela una cita por parte del equipo con control de versión If-Match.
   */
  async cancelTeamBooking(
    bookingId: string,
    version: string,
    csrfToken: string
  ): Promise<MutationResult> {
    const etag = version ? (version.startsWith('"') ? version : `"${version}"`) : '"v1"';
    return requestJson<MutationResult>(`/api/team/bookings/${bookingId}`, {
      method: 'DELETE',
      headers: {
        'X-CSRF-Token': csrfToken,
        'If-Match': etag
      }
    });
  },

  /**
   * Crea un bloqueo administrativo en la agenda del equipo.
   */
  async createTeamBlock(
    professionalId: ProfessionalId,
    startAt: string,
    endAt: string,
    idempotencyKey: string,
    csrfToken: string
  ): Promise<MutationResult> {
    return requestJson<MutationResult>('/api/team/blocks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
        'Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify({ professionalId, startAt, endAt })
    });
  },

  /**
   * Retira un bloqueo administrativo liberando el horario.
   */
  async deleteTeamBlock(
    blockId: string,
    version: string,
    csrfToken: string
  ): Promise<MutationResult> {
    const etag = version ? (version.startsWith('"') ? version : `"${version}"`) : '"v1"';
    return requestJson<MutationResult>(`/api/team/blocks/${blockId}`, {
      method: 'DELETE',
      headers: {
        'X-CSRF-Token': csrfToken,
        'If-Match': etag
      }
    });
  }
};
