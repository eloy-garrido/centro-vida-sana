# S08 — Pruebas y criterios de aceptación

Estado: **especificación vigente; implementación y pruebas pendientes**. Este documento define aceptación, no acredita funcionalidades implementadas ni pruebas ejecutadas. Aprobarlo no autoriza instalar herramientas, ejecutar pruebas, acceder a servicios remotos, migrar, desplegar o publicar.

Fuentes: [contexto](../contexto.md), [seguridad Cloudflare](../seguridad-cloudflare.md), [inventario](../cloudflare-staging.md) y [plan maestro](../planes/implementacion.md). Ejecución futura: [plan S08](../planes/08-pruebas-aceptacion.md). S09 es el contrato HTTP canónico; cualquier discrepancia se resuelve documentalmente antes de implementar, no mediante rutas alternativas.

## 1. Alcance de aceptación

- D1 es la fuente autoritativa de dos agendas lógicas independientes: Eduardo y Felipe. Pueden atender simultáneamente.
- Google OIDC solo autentica con `openid email profile`. No Calendar API, correo, OAuth offline, sincronización, Queues ni Durable Objects.
- Cada reserva ocupa 60 minutos y los cupos se separan por 60 minutos. La duración comercial del catálogo no cambia la ocupación.
- Paciente: desde mañana calendario en `America/Santiago`, no desde 24 horas después. Máximo una semana, con extremos pendientes de D02. Disponibilidad consultada no bloquea cupos.
- Administrador y dos profesionales (tres usuarios autorizados) gestionan ambas agendas; el paciente no accede al panel ni a operaciones de equipo.
- Reserva, ocupación, auditoría y resultado idempotente se confirman o revierten juntos mediante transacciones D1. Las mutaciones concurrentes usan exclusión de intervalos y control de versión `If-Match` según S09.
- Google/ICS únicamente permiten una copia manual, sin nombre, correo ni RUT del paciente. No se sincroniza ni se envían invitaciones.
- Fuera del MVP: cancelación/reprogramación autónoma del paciente, pagos, historia clínica y recordatorios.

## 2. Decisiones y bloqueos de aceptación

Una fixture explícita permite probar mecanismos, pero no resuelve una decisión de negocio ni habilita reservas reales. Registrar casos bloqueados, no omitirlos silenciosamente ni darles resultado aprobado.

| Decisión | Falta confirmar | Impacto QA |
|---|---|---|
| D01 | Jornadas, pausas, excepciones y alineación por profesional | Probar motor parametrizado; aceptación de horarios reales bloqueada |
| D02 | Extremos inclusivos/exclusivos del máximo de una semana | Casos frontera D+7/D+8 parametrizados; no elegir límite por suposición |
| D03 | Tres correos reales de la allowlist del equipo | Identidades ficticias locales; ejemplos históricos no autorizan cuentas |
| D04 | Ventana del equipo y reglas de bloqueos | No heredar ni ampliar automáticamente la ventana del paciente |
| D05 | Paciente/perfil recordado, validación y personas sin RUT | Casos de formato y separación de identidad; política final pendiente |
| D06 | Consentimiento, privacidad, acceso y retención | Sin pacientes reales ni aceptación de retención hasta aprobación |
| D07 | Edición, cancelación/eliminación, desbloqueo e historial | Probar atomicidad y versiones; semántica final pendiente, no purgar datos por deducción |
| D08 | Proyecto/cliente OIDC y callbacks locales/de pruebas | Simulación local no acredita login real ni callbacks autorizados |
| D09 | Secretos, URL protegida de staging y aprobaciones | Piloto remoto bloqueado; ninguna URL pública habilitada por esta spec |

## 3. Niveles y entorno propuestos

1. **Unitarias — Vitest propuesto:** reloj inyectable, reglas de zona, normalización/validación, autorización y estados HTTP. Sin afirmar que el runner ya existe.
2. **Integración local — runtime Workers y D1 local real:** migraciones, triggers, constraints, transacciones, HTTP, idempotencia, sesiones y CSRF. No sustituir con mocks la atomicidad o la exclusión de D1. Si el runtime elegido no reproduce una garantía requerida, registrar la limitación y bloquear su aceptación.
3. **E2E local — Playwright propuesto:** build de prueba, backend local y datos sintéticos; flujo paciente/equipo, accesibilidad y regresiones. Proveedor OIDC simulado para fallos controlados.
4. **Revisión de seguridad read-only:** código, SQL, contratos, configuración, evidencias y riesgos. No cambia recursos ni ejecuta restauraciones.
5. **Piloto protegido futuro:** solo con D08/D09 y permisos específicos. La simulación de OIDC y D1 local no es evidencia de OAuth o D1 remoto.

La fixture de identidad debe existir únicamente en un build local de test, excluida del artefacto desplegable. Una variable de entorno, cabecera, query o endpoint capaz de activar un bypass en staging/producción no es aceptable. Probar que el artefacto desplegable no contiene ni acepta ese mecanismo. Nunca automatizar contraseñas Google ni guardar tokens reales en fixtures.

## 4. Matriz de criterios

Los grupos siguientes trazan requisitos a casos QA concretos. La aprobación requiere evidencia positiva y negativa donde corresponda.

| Grupo | Criterio de aceptación | Casos |
|---|---|---|
| AUTH | OIDC validado, sesión segura, rol decidido por servidor, CSRF y callbacks resistentes a replay/redirect | QA-01–03, QA-19 |
| DATA | Reservante distinto del paciente; perfil editable y aislado; sin fuga de datos; retención condicionada a D05/D06 | QA-04–05, QA-17 |
| SLOT | Zona Chile, 60 minutos, jornadas/ventanas, independencia de agendas, exclusión y atomicidad real | QA-06–11 |
| PAT | Flujo completo accesible; resumen, confirmación solo tras commit y recuperación de respuesta perdida | QA-12, QA-15, QA-18 |
| TEAM | Tres miembros CRUD sobre ambas agendas, bloqueos, versiones y auditoría del actor; paciente excluido | QA-09–10, QA-13–14 |
| COPY | Copia manual Google/ICS privada, autorizada e independiente, sin API externa de agenda | QA-16 |
| API | Contratos S09, idempotencia, resolución autenticada/CSRF, lectura dueño/equipo e IDOR | QA-02–03, QA-11, QA-15, QA-20 |
| OPS | QA local, revisión read-only, regresión pública, artefacto sin bypass, evidencia y permisos explícitos | QA-17–21 |

## 5. Casos verificables

### Identidad y datos

- **QA-01 — OIDC de identidad:** aceptar únicamente tokens válidos del issuer/cliente acordados; rechazar firma, `iss`, `aud`, expiración o `nonce` inválidos. Probar `state` inválido/ausente, callback repetido, código fallido y redirección fuera de destinos permitidos. Scopes solo `openid email profile`; sin `access_type=offline`, scopes Calendar ni almacenamiento de refresh tokens.
- **QA-02 — Sesiones y CSRF:** sin sesión, expirada y tras logout no acceden a datos protegidos. Cookies con atributos seguros según entorno y sin exposición a JavaScript. Mutaciones y resolución de comandos rechazan CSRF ausente/incorrecto y origen no permitido conforme S09, incluso con cookie válida. El callback usa sus controles OIDC propios.
- **QA-03 — Roles e IDOR:** paciente A no lee reserva/perfil/copia/resultado de comando de B. Alterar ID, profesional, agenda, rol o payload no concede permisos. Probar cada miembro del equipo y cada endpoint en ambas agendas; rechazar paciente, cuenta no autorizada y agenda inexistente. Nunca derivar rol del correo editable del paciente ni del navegador.
- **QA-04 — Paciente tercero y perfil:** cuenta reservante A puede registrar paciente B con nombre/correo/RUT editables; identidad de login y autorización permanecen A. Precarga solo de datos propios permitidos por D05; editar no expone otros perfiles ni modifica retroactivamente snapshots de reservas anteriores. El correo del paciente no acredita identidad ni recibe notificación.
- **QA-05 — Validación y política pendiente:** entradas vacías, largas, malformadas, normalización de RUT y dígito K según D05; política sin RUT explícitamente bloqueada hasta decisión. D06 define consentimiento y retención antes de probar su aceptación final. Usar exclusivamente datos sintéticos.

### Disponibilidad y persistencia

- **QA-06 — Fecha y zona:** hoy rechazado por servidor; mañana 09:00 aceptable aunque desde hoy 12:00 falten menos de 24 horas, si D01 lo permite. Probar medianoche local, cambio de mes/año, navegador en otra zona y fronteras de D02. Fechas no se calculan con offset fijo de Chile.
- **QA-07 — DST y jornadas:** fixtures alrededor de transiciones de `America/Santiago`, incluidos horarios locales inexistentes/ambiguos; no duplicar ni inventar cupos. Usar versión de datos de zona registrada y casos concretos documentados. Probar apertura, cierre, pausas, excepciones, semana sin horas y bloque de 60 minutos que cruza un límite; el servidor rechaza entradas manipuladas. Reglas del equipo quedan condicionadas a D04.
- **QA-08 — Carrera real:** lanzar al menos 20 comandos independientes concurrentes para el mismo intervalo/profesional contra D1 local real: exactamente una reserva activa y una ocupación, sin auditorías de éxito huérfanas. Las demás respuestas siguen el conflicto S09. Repetir con ambos profesionales a la misma hora: ambas reservas válidas. El número 20 es un escenario, no una promesa de capacidad.
- **QA-09 — Exclusión SQL:** verificar triggers/constraints con INSERT y UPDATE directos sobre el esquema local, no solo validación HTTP. Rechazar igualdad, contención y solapamiento parcial por profesional; permitir adyacencia y simultaneidad entre profesionales. UPDATE de la misma fila sin conflicto no se autoexcluye. Tras cancelar/liberar, el intervalo puede reservarse; reactivar/resetear el estado de una reserva cancelada no elude la exclusión si otro ocupa ese intervalo. Bloqueos manuales tienen la misma protección.
- **QA-10 — Atomicidad:** inyectar fallo en cada etapa antes del commit de crear, editar, mover, bloquear y cancelar: reserva, ocupación, versión, auditoría y resultado idempotente no quedan parcialmente persistidos. Mover a un intervalo ocupado conserva intacto el anterior. Cancelar libera ocupación junto con el cambio de estado; no borra historial/datos fuera de D07. Auditoría identifica actor, reserva, acción y fecha, sin copiar datos del paciente a logs.
- **QA-11 — Idempotencia y commit incierto:** misma clave y mismo comando, incluso simultáneos, producen un único efecto y el resultado estable; misma clave con contenido distinto tras commit se rechaza según S09. Un lote perdedor por trigger/versión relee el recibo ganador y devuelve replay si corresponde, no falso conflicto. Claves de otro usuario no revelan ni reutilizan resultados. Forzar commit exitoso y perder la respuesta HTTP; reintentar y resolver recupera el mismo resultado sin nueva reserva/auditoría de éxito, incluso tras medianoche, cambio de jornada/política o versión posterior de la entidad. Auth/CSRF se revalidan antes del replay; reglas actuales no invalidan recibos exitosos. Reiniciar el proceso local no pierde el resultado persistido. Fallo antes de commit no deja éxito parcial. No mocks de la transacción.

### Flujos, contratos y copias

- **QA-12 — Flujo paciente:** login, datos editables, tarjetas con profesional/área, disponibilidad, resumen y confirmación. Consultar o seleccionar no bloquea. Doble clic, pestañas paralelas y cupo ocupado entre lectura/confirmación no duplican ni muestran éxito falso. Mostrar agotado/conflicto y permitir volver a consultar sin perder indebidamente los datos del formulario.
- **QA-13 — Equipo:** matriz de tres usuarios × dos agendas × consultar/crear/editar/cancelar-eliminar según D07. Ambas pestañas funcionan para cada usuario y permiten registro manual/bloqueo según D04. El servidor valida permisos en cada petición. Pedir confirmación antes de eliminar/cancelar; cancelar el diálogo no muta datos.
- **QA-14 — Versiones:** dos miembros leen la misma versión y editan/cancelan simultáneamente con `If-Match`: solo el primero compatible tiene éxito; el obsoleto no sobrescribe, no libera cupos ajenos ni genera auditoría de éxito. Versión ausente/incorrecta recibe el error S09. Probar carrera paciente contra bloqueo y movimiento/cancelación de equipo contra reserva.
- **QA-15 — Recuperación canónica:** `POST /api/commands/resolve` con body `{idempotencyKey,method,path}`, autenticación y CSRF; no usar GET con clave en URL. Resolver solo el comando del actor autorizado, vinculando método/ruta, sin filtración entre usuarios. POST de mutaciones lleva idempotencia según S09 y ediciones/cancelaciones su versión. `GET /api/bookings/:id` solo dueño/equipo. Timeout se presenta como resultado desconocido que se consulta/reintenta con la misma clave, nunca éxito ni fracaso deducido. No `202` ni estado externo `pending`; ausencia de resultado no equivale a reserva confirmada.
- **QA-16 — Copia manual:** `GET /api/bookings/:id/calendar` exige dueño/equipo y no crea/modifica una reserva ni llama Calendar API. Google link e ICS contienen únicamente título genérico, profesional, fechas/zona y ubicación permitida; nunca nombre, correo, RUT, tokens ni información clínica del paciente. Verificar contenido decodificado, propiedades ICS, URLs, escaping y ausencia de `ATTENDEE`/invitaciones. UI advierte antes de copiar: cambios/cancelaciones no actualizan la copia y añadir varias veces puede duplicarla. No afirmar que una copia externa fue añadida por generar el enlace.

### Privacidad, UI y operación

- **QA-17 — No filtración:** inspeccionar logs, errores, URLs propias, analítica, storage del navegador y cachés con marcadores sintéticos. Sin RUT, nombre/correo de paciente, tokens ni payload sensible en logs/localStorage/URLs/analítica. Endpoints privados y de calendario con política `no-store` según S09. Callback no registra códigos/tokens ni deja credenciales en historial tras completarse. Resultados de QA redactados.
- **QA-18 — Accesibilidad y móvil:** recorrer paciente y equipo con teclado; foco visible, orden coherente, foco al cambiar paso/abrir y cerrar diálogos, pestañas operables, errores asociados a campos y anuncios de carga/conflicto/éxito. Comprobar etiquetas, contraste, zoom 200 %, `prefers-reduced-motion`, objetivos táctiles y ausencia de scroll horizontal en 320/390/768/1280 px. Viewport emulado no acredita prueba en teléfono físico; registrar ambas por separado cuando existan.
- **QA-19 — Artefacto y dependencias:** revisión read-only confirma ausencia de bypass desplegable de identidad, secretos/PII en bundles y dependencias de Calendar, correo, OAuth offline, Queues o DO. Fallos OIDC simulados no sustituyen validaciones de firma/claims. No añadir excepciones de seguridad para facilitar E2E.
- **QA-20 — Contratos HTTP:** validar esquemas, errores y códigos exactos de S09, métodos/contenido inválidos, límites de entrada y ausencia de datos privados en errores. Lecturas no mutan ocupación; mutaciones no confiables no saltan autenticación/CSRF/versión/idempotencia. Cualquier contrato aún no acordado bloquea su caso; no inventar alternativas en tests.
- **QA-21 — Regresión y frontera:** inventariar rutas públicas actuales y comprobar navegación, assets/fuentes, WhatsApp, responsive, canonicals, Open Graph, JSON-LD, sitemap/robots y seguridad de cabeceras compatible con OIDC. Reservas/panel con `noindex`, contenido público indexable. Build local sin editar `dist/` ni versión heredada. Revisar procedimiento mínimo de recuperación nativa D1 sin restaurar recursos remotos; ninguna prueba accede fuera de la frontera ni habilita URL, DNS o producción.

## 6. Evidencia y puertas de cierre

Cada ejecución futura registra commit/diff de referencia, fecha, entorno local/remoto explícito, versiones de Node/runner/runtime/migraciones/tzdata, comando realmente utilizado, casos, resultado, duración, artefactos redactados y limitaciones. Estados: **aprobado, fallido, bloqueado o no ejecutado**. Diferenciar revisión documental, simulación, prueba local real y piloto remoto; no convertir una en otra.

Para cerrar una implementación local: build y suites pertinentes ejecutados, QA-08–11 y QA-14 con D1 local real, roles negativos/ambas agendas, revisión read-only y hallazgos críticos/altos resueltos. Casos condicionados por D01–D09 permanecen bloqueados hasta decisión. Un build verde no acredita concurrencia, identidad ni aceptación funcional.

Para piloto: decisiones pertinentes resueltas, contratos consistentes, privacidad aprobada, autorización acotada de cada cambio remoto y de una eventual URL protegida. Producción requiere otra solicitud y autorización independiente. **Evidencia de esta entrega: documentación solamente; no se ejecutaron pruebas ni se implementó el sistema.**
