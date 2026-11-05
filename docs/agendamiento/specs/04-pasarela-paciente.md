# S04 — Pasarela del paciente

Estado: **propuesta vigente lista para revisión**, 2026-11-05. Sustituye el contenido histórico de S04; no acredita implementación ni autoriza implementar, migrar, desplegar o publicar.

## 1. Fuentes y frontera obligatoria

Lectura obligatoria: [AGENTS.md](../../../AGENTS.md), [contexto](../contexto.md), [seguridad Cloudflare](../seguridad-cloudflare.md), [inventario staging](../cloudflare-staging.md) y [plan maestro](../planes/implementacion.md). Estas fronteras prevalecen sobre cualquier propuesta técnica. Trabajo local primero; la creación inicial no autoriza nuevas mutaciones. Sin DNS, dominios, producción, otros proyectos/cuentas, permisos, facturación ni recursos nuevos. Mantener workers.dev/previews deshabilitados; discrepancia de destino implica detenerse. La frontera es operativa, no una garantía de restricción técnica del MCP.

Dependencias: S01 identidad/permisos, S02 datos/privacidad, S03 motor D1, S09 contratos y S06 copia manual al calendario. [S09](09-contratos-api.md) es el **único contrato HTTP canónico vigente propuesto**: ratificarlo antes de implementar. Las referencias siguientes son requisitos de alineación, no un segundo esquema de payloads ni autorización para ejecutar documentos históricos.

## 2. Alcance confirmado y decisiones abiertas

Confirmado:

- D1 es la fuente autoritativa; dos agendas lógicas independientes, `felipe` y `eduardo`. Atenciones simultáneas entre profesionales están permitidas. Cupos y reservas ocupan 60 minutos completos, sin derivarlos de las duraciones comerciales.
- Google OAuth solo identifica (`openid email profile`). Sin correo, invitaciones, API Calendar, OAuth offline, sincronización, Queues ni Durable Objects.
- Primera fecha: mañana por calendario de `America/Santiago`, no 24 horas transcurridas. Máximo una semana, con extremo aún pendiente. El servidor valida jornada, límites, profesional y disponibilidad; consultar/seleccionar no bloquea.
- Reservante autenticado y paciente pueden ser distintos. Nombre, correo y RUT atendido son editables; precarga vinculada a la cuenta, nunca búsqueda por RUT. El correo editable no verifica identidad, cambia roles ni recibe notificaciones.
- Confirmación en pantalla solo después del commit D1. Copia manual opcional al calendario, independiente y sin RUT. Mantener WhatsApp sin adjuntar automáticamente datos del formulario.

| Decisión | Pendiente; no asumir una respuesta |
|---|---|
| D01 — Jornadas | Días, apertura/cierre, pausas, excepciones y alineación; las 09:00 del ejemplo no fijan jornada. |
| D02 — Extremo semanal | Inclusión/exclusión del último día y cálculo exacto del máximo de una semana. |
| D03 — Correos reales autorizados | Cuentas personales de administrador/Felipe/Eduardo; ejemplos no son allowlist. No condiciona el login general del paciente. |
| D04 — Ventana equipo/bloqueos | Hoy, rangos mayores, consulta y reglas de bloqueo; no extender reglas del paciente por inferencia. |
| D05 — Paciente/perfil/RUT | Política de perfil recordado y actualización al reservar para terceros, validación y personas sin RUT; no sobrescribir perfil silenciosamente. |
| D06 — Privacidad/retención | Consentimiento, acceso, minimización, retención y tratamiento de datos de terceros. |
| D07 — Cambios/cancelación/traslado | Detalle de edición, cancelación/eliminación, historial y eventual traslado entre agendas por equipo. |
| D08 — Proyecto/callbacks/login Google | Proyecto/cliente de identidad y callbacks locales/staging aprobados, sin Calendar. |
| D09 — URL protegida staging/aprobaciones | Secretos, exposición protegida, migraciones y despliegue con aprobaciones específicas independientes. |

Fuera de alcance: listado/historia de reservas del paciente, autogestión de cancelación/reprogramación, pagos, historia clínica y recordatorios. Recuperar una confirmación por ID no constituye una nueva pantalla de historial.

## 3. Flujo propuesto

Ruta propuesta `/reservar`, Astro y TypeScript ligero; reutilizar `src/data/clinic.ts` y `src/data/professionals.ts`.

1. **Login:** consultar sesión, ofrecer Google y manejar rechazo/expiración sin exponer tokens al cliente.
2. **Datos editables:** consultar perfil solo de la cuenta autenticada; precargarlo si está disponible o sugerir nombre/correo de identidad y dejar RUT vacío. Explicar “Persona que recibirá la atención”. Guardar perfil según D05/D06, sin modificar instantáneas previas ni confundirlo con confirmar reserva. Un fallo de guardado se muestra como tal.
3. **Tarjetas:** foto, nombre y área de Felipe Méndez (quiropraxia/kinesiología) y Eduardo Lagos (acupuntura/MTC); selección explícita.
4. **Slots:** fechas y horas elegibles del servidor en Chile; distinguir carga, vacío y fallo. Cambiar profesional invalida día/hora; cambiar día invalida hora. Ignorar respuestas tardías; sin configuración aprobada no inventar cupos.
5. **Resumen:** paciente, correo de contacto, profesional, inicio/fin, zona y dirección; RUT minimizado y editable. Avisar que seleccionar no asegura el cupo y que no se enviarán correos.
6. **Confirmación:** una intención por clave; mostrar confirmación solo con resultado `committed`. Conflicto refresca slots conservando borrador en memoria. Estado de red incierto no se presenta como reserva fallida ni como confirmada.
7. **Copia manual:** desde confirmación vigente ofrecer opciones enlace Google/ICS obtenidas mediante GET autorizado. Avisar que cambios/cancelaciones no actualizan la copia externa. Reserva cancelada: informar estado y deshabilitar copia.

## 4. Referencias HTTP y recuperación

Rutas requeridas en S09; no se fijan aquí tipos JSON alternativos:

| Referencia | Uso y autorización |
|---|---|
| `GET /api/session` | Identidad/capacidades del servidor y mecanismo CSRF; nunca allowlist ni tokens Google. |
| `GET /api/patient-profile`, `PUT /api/patient-profile` | Perfil exclusivo de la cuenta actual, según D05/D06. PUT requiere sesión, CSRF y origen válido. |
| `GET /api/availability?professionalId=&from=&to=` | Solo `felipe`/`eduardo`, rango validado, slots sin datos de otros pacientes. |
| `POST /api/bookings` | Instantánea editable del paciente; servidor deriva fin a 60 minutos y valida todas las reglas. |
| `GET /api/bookings/:id` | Solo dueño reservante o equipo autorizado; recuperar confirmación tras resolver comando, sin enumeración ni historial nuevo. |
| `POST /api/commands/resolve` | Sesión + CSRF, body `{idempotencyKey,method,path}`. Consulta únicamente resultado propio sin PII; jamás ejecuta/reenvía el comando ni devuelve payload sensible. |
| `GET /api/bookings/:id/calendar` | Dueño o equipo autorizado; opciones enlace Google/ICS con payload mínimo, sin RUT ni datos clínicos. No modifica D1 ni agenda externa. |

S09 define rangos, campos y errores. PUT de perfil usa precondiciones de creación/versión allí indicadas. Instantes inequívocos UTC; fechas y presentación por `America/Santiago`, sin offset fijo. Sesión mediante cookie opaca segura HttpOnly; no tokens Google accesibles a JavaScript.

- Mutaciones de reservas/bloqueos: `Idempotency-Key`, sesión, CSRF y origen válido. Vincular clave a actor, método, ruta y contenido; misma intención devuelve mismo resultado, contenido distinto se rechaza. PATCH/DELETE de recursos versionados requieren `If-Match` (equipo).
- Creación `201 committed`; cambios/cancelaciones `200 committed`. Commit atómico de reserva, ocupación y resultado de comando en D1, con auditoría según S02/S03. Sin `202`, `pending_google`, jobs ni reconciliación externa. `confirmed`/`cancelled` describen la entidad; `committed` describe el resultado del comando.
- Timeout: conservar clave; resolver comando o repetir **mismo body** con la misma clave. Si no hay resultado conocido, no afirmar que falló ni generar otra intención automáticamente. Con body perdido tras recarga, resolver; no reconstruirlo ni ejecutar desde el resolver. Aplicar límite y salida operativa S09: cinco consultas como máximo y 60 segundos totales; después detener automatismos y ofrecer reconsulta manual/contacto genérico sin crear otra reserva. Retención/tombstones de claves expiran según D06, nunca habilitando replay como comando nuevo.
- Propuesta limitada: solo ID/clave opacos en `sessionStorage`, sin PII, tokens, perfil, formulario ni body. Reenvío del body únicamente desde memoria; tras recarga, resolver y recuperar detalle autorizado. Limpiar referencias al terminar/cerrar sesión; poseer ID/clave no autoriza acceso.
- Errores de sesión/CSRF, validación, ocupación, idempotencia y disponibilidad se muestran sin datos personales. `409` de cupo vuelve a selección; no sustituir selección silenciosamente. Sin bucles de reintento/sondeo ilimitados.

## 5. Accesibilidad y privacidad

Labels, errores asociados, foco al primer error y al cambiar paso, teclado completo y anuncios de resultado no repetitivos. Contraste AA, objetivos táctiles de 44 px, móvil sin scroll horizontal, `prefers-reduced-motion` y estados no basados solo en color.

Ruta `noindex`/`X-Robots-Tag: noindex`, fuera de sitemap; no alterar SEO público. Página y API sensibles `Cache-Control: private, no-store`, sin CDN/service worker ni prerender de PII. No datos personales, RUT o tokens en browser storage, URLs, analítica, logs o errores; excepción propuesta solo para referencias opacas descritas arriba. Enlaces externos exclusivamente de calendario con payload mínimo aprobado, sin identidad del paciente, correo ni RUT. Limpiar DOM/memoria al salir o expirar sesión. Auditoría con actor, recurso, acción, fecha y resultado, sin copiar datos de paciente.

## 6. Criterios de aceptación futuros

| ID | Evidencia requerida |
|---|---|
| PAT-01 | Login solo identidad; rechazo/expiración controlados; perfil ajeno nunca accesible. |
| PAT-02 | Tercero con nombre/correo/RUT editables, actor intacto y perfil según D05; reservas previas no cambian; cero correos. |
| PAT-03 | Hoy 12:00 permite mañana 09:00 si hay jornada; hoy se rechaza. Medianoche y DST Chile correctos. |
| PAT-04 | D01/D02 coinciden en UI/servidor; sin aprobación no se inventan jornadas ni extremo semanal. |
| PAT-05 | 60 minutos completos; cambio de profesional/día invalida selección; vacío distinto de fallo. |
| PAT-06 | Doble clic y timeout antes/después del commit crean una sola reserva; misma clave/body y resolver propio sin PII/efectos; sin `202`. |
| PAT-07 | Carrera paciente/paciente o paciente/equipo deja una sola ocupación por intervalo/profesional; ambas agendas simultáneas válidas. |
| PAT-08 | Manipular profesional, fechas, duración, rol, CSRF, ID ajeno o resolver no evade autorización. GET detalle/calendar solo dueño/equipo; copia deshabilitada si cancelada. |
| PAT-09 | Teclado/lector/móvil, noindex/no-store y ausencia de PII en almacenamiento/logs/URLs verificadas; copia Google/ICS mínima e independiente, sin RUT ni llamadas Calendar. |

Pruebas y build son futuros, no ejecutados en esta entrega documental. Plan separado: [plan S04](../planes/04-pasarela-paciente.md).
