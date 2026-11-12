/**
 * Centro Vida Sana Austral — Contratos y Tipos Canónicos de Agendamiento
 * Conforme a S01–S09 y Decisiones D01–D07 de la Fase 0 (2026-11-05).
 */

// ============================================================================
// CONSTANTES DE NEGOCIO Y CONFIGURACIÓN
// ============================================================================

export const CLINIC_TIMEZONE = 'America/Santiago' as const;
export const SLOT_DURATION_SECONDS = 3600; // 60 minutos exactos
export const SLOT_DURATION_MINUTES = 60;

export const ALLOWED_PROFESSIONALS = ['felipe', 'eduardo'] as const;
export type ProfessionalId = (typeof ALLOWED_PROFESSIONALS)[number];

export const TEAM_ALLOWED_EMAILS = [
  'centrovida.sanaaustral@gmail.com'
] as const;

export const WORKING_SCHEDULE_CONFIG = {
  timeZone: CLINIC_TIMEZONE,
  slotDurationSeconds: SLOT_DURATION_SECONDS,
  patientWindow: {
    minDaysAhead: 1, // Mañana (D+1)
    maxDaysAhead: 7  // Hasta 7 días inclusive (D+7)
  },
  teamWindow: {
    allowToday: true, // Hoy (D+0)
    monthBoundary: 'current_month' as const // Dentro del mes en curso
  },
  hours: {
    mondayToFriday: {
      open: '09:00',
      close: '21:00',
      breakStart: '13:00',
      breakEnd: '14:00'
    },
    saturday: {
      open: '09:00',
      close: '14:00'
    },
    sunday: null // Cerrado
  }
} as const;

// ============================================================================
// IDENTIDAD, SESIÓN Y PERMISOS (S01 / S09)
// ============================================================================

export interface UserSession {
  id: string; // ID opaco de usuario (hash/sub)
  name: string;
  email: string;
  isGuest?: boolean;
}

export interface SessionCapabilities {
  teamAgenda: boolean; // true si pertenece a TEAM_ALLOWED_EMAILS
}

export type SessionResponse =
  | { authenticated: false }
  | {
      authenticated: true;
      user: UserSession;
      capabilities: SessionCapabilities;
      csrfToken: string;
    };

// ============================================================================
// DATOS DEL PACIENTE Y PERFIL RECORDADO (S02 / D05)
// ============================================================================

export type DocumentType = 'rut' | 'passport' | 'other';

export interface PatientSnapshot {
  name: string;
  email: string;
  rut: string; // Formato normalizado (ej. 12.345.678-K o Pasaporte)
  documentType: DocumentType;
  phone?: string;
}

export interface PatientProfile extends PatientSnapshot {
  consentVersion: string;
  updatedAt?: string;
}

export interface PatientProfileResponse {
  profile: PatientProfile | null;
  version?: string; // Etiqueta ETag / versión opaca para If-Match
}

export interface SavePatientProfileRequest {
  name: string;
  email: string;
  rut: string;
  documentType?: DocumentType;
  phone?: string;
  consentVersion: string;
}

// ============================================================================
// DISPONIBILIDAD Y CUPOS (S03 / S09)
// ============================================================================

export interface TimeSlot {
  startAt: string; // RFC3339 UTC ('2026-11-06T12:00:00Z')
  endAt: string;   // RFC3339 UTC (+3600s)
  available?: boolean; // Indicador de disponibilidad (true = libre, false = ocupado por otro paciente/bloqueo)
}

export interface AvailabilityQuery {
  professionalId: ProfessionalId;
  from: string; // Formato fecha local YYYY-MM-DD
  to: string;   // Formato fecha local YYYY-MM-DD (rango [from, to))
}

export interface AvailabilityResponse {
  professionalId: ProfessionalId;
  timeZone: typeof CLINIC_TIMEZONE;
  eligibleDateRange: {
    from: string; // YYYY-MM-DD
    to: string;   // YYYY-MM-DD
  };
  slots: TimeSlot[]; // Cupos disponibles (conservado para compatibilidad S09)
  allSlots?: TimeSlot[]; // Lista completa de turnos oficiales de la jornada con flag available
  generatedAt: string; // RFC3339 UTC
}

// ============================================================================
// RESERVAS Y MUTACIONES (S03 / S09)
// ============================================================================

export type BookingStatus = 'confirmed' | 'cancelled';
export type AttendanceStatus = 'pending' | 'attended' | 'no_show';

export interface PatientSearchResultItem {
  id: string;
  professionalId: ProfessionalId;
  startAt: string;
  endAt: string;
  status: BookingStatus;
  attendanceStatus: AttendanceStatus;
  version: string;
  patient: {
    name: string;
    email: string;
    phone?: string;
    rut?: string;
    documentType?: string;
  };
}

export interface PatientSearchStats {
  totalAppointments: number;
  attendedCount: number;
  noShowCount: number;
  cancelledCount: number;
  upcomingCount: number;
}

export interface PatientSearchResult {
  query: string;
  totalMatches: number;
  stats: PatientSearchStats;
  results: PatientSearchResultItem[];
}

export interface CreateBookingRequest {
  professionalId: ProfessionalId;
  startAt: string; // RFC3339 UTC
  patient: PatientSnapshot;
  consentVersion: string;
  notifyPatient?: boolean;
}

export interface BookingDetail {
  id: string; // ID opaco expuesto al cliente
  professionalId: ProfessionalId;
  startAt: string; // RFC3339 UTC
  endAt: string;   // RFC3339 UTC
  status: BookingStatus;
  attendanceStatus?: AttendanceStatus;
  attendanceUpdatedAt?: string;
  version: string; // ETag / versión para control de concurrencia
  patient: PatientSnapshot;
  createdAt: string; // Fecha de creación para trazabilidad y auditoría
}

export interface BookingDetailResponse {
  booking: BookingDetail;
}

// ============================================================================
// IDEMPOTENCIA, COMANDOS Y RESULTADOS (S09 / P03)
// ============================================================================

export type MutationKind = 'appointment' | 'block';

export interface MutationResult {
  command: {
    id: string;
    status: 'committed';
  };
  result: {
    resourceId: string;
    kind: MutationKind;
    professionalId: ProfessionalId;
    startAt: string;
    endAt: string;
    status: BookingStatus;
    version: string;
  };
}

export interface ResolveCommandRequest {
  idempotencyKey: string;
  method: 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  path: string;
}

export type ResolveCommandResponse =
  | {
      status: 'committed';
      httpStatus: number;
      commandId: string;
      result: {
        resourceId: string;
        kind: MutationKind;
        version: string;
      };
    }
  | {
      status: 'not_found';
    };

// ============================================================================
// PANEL DE EQUIPO (S05 / S09)
// ============================================================================

export interface TeamScheduleEntry {
  id: string;
  kind: MutationKind;
  professionalId: ProfessionalId;
  startAt: string;
  endAt: string;
  status: BookingStatus;
  attendanceStatus?: AttendanceStatus;
  version: string;
  patient?: {
    name: string;
    phone?: string;
    email?: string;
    // S09 L38: No se expone el RUT en listados generales de equipo
  };
}

export interface UpdateAttendanceRequest {
  attendanceStatus: AttendanceStatus;
}

export interface TeamScheduleQuery {
  professionalId: ProfessionalId;
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

export interface TeamScheduleResponse {
  professionalId: ProfessionalId;
  timeZone: typeof CLINIC_TIMEZONE;
  policy: {
    queryRange: { from: string; to: string };
    bookingRange: { from: string; to: string };
    blockRules: { durationMinutes: number; alignMinutes: number };
  };
  availableSlots: TimeSlot[];
  entries: TeamScheduleEntry[];
}

export interface CreateTeamBookingRequest {
  professionalId: ProfessionalId;
  startAt: string;
  patient: PatientSnapshot;
}

export interface UpdateTeamBookingRequest {
  startAt?: string;
  patient?: PatientSnapshot;
}

export interface CreateBlockRequest {
  professionalId: ProfessionalId;
  startAt: string; // RFC3339 UTC
  endAt: string;   // RFC3339 UTC
}

// ============================================================================
// COPIA A CALENDARIO PERSONAL (S06 / S09)
// ============================================================================

export interface CalendarExportUrls {
  googleUrl: string;
  icsDownloadUrl: string;
}

// ============================================================================
// FICHA Y NOTAS DE EVOLUCIÓN DE PACIENTES
// ============================================================================

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

export interface BookingNotesResponse {
  patient: PatientSnapshot;
  patientKey: string;
  notes: PatientNoteItem[];
}

export interface CreatePatientNoteRequest {
  content: string;
  professionalId: ProfessionalId;
  bookingId?: string;
}

// ============================================================================
// ERRORES CANÓNICOS (S09)
// ============================================================================

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'SLOT_CONFLICT'
  | 'IDEMPOTENCY_MISMATCH'
  | 'BOOKING_CANCELLED'
  | 'VERSION_CONFLICT'
  | 'VERSION_REQUIRED'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE';

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  requestId: string;
  fields?: Record<string, string>; // Código de error de campo sin eco de PII
}

export interface ApiErrorResponse {
  error: ApiError;
}
