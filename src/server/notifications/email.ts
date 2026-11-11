/**
 * Centro Vida Sana Austral — Servicio de Notificaciones por Correo
 * Utiliza Cloudflare Email Routing (send_email binding) para notificar
 * a los profesionales sobre nuevos agendamientos.
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

const PROFESSIONAL_NAMES: Record<ProfessionalId, { name: string; specialty: string }> = {
  felipe: {
    name: 'Felipe Méndez',
    specialty: 'Quiropraxia y Kinesiología'
  },
  eduardo: {
    name: 'Eduardo Lagos',
    specialty: 'Acupuntura y Medicina China'
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
 * Construye el cuerpo del mensaje RFC 5322 en formato MIME (HTML + Base64).
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
 * Genera la plantilla HTML estilizada del correo de notificación.
 */
export function renderBookingEmailHtml(data: BookingNotificationData): string {
  const prof = PROFESSIONAL_NAMES[data.professionalId] || {
    name: data.professionalId,
    specialty: 'Atención Clínica'
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
              <div style="font-size: 14px; color: #4A5568; margin-top: 2px;">${prof.specialty}</div>
              
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
 * Despacha la notificación por correo al destinatario correspondiente.
 * No arroja excepciones para no interrumpir el flujo principal de confirmación.
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
      const profName = PROFESSIONAL_NAMES[data.professionalId]?.name || data.professionalId;
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
