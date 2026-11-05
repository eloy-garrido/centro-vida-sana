# S02 — D1, datos de pacientes y privacidad

Estado: modelo lógico vigente propuesto, no migración aprobada. Responsables: backend-reservas y usuario (políticas). Plan: [P02](../planes/02-datos-privacidad.md).

Obligatorio: [contexto](../contexto.md), [frontera](../seguridad-cloudflare.md), [inventario](../cloudflare-staging.md), [decisiones](../decisiones.md). Solo D1 inventariada, IDs explícitos, aprobación por mutación remota; ninguna exploración de datos ajenos ni cambios de DNS/permisos/producción.

## Modelo mínimo propuesto

| Tabla | Datos y reglas |
|---|---|
| users | ID opaco, `google_sub` único, nombre/correo de identidad, timestamps. Datos de login distintos del paciente |
| sessions / oauth_attempts | Hash sesión, expiración/revocación; estado/nonce/PKCE temporales y consumo único |
| team_members | Correo autorizado verificado, sub vinculado, activo; etiquetas admin/profesional con iguales permisos de agenda |
| professionals | IDs `felipe`/`eduardo`, configuración operacional aprobada, zona `America/Santiago`; reutilizar perfiles públicos existentes |
| patient_profiles | Dueño usuario único, payload cifrado de nombre/correo/RUT, versión, consentimiento. Un último perfil por cuenta propuesto D05 |
| agenda_entries | ID, `kind=appointment|block`, profesional, inicio/fin UTC, estado `confirmed|cancelled`, versión, actor creador, reservante nullable, snapshot cifrado para appointment |
| command_results | Actor, clave idempotente, método/ruta, fingerprint HMAC del payload, entidad/versión resultado, status HTTP terminal, fecha. Único `(actor,key)` |
| audit_events | Actor interno, acción, ID entidad/comando, versión y fecha UTC; sin snapshot/PII ni datos clínicos |

Una sola `agenda_entries` representa reservas y bloqueos: evita sincronizar tablas de ocupación separadas. Solo las entradas `confirmed` ocupan el intervalo; estado cancelado no. DB impide solapamientos en INSERT/UPDATE según S03, incluidos appointment contra block. Cancelar es actualización lógica, no DELETE físico.

Inicio/fin se almacenan como INTEGER Unix UTC en segundos; el API los transforma a RFC3339 UTC. No comparar fechas locales o textos de offsets distintos en triggers. Atención exige exactamente 3600 segundos y alineación de jornada; bloqueos usan reglas D04 y siempre `fin>inicio`.

Índices propuestos: `(professional_id,status,start_at,end_at)`, `(booked_by_user_id,id)`, claves únicas de sub y comandos. Validar foreign keys, CHECK de duración/datos según kind y restricciones de versión. No usar tokens o RUT como IDs públicos. No crear tablas Calendar, outbox, sincronización o colas.

## Paciente, tercero y perfil recordado

Perfil deducido desde sesión, sin `userId` aceptado desde navegador. Precargar solo datos asociados a esa cuenta. Para primera visita sugerir nombre/correo Google y RUT vacío. El paciente puede ser tercero. Explicar y confirmar qué datos se recordarán según D05.

Cada reserva captura su snapshot: actualizar perfil no reescribe historia. No directorio familiar, búsqueda global por RUT ni precarga del profesional como paciente en registro manual. Equipo ve campos mínimos de la reserva; no todo el perfil privado de la cuenta reservante.

RUT: normalizar y validar módulo 11 (`K` incluida) en servidor; formato no acredita identidad. D05 define excepciones y registro manual. Nombre/correo/RUT tienen límites de longitud; consultas parametrizadas. Sin diagnóstico, síntomas ni campo clínico libre.

## Protección y ciclo de vida

- Propuesta: cifrado autenticado AES-GCM de payloads personales con IV único por operación, clave versionada en Secret, fuera de D1. Cifrar antes de batch; no llamadas externas dentro de la transacción.
- Credenciales/sesiones no en claro; fingerprints de peticiones con PII mediante HMAC servidor, no hash simple de RUT.
- No PII en URL, logs, errores, telemetría o almacenamiento persistente del navegador. El enlace de copia solo contiene datos mínimos de la cita según S06, nunca paciente/RUT/email.
- D06 define consentimiento, terceros, plazos, historial y eliminación/anonimización. Antes de datos reales publicar política con Google de identidad y Cloudflare como proveedores; sin afirmar certificación legal automática.
- Recuperación nativa D1: revisar disponibilidad/límites y documentar procedimiento mínimo; no construir backup complejo ni ejecutar restore remoto sin aprobación específica.
- Retención de comandos debe cubrir incertidumbre/reintentos: no borrar claves permitiendo que una solicitud antigua vuelva a crear cita. Especificar tombstone o rechazo de claves expiradas al cerrar D06.

## Aceptación

- DATA-01: perfil y comando de otra cuenta inaccesibles incluso con ID/clave correctos.
- DATA-02: edición de perfil conserva snapshots, roles e identidad original.
- DATA-03: entrada block no exige paciente; appointment cumple campos aprobados y ocupa 60 minutos.
- DATA-04: cifrado, límites, RUT y SQL parametrizado probados; sin PII en respuestas de error/logs/URL/storage.
- DATA-05: cancelación conserva auditoría mínima y libera intervalo atómicamente; política de retención documentada antes de uso real.

Dependencias: S01/S03/S09, D05/D06. La implementación fija DDL después de probar constraints y transacciones localmente; no ejecutar SQL remoto desde este documento.
