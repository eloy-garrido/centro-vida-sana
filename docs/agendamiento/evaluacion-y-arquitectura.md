# Evaluación y arquitectura propuesta

> **HISTÓRICO — NO EJECUTAR.** El usuario sustituyó la integración Google Calendar/correos por agenda propia D1. Las propuestas de recursos/sincronización/producción de este archivo no son vigentes ni conceden autorización. Leer `contexto.md`, `seguridad-cloudflare.md`, `cloudflare-staging.md` y `planes/implementacion.md`. Los hallazgos del sitio se conservan como antecedente, no como plan actual.

Fecha: 2026-11-05. Estado: propuesta, no implementación ni despliegue aprobado.

Actualización de requisitos confirmados: cuenta propietaria Gmail personal gratuita; cada profesional accede con su propio correo personal; reservas en bloques de 60 minutos; primera fecha elegible mañana por día calendario en `America/Santiago`, no tras 24 horas. Ver `contexto.md` para la fuente compartida vigente.

La cuenta central propietaria es `centrovida.sanaaustral@gmail.com` y contiene ambos calendarios. Los correos personales de acceso profesional aún deben confirmarse: las direcciones dadas como ejemplo no constituyen autorizaciones reales.

Actualización de permisos: administrador y ambos profesionales autorizados comparten acceso operativo a las dos agendas. El panel tiene dos pestañas superiores y permite consultar, crear, editar y cancelar/eliminar horas de cualquiera de los profesionales. Cada acción debe identificar a quien la realizó; sigue pendiente acordar notificaciones e historial de cancelación.

## 1. Evaluación del proyecto

El sitio activo usa Astro 5, Tailwind 3 y TypeScript con salida estática (`astro.config.mjs`, `package.json`). La estructura de componentes, el layout SEO y los datos centralizados permiten incorporar reservas sin rehacer el sitio ni añadir un framework de interfaz.

### Fortalezas

- `src/data/professionals.ts` y `src/data/services.ts` contienen identificadores reutilizables para asociar servicios y profesionales.
- `src/layouts/BaseLayout.astro` centraliza metadatos y datos estructurados.
- Fuentes locales, imágenes WebP y estilos con soporte de movimiento reducido.
- La web comercial puede seguir siendo estática mientras autenticación y reservas funcionan en servidor.

### Prioridades antes del MVP

| Prioridad | Hallazgo | Acción mínima |
|---|---|---|
| Alta | No hay backend, sesiones, persistencia ni reserva real; los CTA actuales derivan a WhatsApp | Añadir una API propia en Cloudflare, manteniendo WhatsApp como alternativa |
| Alta | La agenda necesita datos personales y puede involucrar terceros | Definir finalidad, consentimiento, retención y acceso; minimizar datos en Calendar y logs |
| Alta | Disponibilidad y creación de eventos no son atómicas en Google | Implementar ocupación persistente, exclusión de intervalos, idempotencia y reconciliación |
| Media | Horarios y duraciones actuales son principalmente textos de presentación | Crear configuración operacional numérica por profesional, con horarios y excepciones |
| Media | No hay scripts de pruebas ni comprobación de tipos dedicados | Incorporar pruebas de reglas/roles/concurrencia y E2E; el build no sustituye esas pruebas |
| Media | Hay archivos heredados y más de un lockfile; Vercel usa pnpm | Elegir gestor y versión de Node; revisar el lockfile antes de agregar dependencias |
| Media | La configuración de cabeceras pertenece a Vercel | Trasladar y comprobar CSP, caché y seguridad en Cloudflare; no ampliar CSP indiscriminadamente |
| Media | Menú móvil y selector flotante necesitan revisión de foco y atributos ARIA | No copiar estos patrones sin corregirlos al flujo de reservas |
| Baja | Datos de contacto, horarios y cifras de reseñas pueden divergir entre componentes y Schema | Centralizar y verificar cifras reales sin inventar testimonios ni acreditaciones |

`AGENTS.md` y `CLAUDE.md` se actualizaron para dejar de describir el sitio activo como HTML sin build. No se eliminaron archivos heredados ni se tocaron los componentes que ya tenían cambios del usuario.

## 2. Arquitectura recomendada

```text
Navegador → Astro / Cloudflare Worker
                         ├─ Google OIDC: identidad del usuario
                         ├─ D1: perfiles, sesiones, reservas y ocupación
                         ├─ Coordinación por profesional (Durable Objects)
                         ├─ Google Calendar: dos calendarios independientes
                         └─ Trabajos persistentes: reintentos y notificaciones
```

- **Frontend:** conservar Astro y prerenderizar las páginas informativas. Rutas propuestas: `/reservar` y `/agenda`, con `noindex` y respuestas privadas sin caché compartida.
- **Backend:** Cloudflare Workers con Static Assets; evaluar el adaptador Cloudflare compatible con la versión de Astro instalada antes de cambiar dependencias. No actualizar todo el stack en bloque.
- **D1:** usuarios, perfiles de pacientes, sesiones, profesionales autorizados, reservas, ocupaciones e idempotencia. KV no es autoridad de cupos ni roles.
- **Durable Object por profesional:** coordinación independiente de las escrituras de Eduardo y Felipe. La ocupación debe persistir antes de llamadas lentas externas; no depender únicamente de un bloqueo en memoria.
- **Trabajos:** outbox persistente y reconciliación programada; añadir Queues cuando simplifique reintentos fiables, no como sustituto de integridad en D1.
- **Secretos:** Workers Secrets. Ninguna credencial clínica ni RUT debe ser una variable `PUBLIC_*`.

La arquitectura es una recomendación pendiente de validar con volumen esperado, plan Cloudflare y una prueba local de integraciones.

## 3. Identidades y permisos

Separar tres conceptos:

1. **Usuario reservante:** identificado por el `sub` de Google, no solo por correo editable.
2. **Paciente:** nombre, correo y RUT confirmados; puede ser otra persona.
3. **Miembro autorizado del equipo:** administrador o profesional con correo verificado y membresía activa comprobados por el servidor en cada operación; puede gestionar los dos calendarios configurados de la clínica.

La precarga se limita a perfiles guardados por esa cuenta. No implementar una búsqueda pública/global de pacientes por RUT. Editar un paciente no debe alterar retrospectivamente los datos de una reserva anterior.

El paciente inicia sesión con `openid email profile`; no necesita conceder permisos de Calendar. OIDC requiere validación de firma, emisor, audiencia, expiración, `state`, `nonce` y correo verificado, según el flujo. Usar sesiones opacas con cookie segura y protección CSRF en operaciones mutantes.

Cada miembro usa su cuenta personal para poder atribuir cambios. Elegir una pestaña selecciona el profesional atendiente, no cambia la identidad del usuario actuante ni concede permisos nuevos. El backend resuelve el ID público del profesional a uno de los dos calendarios permitidos.

## 4. Acceso a Google Calendar

El backend utiliza una credencial de la clínica para dos IDs de calendario distintos; no el token de cada paciente.

- **Decisión para este proyecto:** OAuth offline del propietario de la cuenta Gmail personal gratuita, separado del login de pacientes y profesionales.
- No utilizar delegación de dominio: la cuenta no es Workspace. Tampoco elegir una service account sin delegación para un flujo que requiere invitados.

Las invitaciones de Calendar (`attendees`, `sendUpdates`) deben probarse con calendarios de prueba. No es posible garantizar que un evento aparezca automáticamente en el calendario del paciente: depende de su configuración de invitaciones y aceptación. Prometer una invitación, no inserción forzada en su calendario.

La entrega de correo al profesional también debe verificarse: ser propietario de un calendario no garantiza recibir un correo por cada evento creado por API. Si hace falta correo transaccional separado, elegir proveedor y probar entrega/reintentos. Un hosting en Cloudflare no implica que Cloudflare envíe esos correos automáticamente.

Google procesará identidad e invitaciones aunque el backend y la base estén en Cloudflare. Mantener el RUT fuera de Google Calendar, correos y títulos de eventos; usar solo datos mínimos y un ID interno.

## 5. Confirmación y concurrencia

1. Validar sesión, profesional permitido, paciente, horarios, duración y ventana de fechas en servidor.
2. Obtener una clave de idempotencia asociada al usuario y al contenido de la operación; rechazar su reutilización con contenido diferente.
3. Adquirir atómicamente ocupación persistente para todo el intervalo del profesional, incluyendo reservas pendientes y bloqueos manuales.
4. Consultar nuevamente el calendario correspondiente. Ante errores o información incompleta, no asumir que el horario está libre.
5. Crear el evento con ID estable derivado de la reserva, respetando el formato admitido por Google.
6. Confirmar la reserva y registrar trabajos de notificación. Si el resultado de Google es incierto, mantener el cupo ocupado hasta reconciliar, con reintentos acotados y alerta operativa.

Una unicidad por inicio no basta si existen duraciones distintas. Una alternativa es ocupar todas las celdas mínimas del intervalo dentro de una transacción, pero exige definir y validar esa granularidad. Los intervalos son `[inicio, fin)`: terminar a las 11:00 permite comenzar otra cita a las 11:00, salvo buffer configurado.

Las dos agendas no comparten exclusión: Eduardo y Felipe pueden atender simultáneamente. Todas las escrituras desde paciente y módulo profesional utilizan la misma protección.

**Límite externo:** Google permite eventos solapados. No hay transacción única entre D1 y Calendar, ni entre la aplicación y alguien editando directamente desde Google. Para garantizar exclusión dentro del sistema, registrar bloqueos mediante el módulo profesional; detectar cambios externos mediante sincronización y definir qué hacer ante conflictos. No resolverlos cancelando automáticamente una cita sin una política acordada.

Webhooks de Calendar son señales que requieren validación y lectura posterior, no una reserva ni un bloqueo. Añadir sincronización periódica de respaldo y renovación de canales si se habilitan.

## 6. Reglas pendientes

Ver la lista completa en `contexto.md`. Antes de implementar hay que confirmar especialmente:

- IDs de calendarios y correos personales autorizados de ambos profesionales; la cuenta propietaria ya está confirmada como `centrovida.sanaaustral@gmail.com` (Gmail gratuita).
- Jornadas, pausas y excepciones por profesional; los bloques completos de reserva y su separación son de 60 minutos.
- Límite inclusivo/exclusivo de los siete días. «Desde mañana» ya está confirmado como día calendario siguiente, no 24 horas de anticipación.
- Datos requeridos para reservas de terceros y bloqueos sin paciente; política para personas sin RUT.
- Correo destinatario editable, verificación de ese correo y consentimiento al reservar para otra persona.
- Retención de datos y tratamiento de cambios externos en Calendar.

Calcular fechas locales en `America/Santiago` y persistir instantes UTC. No fijar permanentemente el offset `-03` o `-04`.

## 7. Plan de entrega y aceptación

1. **Prueba de viabilidad:** calendarios de prueba, OAuth del propietario, lectura de ocupación e invitación real. Sin datos de pacientes reales.
2. **Base Cloudflare:** despliegue de prueba, sesiones, D1, datos del paciente y allowlist; sitio público sin regresiones.
3. **MVP completo:** flujo paciente y agenda profesional, misma exclusión de intervalos, invitaciones y recuperación de fallos parciales.
4. **Piloto:** sincronización, alertas, privacidad, accesibilidad y pruebas reales controladas antes de producción.

Criterios obligatorios antes de producción:

- Dos solicitudes simultáneas al mismo intervalo: una sola reserva confirmada.
- Intervalos parcialmente solapados y carrera paciente/profesional: sin doble ocupación.
- Dos profesionales a la misma hora: ambas reservas permitidas.
- Reintentos y timeout después de insertar en Google: sin duplicar eventos ni perder reservas.
- Acceso de cada miembro autorizado a ambas agendas: permitido; acceso de pacientes, cuentas no autorizadas o a calendarios ajenos: rechazado por servidor. Ediciones y cancelaciones auditadas por usuario actuante y sincronizadas sin perder ocupaciones ni cambios concurrentes.
- Ventana de fechas y cambios de hora chilenos: comprobados.
- Reserva para tercero: precarga segura e invitación al destinatario acordado.
- Sin RUT, tokens ni datos clínicos en logs, URLs, analítica o calendario.

## 8. Verificación de esta evaluación

- `npm run build`: correcto, ocho páginas generadas.
- `npm audit --omit=dev --audit-level=moderate`: reportó cero vulnerabilidades en el árbol examinado. No equivale a auditoría de seguridad ni certifica el lockfile usado por producción.
- `opencode agent list`: reconoce `coordinador`, `frontend-reservas`, `backend-reservas`, `revisor-reservas` y `qa-reservas`.
- Revisión read-only de los agentes: se corrigieron omisiones sobre permisos de shell, solapamientos, fallos parciales y alcance de bloqueos.
- No se ejecutaron pruebas E2E, autenticación real ni integración con Calendar. No se desplegó ni migró ningún servicio.

## Referencias oficiales

- Astro en Cloudflare: https://docs.astro.build/en/guides/deploy/cloudflare/
- Workers Static Assets: https://developers.cloudflare.com/workers/static-assets/
- Almacenamiento Cloudflare: https://developers.cloudflare.com/workers/platform/storage-options/
- Consistencia de KV: https://developers.cloudflare.com/kv/concepts/how-kv-works/
- Buenas prácticas de Durable Objects: https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/
- OAuth web server de Google: https://developers.google.com/identity/protocols/oauth2/web-server
- Inserción de eventos e invitados: https://developers.google.com/calendar/api/v3/reference/events/insert
- Notificaciones push: https://developers.google.com/calendar/api/guides/push
