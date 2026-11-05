# Histórico S09 — Contratos con Calendar, no ejecutar

> **HISTÓRICO — NO EJECUTAR su plan.** Requiere adaptación al alcance propio D1, Google solo login y sin Calendar/correos. Mandan `../contexto.md`, `../seguridad-cloudflare.md`, `../cloudflare-staging.md` y `../planes/implementacion.md`. Ningún recurso, permiso, dominio o despliegue descrito aquí queda autorizado.

Estado: contratos propuestos; fijar tipos y ejemplos JSON antes de implementar UI/API. Responsable: coordinador y backend-reservas. Prefijo same-origin; JSON salvo redirects OAuth.

## Convenciones

- IDs públicos opacos; `professionalId` usa IDs estables del catálogo existente, no correos ni IDs reales de Google.
- Fechas de consulta `from`/`to`: `YYYY-MM-DD` locales, intervalo de fechas `[from,to)`; respuesta informa límites autorizados. `startAt`: RFC3339 con instante válido; servidor deriva fin a 60 minutos y comprueba alineación/jornada/ventana. No aceptar duración/calendario/rol arbitrarios del cliente.
- Todas las respuestas de sesión/perfil/agenda/reservas/operaciones son `private, no-store`.
- Mutaciones: sesión + `X-CSRF-Token` y `Origin` válido. JSON con allowlist de campos/tamaño. Reservas, ediciones, cancelaciones y bloqueos requieren `Idempotency-Key` opaco sin PII.
- PATCH/DELETE de reservas y bloques: `If-Match` con versión local retornada por API. Falta → `428`, obsoleta → `412`; conflicto de ocupación/idempotencia → `409`.
- Crear puede retornar `201` confirmado o `202` pendiente con `operationId`; editar/cancelar `200` terminal o `202`. `202` no es éxito de reserva. UI consulta operación con backoff limitado, sin PII en URLs.
- Consulta de operación solo para su creador o miembro activo del equipo si corresponde a una entidad clínica; no permite al paciente enumerar operaciones ajenas. Cancelada la sesión, reautenticar para consultar.

## Endpoints

| Método/ruta | Acceso | Entrada/respuesta mínima |
|---|---|---|
| GET `/auth/google/start` | Público | Inicia intento OIDC, retorno local permitido |
| GET `/auth/google/callback` | Intento válido | Valida/intercambia, crea sesión y redirige limpio |
| GET `/api/session` | Público | `{authenticated:false}` o usuario mínimo, capacidades y token CSRF ligado a sesión; nunca allowlist ni tokens Google |
| POST `/api/logout` | Sesión | Revoca sesión; idempotente, no requiere clave de reserva |
| GET `/api/patient-profile` | Sesión | Perfil del dueño o null, versión y estado de consentimiento |
| PUT `/api/patient-profile` | Sesión | `name,email,rut,consentVersion`, versión si ya existe; devuelve perfil/versión. No cambia identidad Google |
| GET `/api/availability?professionalId=&from=&to=` | Sesión | `{timeZone,minDate,maxDate,slots:[{startAt,endAt}]}` dentro de reglas; sin títulos de eventos |
| POST `/api/bookings` | Sesión | `professionalId,startAt,patient:{name,email,rut},consentVersion`; snapshot validado independientemente de perfil guardado |
| GET `/api/operations/:id` | Dueño/equipo autorizado | `id,status,bookingId?,version?,notificationStatus?,errorCode?,retryAfterSeconds?` sin payload sensible |
| GET `/api/team/schedule?professionalId=&from=&to=` | Equipo | Horas/citas/bloqueos de la agenda elegida, versiones y campos paciente mínimos; límites temporales aprobados D04 |
| POST `/api/team/bookings` | Equipo | Profesional, inicio, paciente manual y origen `manual`; mismas garantías del motor |
| PATCH `/api/team/bookings/:id` | Equipo | Campos permitidos de paciente/inicio; no traslado de agenda en propuesta inicial D07; devuelve operación/versión |
| DELETE `/api/team/bookings/:id` | Equipo | Cancela cita y evento según D07; sin hard-delete implícito de historial |
| POST `/api/team/blocks` | Equipo | Profesional e inicio de bloque de 60 minutos, sin paciente; estado recuperable |
| DELETE `/api/team/blocks/:id` | Equipo | Desbloqueo recuperable con versión/idempotencia |

Métodos desconocidos → `405`. Campos adicionales privilegiados → validación rechazada, no usados silenciosamente. No ofrecer endpoint público para recuperar datos por RUT. No agregar GET de reserva por ID sin definir su autorización.

## Estados públicos

- `pending`: operación persistida, resultado externo aún no definitivo; no volver a confirmar con otra clave.
- `confirmed`: ocupación clínica confirmada; estado de notificación independiente (`pending`, `requested`, `failed`, `not_applicable` según evidencia).
- `cancelled`: cancelación resuelta; ocupación liberada.
- `conflict`: operación incompatible con ocupación/versión/estado externo; conservar entidad anterior si era edición.
- `failed`: rechazo definitivo sin creación; si el estado es incierto debe seguir `pending`, no `failed`.
- `completed`: operación administrativa terminal como eliminación de bloqueo; no significa cita confirmada.

Errores con `{error:{code,message,requestId}}`; sin respuestas Google crudas, RUT, correos, SQL o tokens. `400/422` formato/campos; `401/403` acceso; `404` entidad no visible; `409` cupo/idempotencia; `412/428` versión; `429` rate limit; `503` disponibilidad desconocida. Si la operación ya se persistió y luego falló la red externa, retornar/reconocer operación pendiente en vez de inducir un nuevo intento con otra clave.

## Aceptación y plan

- API-01: cliente y servidor comparten tipos/validadores y pruebas contractuales para cada endpoint.
- API-02: peticiones con `calendarId`, `role`, dueño ajeno o duración manipulada no amplían privilegios.
- API-03: mismo comando/clave produce misma operación; UI distingue pendiente/confirmado/error.
- API-04: consulta de operación ajena no filtra datos, incluso con ID correcto.

Plan: ratificar campos pendientes D05/D07 → crear tipos/validadores y mocks → tests de errores/seguridad → integrar módulos por contratos → revisar respuestas reales y eliminar divergencias antes de E2E.
