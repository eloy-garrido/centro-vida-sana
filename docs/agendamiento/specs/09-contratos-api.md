# S09 — Contrato HTTP canónico del MVP

Estado: propuesta vigente para revisión; referencia única para frontend/backend/QA. Responsable: coordinador + backend-reservas. Plan: [P09](../planes/09-contratos-api.md).

Leer [contexto](../contexto.md), [seguridad](../seguridad-cloudflare.md), [inventario](../cloudflare-staging.md), [decisiones](../decisiones.md). Este contrato no autoriza despliegues/migraciones ni acceso a otros recursos. Sin API Calendar, correo o comandos administrativos de Cloudflare desde la aplicación paciente.

## Convenciones

- Same-origin, JSON salvo redirects OAuth/descarga ICS; cookies de sesión, `private, no-store`.
- Profesionales exactos `felipe|eduardo`. IDs de reserva/bloqueo opacos. Nunca IDs reales D1/Cloudflare en DTOs de paciente.
- Rango de consulta `[from,to)` con fechas locales `YYYY-MM-DD`; instantes `startAt/endAt` RFC3339 UTC `Z`. Servidor deriva atención +3600 segundos y valida zona/jornada/ventana. D01/D02/D04 gobiernan límites reales.
- Mutaciones con Origin y `X-CSRF-Token`. Toda entrada se valida y campos privilegiados/desconocidos se rechazan. Sin aceptar rol, actor, duración de atención o `calendarId` desde cliente.
- Reservas/bloqueos mutantes requieren `Idempotency-Key` aleatorio. Guardar perfil PUT es idempotente por versión y no requiere registro de comando. PATCH/DELETE requieren `If-Match` de versión opaca; PUT perfil existente también.
- Solo `201/200` tras commit confirmado. No `202`, `pending_google`, envío pendiente o jobs externos. Estados entidad: `confirmed|cancelled`.

## Endpoints

| Método/ruta | Acceso | Entrada/salida |
|---|---|---|
| GET `/auth/google/start` | Público | Inicia intento OIDC; retorno restringido a rutas locales |
| GET `/auth/google/callback` | Intento válido | Consume código/state/nonce, crea sesión y redirige URL limpia |
| GET `/api/session` | Público | `{authenticated:false}` o `{authenticated:true,user:{id,name,email},capabilities:{teamAgenda:boolean},csrfToken}` |
| POST `/api/logout` | Sesión + CSRF | Revoca cookie/sesión; `200 {loggedOut:true}` |
| GET `/api/patient-profile` | Sesión | `{profile:null}` o `{profile:{name,email,rut},version}` propio |
| PUT `/api/patient-profile` | Sesión + CSRF | `{name,email,rut,consentVersion}` según D05/D06; crear con `If-None-Match:*`, editar `If-Match`; devuelve perfil+versión |
| GET `/api/availability?professionalId=&from=&to=` | Sesión | `{professionalId,timeZone,eligibleDateRange:{from,to},slots:[{startAt,endAt}],generatedAt}`; sin personas/eventos |
| POST `/api/bookings` | Sesión + CSRF + clave | `{professionalId,startAt,patient:{name,email,rut},consentVersion}`; snapshot validado; crea reserva propia |
| GET `/api/bookings/:id` | Reservante dueño o equipo | `{booking:{id,professionalId,startAt,endAt,status,version,patient}}`; campos mínimos de snapshot necesarios para revisión, no identidad Google de terceros |
| POST `/api/commands/resolve` | Sesión + CSRF | `{idempotencyKey,method,path}`; busca solo recibo del actor, no ejecuta comando |
| GET `/api/team/schedule?professionalId=&from=&to=` | Equipo | `{professionalId,timeZone,policy:{queryRange,bookingRange,blockRules},availableSlots,entries}`; D04 fija rangos y bloqueos |
| POST `/api/team/bookings` | Equipo + CSRF + clave | `{professionalId,startAt,patient:{name,email,rut}}` según D05; origen y actor servidor, reservante paciente null |
| PATCH `/api/team/bookings/:id` | Equipo + CSRF + clave + versión | `{startAt?,patient?:{name,email,rut}}`, snapshot completo si se cambia; no traslado profesional en propuesta D07 |
| DELETE `/api/team/bookings/:id` | Equipo + CSRF + clave + versión | Cancela lógicamente; sin hard-delete de historia |
| POST `/api/team/blocks` | Equipo + CSRF + clave | `{professionalId,startAt,endAt}` según D04, sin paciente ni texto clínico libre |
| DELETE `/api/team/blocks/:id` | Equipo + CSRF + clave + versión | Cancela bloqueo y libera intervalo |
| GET `/api/bookings/:id/calendar[?format=ics]` | Dueño o equipo | Opciones de copia o ICS según S06; cancelada → `409` |

`entries` de equipo: `{id,kind,professionalId,startAt,endAt,status,version,patient?}`. No RUT en listado; si UI requiere detalle usar GET autorizado. Para edición manual, el usuario que actuó como equipo no se convierte en reservante paciente por defecto. No endpoint de búsqueda global por RUT ni alta de miembros.

## Resultado de mutación e incertidumbre

POST crea `201`, PATCH/DELETE `200`:

`{command:{id,status:"committed"},result:{resourceId,kind:"appointment"|"block",professionalId,startAt,endAt,status:"confirmed"|"cancelled",version}}`

Repetición de la misma clave con método/ruta/fingerprint original devuelve mismo resultado/version e HTTP de éxito con `Idempotent-Replay:true`. Autorizar nuevamente antes del replay. El resultado describe el comando, no asegura que la entidad siga en esa versión; GET detalle obtiene estado actual.

Orden obligatorio: autenticación/autorización/CSRF → estructura mínima y fingerprint → consulta/replay del recibo → reglas de jornada/ventana/consentimiento y versión solo si el comando es nuevo. No rechazar un recibo exitoso por cambio de día/política o edición posterior. Un replay no concede permisos que el actor haya perdido.

Fingerprint y clave se vinculan al **primer commit exitoso**. Rechazos previos a commit no guardan cambios/recibo; no prometer deduplicación permanente de errores no persistidos. UI usa nueva clave solo para una nueva intención consciente, nunca para resolver incertidumbre.

Resolve: `{status:"committed",httpStatus,commandId,result:{resourceId,kind,version}}` sin payload sensible, o `{status:"not_found"}` sin revelar claves ajenas. Clave conocida con ruta/método distinto → `409 IDEMPOTENCY_MISMATCH`; no devolver recibos de equipo a actores que perdieron membresía. `not_found` no prueba que otra solicitud no esté en vuelo; esperar/repetir misma clave y cuerpo si está en memoria, no crear intención nueva automáticamente. Claves y IDs opacos pueden conservarse en sessionStorage; nunca el cuerpo con PII.

GET detalle tras resolve comprueba estado/versión actuales. No tokens de exportación públicos, enlaces que otorguen acceso o query con datos personales.

Recuperación acotada propuesta: hasta cinco consultas resolve con backoff 1/2/4/8/15 segundos y un plazo total de 60 segundos (incluye red, cada petición con timeout). Si no se resuelve, detener automatismos y mostrar «No pudimos verificar el resultado; no vuelvas a reservar sin comprobarlo», con contacto genérico al equipo. Mantener solo referencia opaca para reconsulta manual autenticada; no crear otra clave ni reconstruir body perdido. El equipo verifica la agenda autorizada; no afirmar que hay una reserva pendiente persistida. Una nueva ronda de consulta solo por acción explícita, sujeta a rate limit.

## Errores

Formato `{error:{code,message,requestId,fields?}}`, campos por nombre/código sin eco de valores personales. `400/422` formato/reglas, `401` sesión, `403` rol/CSRF, `404` recurso no visible, `409 SLOT_CONFLICT|IDEMPOTENCY_MISMATCH|BOOKING_CANCELLED`, `412 VERSION_CONFLICT`, `428 VERSION_REQUIRED`, `429` límite y `503` fallo temporal seguro. Un commit con respuesta perdida se resuelve por clave, no se deduce de un `503`.

## Aceptación

- API-01: tipos/validadores únicos y tests contractuales de todos los endpoints, sin DTOs de Calendar.
- API-02: rol/actor/profesional/fechas/duración manipulados no amplían privilegios.
- API-03: comando, replay y resolve propios no duplican ni filtran; detalle/export de otra cuenta rechazados.
- API-04: versión obsoleta o fila inexistente no genera resultado de éxito; errors sin SQL/token/PII.
- API-05: ningún fallback de asset sirve HTML como éxito para errores API.

Dependencias: S01–S07 y decisiones pertinentes. Si cambian campos o códigos, actualizar este spec y consumidores en el mismo cambio documental.
