# S06 — Copia manual al calendario personal

Estado: especificación vigente propuesta. Responsable: backend-reservas + frontend-reservas. Plan: [P06](../planes/06-copia-calendario.md).

Leer [contexto](../contexto.md), [seguridad](../seguridad-cloudflare.md), [inventario](../cloudflare-staging.md) y [decisiones](../decisiones.md). Desarrollo local; cualquier cambio remoto exige aprobación sobre el inventario exacto. No scopes Calendar, credenciales clínicas, correo ni APIs externas para crear eventos.

## Comportamiento

Después de confirmar una cita, paciente y equipo pueden pulsar «Añadir a mi calendario». Opciones propuestas:

1. Enlace de plantilla Google Calendar que abre el formulario de evento personal; el usuario revisa y guarda.
2. Archivo `.ics` descargable para calendarios compatibles.

La cita oficial permanece en D1. Texto obligatorio: **«Se añadirá una copia. Si la hora cambia o se cancela, debes actualizar tu calendario personal.»** No decir «sincronizado», «invitación enviada» o «guardado en tu calendario» sin intervención del usuario.

No hay cuenta padre, envío automático ni acceso a la agenda personal. Crear la copia no cambia estado de reserva ni bloquea cupos. No ofrecer esta función para bloqueos administrativos en el MVP.

## Contrato y datos mínimos

`GET /api/bookings/:id/calendar` autenticado, paciente dueño o miembro activo del equipo. Default JSON `{googleUrl,icsUrl,warning,bookingVersion}`. `?format=ics` descarga el archivo; ambos verifican autorización y estado actual. Reserva cancelada → `409 BOOKING_CANCELLED`, sin enlace/archivo nuevo. IDs ajenos → `404`.

Generar desde la reserva y configuración clínica del servidor, no texto/fecha arbitrarios enviados por query. Campos: título genérico, profesional, inicio/fin y dirección de atención. **Sin nombre, correo, RUT, motivo clínico, tokens o links de administración.** El navegador solo transmite esos datos mínimos al proveedor externo cuando el usuario abre voluntariamente el enlace.

No registrar URL exportada en analítica/logs. Enlace externo con `rel="noopener noreferrer"`; no precargarlo automáticamente. `Cache-Control: private, no-store` y `Referrer-Policy: no-referrer` en respuesta de exportación. El ID opaco no sustituye autorización.

## Formatos

- Google: plantilla `https://calendar.google.com/calendar/render` con `action=TEMPLATE`, texto, fechas UTC y ubicación debidamente codificados. Sin `add`/invitados, scopes o tokens. Validar comportamiento real en prueba manual, no asumir interfaz estable del proveedor.
- ICS: RFC 5545, `VERSION:2.0`, `PRODID`, `UID` estable opaco, `DTSTAMP`, `DTSTART`/`DTEND` UTC, `SUMMARY`, `LOCATION`, `DESCRIPTION` mínima. Sin ATTENDEE/ORGANIZER con correos y sin `METHOD:REQUEST`.
- Escapar caracteres y CR/LF, terminar líneas CRLF y plegarlas según octetos RFC; no permitir inyección de nuevas propiedades. `Content-Type: text/calendar; charset=utf-8`, filename genérico sin PII. UID estable ayuda a ciertos clientes, pero **no garantiza** evitar duplicados ni actualizar copias ya guardadas.

## Aceptación

- COPY-01: paciente dueño y equipo exportan solo citas autorizadas confirmadas; otro paciente y anónimo no.
- COPY-02: ambos formatos muestran profesional/fecha/hora/duración/dirección correctos, incluso DST, y no contienen PII del paciente ni credenciales.
- COPY-03: ningún request a Google se realiza automáticamente al reservar; guardado manual y aviso de no sincronización visibles.
- COPY-04: cancelar impide nueva exportación; modificar genera datos actuales, pero no afirma modificar la copia anterior.
- COPY-05: escapar/plegar caracteres, CRLF y textos hostiles no inyecta eventos/propiedades adicionales.

Dependencias: S01/S03/S04/S05/S09 y decisiones de campos/dirección; pruebas locales más prueba manual controlada, sin mutación de calendarios por agentes.
