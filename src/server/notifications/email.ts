/**
 * Centro Vida Sana Austral — Servicio de Notificaciones por Correo
 * - Notificaciones internas a profesionales: Cloudflare Email Routing / send_email.
 * - Confirmaciones y comprobantes a pacientes: API transaccional de Resend.
 */

import { CLINIC_TIMEZONE, type ProfessionalId } from '../../lib/agendamiento/types.ts';

export interface BookingNotificationData {
  bookingId: string;
  professionalId: ProfessionalId;
  startAt: string; // RFC3339 UTC
  patient: {
    name: string;
    phone: string;
    email: string;
    rut?: string;
    documentType?: string;
  };
}

interface ProfessionalProfile {
  name: string;
  discipline: string;
  title: string;
  phoneFormatted: string;
  phoneRaw: string;
  accentColor: string;
  lightColor: string;
  borderColor: string;
}

export const CLINIC_PROFESSIONALS: Record<ProfessionalId, ProfessionalProfile> = {
  felipe: {
    name: 'Felipe Méndez',
    discipline: 'Quiropraxia y Kinesiología Clínica',
    title: 'Quiropráctico & Kinesiólogo',
    phoneFormatted: '+569 7370 0616',
    phoneRaw: '56973700616',
    accentColor: '#134E5E', // Azul Petróleo
    lightColor: '#EBF4F6',
    borderColor: '#C9DFE6'
  },
  eduardo: {
    name: 'Eduardo Lagos',
    discipline: 'Acupuntura y Medicina Tradicional China',
    title: 'Acupunturista Clínico Minsal',
    phoneFormatted: '+569 7388 8910',
    phoneRaw: '56973888910',
    accentColor: '#2E4D38', // Verde Salvia
    lightColor: '#EFF5F0',
    borderColor: '#D3E3D6'
  }
};

/**
 * Formatea una fecha UTC a formato amigable en hora de Chile (America/Santiago).
 */
export function formatChileDateTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const formatter = new Intl.DateTimeFormat('es-CL', {
      timeZone: CLINIC_TIMEZONE,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const str = formatter.format(date);
    return str.charAt(0).toUpperCase() + str.slice(1);
  } catch {
    return isoString;
  }
}

/**
 * Desglosa los componentes de fecha y hora en hora local de Chile para diseño de alta jerarquía.
 */
export function getChileDateTimeParts(isoString: string): {
  weekday: string;
  day: string;
  month: string;
  year: string;
  time: string;
  fullDate: string;
} {
  try {
    const date = new Date(isoString);
    const formatter = new Intl.DateTimeFormat('es-CL', {
      timeZone: CLINIC_TIMEZONE,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(date);
    let weekday = '';
    let day = '';
    let month = '';
    let year = '';
    let hour = '';
    let minute = '';

    for (const part of parts) {
      if (part.type === 'weekday') weekday = part.value;
      if (part.type === 'day') day = part.value;
      if (part.type === 'month') month = part.value;
      if (part.type === 'year') year = part.value;
      if (part.type === 'hour') hour = part.value;
      if (part.type === 'minute') minute = part.value;
    }

    const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

    return {
      weekday: capitalize(weekday),
      day,
      month: capitalize(month),
      year,
      time: `${hour}:${minute} hrs`,
      fullDate: `${capitalize(weekday)} ${day} de ${capitalize(month)}, ${year}`
    };
  } catch {
    return {
      weekday: '',
      day: '',
      month: '',
      year: '',
      time: isoString,
      fullDate: isoString
    };
  }
}

/**
 * Genera el enlace directo para añadir la cita a Google Calendar.
 */
export function buildGoogleCalendarLink(options: {
  title: string;
  details: string;
  location: string;
  startIso: string;
  durationMinutes?: number;
}): string {
  try {
    const start = new Date(options.startIso);
    const end = new Date(start.getTime() + (options.durationMinutes || 60) * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const dates = `${fmt(start)}/${fmt(end)}`;
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: options.title,
      dates,
      details: options.details,
      location: options.location
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  } catch {
    return 'https://calendar.google.com';
  }
}

/**
 * Codifica una cadena en Base64 compatible con Workers y Node.js.
 */
function toBase64Utf8(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'utf-8').toString('base64');
  }
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Construye el cuerpo del mensaje RFC 5322 en formato MIME (HTML + Base64) para Cloudflare Email Routing.
 */
export function buildMimeEmail(options: {
  from: string;
  fromName: string;
  to: string;
  subject: string;
  html: string;
}): string {
  const encodedSubject = `=?UTF-8?B?${toBase64Utf8(options.subject)}?=`;
  const encodedFromName = `=?UTF-8?B?${toBase64Utf8(options.fromName)}?=`;
  const base64Body = toBase64Utf8(options.html);

  return [
    `From: ${encodedFromName} <${options.from}>`,
    `To: ${options.to}`,
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    base64Body
  ].join('\r\n');
}

/**
 * Genera la plantilla HTML para el profesional (resumen clínico operativo).
 */
export function renderBookingEmailHtml(data: BookingNotificationData): string {
  const prof = CLINIC_PROFESSIONALS[data.professionalId] || {
    name: data.professionalId,
    discipline: 'Atención Clínica'
  };
  const fechaChile = formatChileDateTime(data.startAt);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Nuevo Agendamiento</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #F8F9F6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #151C17;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #E2E8F0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <!-- Header -->
    <tr>
      <td style="background-color: #2E4D38; padding: 28px 32px; text-align: left;">
        <span style="display: inline-block; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #A3D9A5; margin-bottom: 6px;">Centro Vida Sana Austral</span>
        <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff; line-height: 1.3;">Nueva cita agendada</h1>
      </td>
    </tr>
    <!-- Content -->
    <tr>
      <td style="padding: 32px;">
        <p style="margin: 0 0 20px 0; font-size: 15px; color: #4A5568; line-height: 1.5;">
          Se ha confirmado un nuevo agendamiento a través del sistema web:
        </p>
        
        <!-- Tarjeta de Atención -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8F9F6; border-left: 4px solid #134E5E; border-radius: 6px; margin-bottom: 24px;">
          <tr>
            <td style="padding: 16px 20px;">
              <div style="font-size: 13px; font-weight: 600; color: #134E5E; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Profesional</div>
              <div style="font-size: 17px; font-weight: 700; color: #151C17;">${prof.name}</div>
              <div style="font-size: 14px; color: #4A5568; margin-top: 2px;">${prof.discipline}</div>
              
              <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid #E2E8F0;">
                <div style="font-size: 13px; font-weight: 600; color: #2E4D38; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Fecha y Hora</div>
                <div style="font-size: 16px; font-weight: 700; color: #151C17;">${fechaChile}</div>
              </div>
            </td>
          </tr>
        </table>

        <!-- Datos del Paciente -->
        <h3 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 700; color: #151C17; border-bottom: 1px solid #E2E8F0; padding-bottom: 8px;">
          Datos del Paciente
        </h3>
        <table width="100%" border="0" cellspacing="0" cellpadding="4" style="font-size: 14px; margin-bottom: 24px;">
          <tr>
            <td width="35%" style="color: #718096; font-weight: 500;">Nombre completo:</td>
            <td style="color: #151C17; font-weight: 600;">${data.patient.name}</td>
          </tr>
          <tr>
            <td style="color: #718096; font-weight: 500;">Teléfono:</td>
            <td style="color: #151C17; font-weight: 600;"><a href="tel:${data.patient.phone}" style="color: #134E5E; text-decoration: none;">${data.patient.phone}</a></td>
          </tr>
          <tr>
            <td style="color: #718096; font-weight: 500;">Correo:</td>
            <td style="color: #151C17;"><a href="mailto:${data.patient.email}" style="color: #134E5E; text-decoration: none;">${data.patient.email}</a></td>
          </tr>
          ${data.patient.rut ? `
          <tr>
            <td style="color: #718096; font-weight: 500;">Documento (RUT):</td>
            <td style="color: #151C17; font-weight: 600;">${data.patient.rut}</td>
          </tr>` : ''}
        </table>

        <!-- Botón / Acceso a la Agenda -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center" style="padding-top: 8px;">
              <a href="https://centrovidasana.cl/agenda" style="display: inline-block; background-color: #134E5E; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 8px; box-shadow: 0 2px 4px rgba(19, 78, 94, 0.2);">
                Ver Panel de la Agenda
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="background-color: #F8F9F6; padding: 16px 32px; text-align: center; font-size: 12px; color: #718096; border-top: 1px solid #E2E8F0;">
        Notificación automática generada por Centro Vida Sana Austral • Los Armiños 1620, Temuco
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Genera la plantilla HTML exclusiva para el PACIENTE.
 * Da máxima jerarquía visual a la FECHA, HORA y al PROFESIONAL asignado.
 */
export function renderPatientConfirmationEmailHtml(data: BookingNotificationData): string {
  const prof = CLINIC_PROFESSIONALS[data.professionalId] || {
    name: data.professionalId,
    discipline: 'Atención Clínica',
    title: 'Profesional de Salud',
    phoneFormatted: '+569 7370 0616',
    phoneRaw: '56973700616',
    accentColor: '#134E5E',
    lightColor: '#EBF4F6',
    borderColor: '#C9DFE6'
  };

  const dateParts = getChileDateTimeParts(data.startAt);
  const patientFirstName = data.patient.name ? data.patient.name.trim().split(' ')[0] : 'Estimado/a';

  const gcalUrl = buildGoogleCalendarLink({
    title: `Cita ${prof.title}: ${prof.name}`,
    details: `Atención clínica de ${prof.discipline} con ${prof.name} en Centro Vida Sana Austral.\nDirección: Los Armiños 1620, Temuco.\nContacto profesional: ${prof.phoneFormatted}`,
    location: 'Los Armiños 1620, Temuco, Chile',
    startIso: data.startAt,
    durationMinutes: 60
  });

  const mapsUrl = 'https://maps.google.com/?q=Los+Armi%C3%B1os+1620,+Temuco,+Chile';
  const waUrl = `https://wa.me/${prof.phoneRaw}?text=${encodeURIComponent(
    `Hola ${prof.name}, tengo agendada mi cita el ${dateParts.fullDate} a las ${dateParts.time}. Quisiera hacer una consulta previa.`
  )}`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Comprobante de Cita — Centro Vida Sana Austral</title>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #F4F6F2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #151C17; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #E2E8F0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.06);">
    
    <!-- Header Institucional -->
    <tr>
      <td style="background-color: #2E4D38; padding: 32px 32px 28px 32px; text-align: center;">
        <span style="display: inline-block; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; color: #A3D9A5; margin-bottom: 8px;">Centro Vida Sana Austral</span>
        <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">¡Tu cita está confirmada!</h1>
        <p style="margin: 8px 0 0 0; font-size: 14px; color: #E0EADE;">Hola ${patientFirstName}, hemos reservado tu atención exitosamente.</p>
      </td>
    </tr>

    <!-- Tarjeta Principal: FECHA Y HORA (MÁXIMA JERARQUÍA) -->
    <tr>
      <td style="padding: 28px 28px 12px 28px;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background: linear-gradient(180deg, #FFFFFF 0%, #F9FAF8 100%); border: 2px solid ${prof.accentColor}; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 12px rgba(19, 78, 94, 0.08);">
          <tr>
            <td style="background-color: ${prof.accentColor}; padding: 10px 20px; text-align: center;">
              <span style="color: #ffffff; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em;">Detalles de tu Atención</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 20px; text-align: center;">
              <!-- Fecha -->
              <div style="font-size: 13px; font-weight: 700; color: #718096; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px;">
                🗓️ ${dateParts.weekday}
              </div>
              <div style="font-size: 20px; font-weight: 800; color: #151C17; margin-bottom: 14px;">
                ${dateParts.day} de ${dateParts.month}, ${dateParts.year}
              </div>

              <!-- Hora destacada en bloque visual -->
              <div style="display: inline-block; background-color: #F0FDF4; border: 1.5px solid #86EFAC; border-radius: 12px; padding: 10px 28px; margin-bottom: 8px;">
                <span style="font-size: 12px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 2px;">Hora de Inicio</span>
                <span style="font-size: 30px; font-weight: 900; color: #14532D; letter-spacing: -0.02em;">⏰ ${dateParts.time}</span>
              </div>
              
              <div style="font-size: 12px; color: #718096; margin-top: 6px;">
                Duración de sesión: <strong>45 a 60 minutos</strong>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Profesional Asignado -->
    <tr>
      <td style="padding: 12px 28px 20px 28px;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: ${prof.lightColor}; border: 1px solid ${prof.borderColor}; border-radius: 12px;">
          <tr>
            <td style="padding: 18px 20px;">
              <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: ${prof.accentColor}; margin-bottom: 4px;">
                Tu Profesional Tratante
              </div>
              <div style="font-size: 19px; font-weight: 800; color: #151C17; margin-bottom: 2px;">
                ${prof.name}
              </div>
              <div style="font-size: 13px; font-weight: 600; color: ${prof.accentColor}; margin-bottom: 6px;">
                ${prof.title}
              </div>
              <div style="font-size: 12px; color: #4A5568; line-height: 1.4;">
                ${prof.discipline} · Centro Vida Sana Austral
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Acciones Rápidas: Google Calendar & Google Maps -->
    <tr>
      <td style="padding: 0 28px 24px 28px;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td width="48%" align="center" style="padding-right: 6px;">
              <a href="${gcalUrl}" target="_blank" style="display: block; background-color: #2E4D38; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; padding: 13px 16px; border-radius: 10px; text-align: center; box-shadow: 0 2px 4px rgba(46, 77, 56, 0.2);">
                📅 Añadir a Calendar
              </a>
            </td>
            <td width="48%" align="center" style="padding-left: 6px;">
              <a href="${mapsUrl}" target="_blank" style="display: block; background-color: #ffffff; color: #134E5E; border: 1.5px solid #134E5E; text-decoration: none; font-size: 13px; font-weight: 700; padding: 12px 16px; border-radius: 10px; text-align: center;">
                📍 Ver en Google Maps
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Ubicación y Recomendaciones -->
    <tr>
      <td style="padding: 0 28px 28px 28px;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8F9F6; border-radius: 12px; border: 1px solid #E2E8F0;">
          <tr>
            <td style="padding: 20px;">
              <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 800; color: #151C17; text-transform: uppercase; letter-spacing: 0.05em;">
                Información importante para tu visita
              </h3>
              
              <table width="100%" border="0" cellspacing="0" cellpadding="6" style="font-size: 13px; color: #4A5568; line-height: 1.5;">
                <tr>
                  <td width="24" valign="top" style="padding-top: 6px;">📍</td>
                  <td><strong>Dirección:</strong> Los Armiños 1620, Temuco (Región de La Araucanía).</td>
                </tr>
                <tr>
                  <td width="24" valign="top" style="padding-top: 6px;">⏱️</td>
                  <td><strong>Llegada:</strong> Te sugerimos presentarte 5 a 10 minutos antes de tu hora para iniciar puntualmente.</td>
                </tr>
                <tr>
                  <td width="24" valign="top" style="padding-top: 6px;">👕</td>
                  <td><strong>Vestimenta:</strong> Se recomienda asistir con ropa cómoda y holgada para facilitar la evaluación física o tratamiento.</td>
                </tr>
                <tr>
                  <td width="24" valign="top" style="padding-top: 6px;">🚗</td>
                  <td><strong>Estacionamiento:</strong> Espacios de aparcamiento disponibles en el frontis del centro.</td>
                </tr>
                <tr>
                  <td width="24" valign="top" style="padding-top: 6px;">💬</td>
                  <td>
                    <strong>¿Dudas o imprevistos?</strong> Si necesitas reprogramar o consultar, comunícate al WhatsApp:
                    <a href="${waUrl}" style="color: #134E5E; font-weight: 700; text-decoration: underline; margin-left: 4px;">${prof.phoneFormatted}</a>.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Datos del Agendamiento (Pie de comprobante) -->
    <tr>
      <td style="padding: 0 28px 24px 28px; font-size: 12px; color: #718096; line-height: 1.5;">
        <div style="border-top: 1px solid #E2E8F0; padding-top: 16px;">
          <strong>Paciente registrado:</strong> ${data.patient.name}<br>
          <strong>Teléfono de contacto:</strong> ${data.patient.phone}<br>
          <strong>Código de reserva:</strong> <code style="background-color: #EDF2F7; padding: 2px 6px; border-radius: 4px; font-size: 11px; color: #2D3748;">${data.bookingId}</code>
        </div>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #2E4D38; padding: 24px 32px; text-align: center; color: #ffffff;">
        <div style="font-size: 14px; font-weight: 700; margin-bottom: 4px;">Centro Vida Sana Austral</div>
        <div style="font-size: 12px; color: #A3D9A5; margin-bottom: 12px;">Salud Integral · Quiropraxia · Acupuntura · Kinesiología</div>
        <div style="font-size: 11px; color: #D1E7D5; line-height: 1.6;">
          Los Armiños 1620, Temuco, Chile<br>
          <a href="https://centrovidasana.cl" style="color: #ffffff; text-decoration: underline;">centrovidasana.cl</a> · 
          <a href="https://instagram.com/vidasanaaustral" style="color: #ffffff; text-decoration: underline;">@vidasanaaustral</a>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Despacha la confirmación de cita directamente al correo del PACIENTE vía Resend API.
 * No arroja excepciones para proteger la finalización exitosa del agendamiento.
 */
export async function sendPatientConfirmationEmail(
  data: BookingNotificationData,
  env?: Record<string, any>,
  ctx?: { waitUntil?: (promise: Promise<any>) => void }
): Promise<void> {
  const promise = (async () => {
    try {
      if (!data.patient.email || !data.patient.email.includes('@')) {
        console.warn('[NOTIFICACIÓN PACIENTE] Correo de paciente no disponible o inválido. Omitiendo.');
        return;
      }

      // Obtener API Key de Resend (desde env Worker o process.env)
      const apiKey = env?.RESEND_API_KEY || (typeof process !== 'undefined' ? process.env?.RESEND_API_KEY : undefined);

      if (!apiKey) {
        console.log(`[NOTIFICACIÓN PACIENTE MOCK] Sin RESEND_API_KEY. Correo simulado a ${data.patient.email}:`, {
          paciente: data.patient.name,
          fecha: formatChileDateTime(data.startAt),
          profesional: data.professionalId
        });
        return;
      }

      const prof = CLINIC_PROFESSIONALS[data.professionalId] || {
        name: data.professionalId,
        title: 'Profesional de Salud'
      };

      const dateParts = getChileDateTimeParts(data.startAt);
      const fromAddress = env?.RESEND_FROM_EMAIL || 'Centro Vida Sana <reservas@centrovidasana.cl>';
      const subject = `🌿 Cita Confirmada: ${dateParts.weekday} ${dateParts.day} de ${dateParts.month} (${dateParts.time}) con ${prof.name}`;
      const html = renderPatientConfirmationEmailHtml(data);

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [data.patient.email],
          subject: subject,
          html: html
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[RESEND PACIENTE ERROR] Falló el envío del correo:', response.status, errorText);
      } else {
        const resData: any = await response.json();
        console.log(`[RESEND PACIENTE ÉXITO] Correo entregado a ${data.patient.email}. Resend ID:`, resData?.id);
      }
    } catch (err: any) {
      console.error('[NOTIFICACIÓN PACIENTE ERROR] Excepción al procesar correo:', err?.message || err);
    }
  })();

  if (ctx?.waitUntil) {
    ctx.waitUntil(promise);
  } else {
    promise.catch(() => {});
  }
}

/**
 * Despacha la notificación por correo al profesional (vía Cloudflare Email Routing o Resend si está configurado).
 */
export async function sendBookingNotificationEmail(
  data: BookingNotificationData,
  env?: Record<string, any>,
  ctx?: { waitUntil?: (promise: Promise<any>) => void }
): Promise<void> {
  const promise = (async () => {
    try {
      if (!env || !env.EMAIL) {
        console.log(`[NOTIFICACIÓN EMAIL MOCK] Nueva cita para ${data.professionalId}:`, {
          paciente: data.patient.name,
          fecha: formatChileDateTime(data.startAt)
        });
        return;
      }

      // Determinar destinatario
      let recipient = 'eloegf@gmail.com';
      if (data.professionalId === 'felipe' && env.NOTIFICATION_EMAIL_FELIPE) {
        recipient = env.NOTIFICATION_EMAIL_FELIPE;
      } else if (data.professionalId === 'eduardo' && env.NOTIFICATION_EMAIL_EDUARDO) {
        recipient = env.NOTIFICATION_EMAIL_EDUARDO;
      } else if (env.NOTIFICATION_EMAIL) {
        recipient = env.NOTIFICATION_EMAIL;
      }

      const sender = env.NOTIFICATION_FROM_EMAIL || 'notificaciones@centrovidasana.cl';
      const profName = CLINIC_PROFESSIONALS[data.professionalId]?.name || data.professionalId;
      const subject = `🌿 Nueva cita: ${data.patient.name} con ${profName} (${formatChileDateTime(data.startAt)})`;
      const html = renderBookingEmailHtml(data);

      const mimeRaw = buildMimeEmail({
        from: sender,
        fromName: 'Centro Vida Sana',
        to: recipient,
        subject,
        html
      });

      // Cargar EmailMessage de cloudflare:email dinámicamente si existe
      let EmailMessageClass: any = null;
      try {
        // @ts-ignore
        const mod = await import('cloudflare:email');
        EmailMessageClass = mod.EmailMessage;
      } catch {
        // Fallback si no está disponible el módulo
      }

      if (EmailMessageClass) {
        const msg = new EmailMessageClass(sender, recipient, mimeRaw);
        await env.EMAIL.send(msg);
      } else if (typeof env.EMAIL.send === 'function') {
        await env.EMAIL.send({
          from: sender,
          to: recipient,
          content: mimeRaw
        });
      }

      console.log(`[NOTIFICACIÓN EMAIL] Enviada con éxito a ${recipient} para reserva ${data.bookingId}`);
    } catch (err: any) {
      console.error('[NOTIFICACIÓN EMAIL ERROR] No se pudo enviar el correo de aviso:', err?.message || err);
    }
  })();

  if (ctx?.waitUntil) {
    ctx.waitUntil(promise);
  } else {
    promise.catch(() => {});
  }
}
