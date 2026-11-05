# S05 — Panel compartido del equipo

Estado: **propuesta vigente lista para revisión**, 2026-11-05. Sustituye el contenido histórico de S05; no autoriza implementar, migrar, desplegar ni publicar.

## 1. Fuentes y frontera obligatoria

Leer [AGENTS.md](../../../AGENTS.md), [contexto](../contexto.md), [seguridad Cloudflare](../seguridad-cloudflare.md), [inventario staging](../cloudflare-staging.md) y [plan maestro](../planes/implementacion.md). Trabajo local primero. La autorización inicial está consumida: cada mutación remota exige nueva aprobación acotada. Sin DNS, dominios, producción, otros proyectos/cuentas, permisos, facturación ni recursos nuevos; workers.dev/previews deshabilitados. Discrepancia implica detenerse, no elegir otro recurso. La frontera no certifica restricción técnica del MCP.

Dependencias S01 identidad/roles, S02 datos/privacidad, S03 motor D1, S09 HTTP y S06 copia manual. [S09](09-contratos-api.md) es el único contrato canónico vigente propuesto; ratificarlo antes de implementar. Esta spec enumera requisitos de integración, no esquemas API paralelos.

## 2. Confirmado y pendiente

Administrador y ambos profesionales con sus propias cuentas Google autorizadas pueden consultar, crear, editar y cancelar/eliminar horas de **ambas agendas**. Dos pestañas superiores: Felipe Méndez y Eduardo Lagos; IDs lógicos `felipe` y `eduardo`. La pestaña selecciona agenda atendiente, no cambia actor ni permisos. Pacientes, cuentas no autorizadas y miembros revocados quedan excluidos en servidor de página y endpoints.

D1 autoritativa, atenciones de 60 minutos y concurrencia independiente entre agendas. Registro manual de atenciones y bloqueos **sin paciente**. Crear/editar/cancelar actualiza recurso y ocupación atómicamente; cada acción identifica al actor real. Confirmación antes de cancelar/eliminar horas. Sin correos, API Calendar, OAuth offline, sincronización, Queues ni Durable Objects; Google solo identidad. Copia manual personal opcional, no sincronizada.

La ventana del paciente comienza mañana por calendario Chile, no 24 horas, con máximo semanal pendiente; **no define por herencia la ventana del equipo**.

| Decisión | Pendiente y efecto |
|---|---|
| D01 — Jornadas | Días, horarios, pausas, excepciones y alineación; no asumir 09:00 como jornada. |
| D02 — Extremo semanal | Precisar límite máximo del paciente; no convertirlo en límite del equipo. |
| D03 — Correos reales autorizados | Identidades reales admin/Felipe/Eduardo; ejemplos no son membresías. |
| D04 — Ventana equipo/bloqueos | Permitir hoy/rangos mayores, límites de consulta/escritura y duración/alineación de bloqueos. No inventar excepciones. |
| D05 — Paciente/perfil/RUT | Campos/validación, terceros, personas sin RUT y perfil recordado; no usar perfil del operador como paciente. |
| D06 — Privacidad/retención | Consentimiento, acceso, minimización y retención, incluida auditoría. |
| D07 — Cambios/cancelación/traslado | Campos editables, cancelación/eliminación, historial, desbloqueo y traslado entre agendas. Traslado no habilitado por defecto. |
| D08 — Proyecto/callbacks/login Google | Cliente/proyecto de identidad y callbacks aprobados, sin Calendar. |
| D09 — URL protegida staging/aprobaciones | Secretos, migraciones, exposición protegida y despliegue con autorización independiente. |

Propuesta: `/agenda`, Astro/TypeScript ligero, cancelación lógica sin purga definitiva; validar D07 antes de implementarla. No incluye administración de allowlist en UI, datos clínicos, pagos, recordatorios, exportación masiva ni autogestión del paciente.

## 3. Interfaz propuesta

1. **Acceso:** consultar sesión y rol vigente; acceso restringido sin entregar agenda/PII si no corresponde. Revalidar en cada petición, no solo al cargar.
2. **Dos pestañas:** vista por fecha/rango en `America/Santiago`, lista accesible de cupos, citas y bloqueos. Separar libre/ocupado/bloqueado/cancelado de estados UI carga/vacío/error/verificación incierta. No existe ocupación `pending_google`.
3. **Crear atención:** paciente manual, profesional e inicio/fin visibles; 60 minutos derivados por servidor. Sin buscar globalmente por RUT ni precargar perfil del miembro. Resumen antes de enviar; libre no asegura reserva.
4. **Bloquear:** intervalo según D04, sin campos de paciente. Propuesta de motivo por código operativo, no texto clínico libre. Crear/eliminar bloqueo comparte exclusión con citas.
5. **Editar:** cargar detalle y versión autorizados; mostrar antes/después y confirmar. Destino ocupado conserva cita original. Sin traslado de profesional hasta resolver D07 y ratificar S09.
6. **Cancelar/eliminar y desbloquear:** diálogo con profesional, fecha/hora y efecto, opción no destructiva inicial y confirmación explícita. No confundir liberar horario con borrar datos personales. Desistir no envía mutación.
7. **Resultado:** sin ocupación optimista; reflejar commit y refrescar agenda. Cambiar pestaña no cancela comando enviado. Advertir sobre borrador sucio e ignorar respuestas tardías de otro rango/agenda.
8. **Copia manual:** detalle vigente ofrece Google/ICS desde endpoint autorizado; payload mínimo sin RUT/identidad del paciente. Advertir independencia y deshabilitar si cancelada; editar/cancelar no actualiza copias externas.

## 4. Referencias HTTP canónicas a ratificar en S09

| Ruta | Uso |
|---|---|
| `GET /api/session` | Identidad, capacidades y mecanismo CSRF del servidor. |
| `GET /api/team/schedule?professionalId=&from=&to=` | Ambas agendas según selección, rangos D04, datos mínimos y versiones; no RUT en listado general. |
| `POST /api/team/bookings` | Crear atención manual en agenda permitida. |
| `PATCH /api/team/bookings/:id` | Editar campos aprobados y/o horario con versión, sin traslado implícito. |
| `DELETE /api/team/bookings/:id` | Cancelar/eliminar hora según D07, no purgar PII implícitamente. |
| `POST /api/team/blocks`, `DELETE /api/team/blocks/:id` | Crear/retirar bloqueo sin paciente según D04/D07. No inventar PATCH de bloqueos. |
| `GET /api/bookings/:id` | Detalle solo para dueño o equipo autorizado; permite recargar versión. |
| `POST /api/commands/resolve` | Sesión + CSRF; body `{idempotencyKey,method,path}`; solo resultado propio sin PII y sin ejecutar nada. Ser equipo no permite consultar comandos de otro actor. |
| `GET /api/bookings/:id/calendar` | Dueño/equipo, opciones manuales enlace Google/ICS mínimas; nunca sincroniza ni muta. |

Mismo origen, sesión opaca segura HttpOnly, CSRF y origen válido. Mutaciones de reservas/bloqueos con `Idempotency-Key`; PATCH/DELETE además `If-Match`: ausencia `428`, obsoleta `412`, ocupación o clave con contenido distinto `409`. No sobreescribir automáticamente ni repetir con versión nueva sin revisión y confirmación nueva. Actor y rol siempre del servidor; únicamente `felipe`/`eduardo`, sin IDs externos arbitrarios.

Creaciones `201 committed`, cambios/cancelaciones `200 committed`, sin `202`. Reserva/bloqueo, ocupación, versión, resultado de comando y auditoría se comprometen atómicamente en D1 según S02/S03. No jobs, estados `pending_google` ni transacción distribuida. Errores de formato, acceso, rate limit o indisponibilidad sin datos personales; recurso no visible sin filtraciones. S09 fija campos, rangos y códigos definitivos.

## 5. Consistencia, recuperación y auditoría

- Motor S03 único para paciente y equipo, exclusión de intervalos por profesional; no basta unicidad de hora de inicio. Bloqueos compiten con citas. Atenciones adyacentes válidas, solapadas no; mismo horario entre agendas sí.
- Editar mueve ocupación atómicamente: si destino falla, origen y versión permanecen. Cancelar/desbloquear libera solo al commit. Fallos de red no revierten ni duplican comandos ya comprometidos.
- Timeout: conservar clave; consultar resolver propio o reenviar mismo body desde memoria con misma clave y precondiciones. No nueva clave por incertidumbre. Tras recarga sin body, resolver; resultado desconocido no ejecuta nada ni demuestra fallo. Aplicar S09: hasta cinco consultas y 60 segundos totales, luego detener automatismos y ofrecer comprobación manual de la agenda/reconsulta explícita, sin otra intención de escritura. D06 fija retención/tombstones sin permitir duplicación de claves expiradas.
- Solo como propuesta limitada, guardar ID/clave opacos en `sessionStorage`, nunca formulario, PII, RUT, tokens o body; borrarlos al terminar/cerrar sesión. Detalle autorizado recupera entidad tras resultado conocido; la autorización no depende de poseer ID/clave.
- Auditoría mínima: actor autenticado, agenda, recurso, acción, fecha UTC, versión y resultado/referencia de comando. No nombre, correo, RUT, tokens ni payload. Historial/retención dependen de D06/D07, no de logs sensibles.

## 6. Accesibilidad y protección

Pestañas semánticas con flechas/foco/selección y panel asociado; alternativa de lista móvil sin exigir arrastre. Formularios con labels/errores vinculados; diálogos con foco contenido/restaurado, Escape y opción volver. Anuncios discretos, contraste AA, objetivos de 44 px y movimiento reducido.

`/agenda` noindex y `X-Robots-Tag: noindex`, sin sitemap ni PII prerenderizada. Página/API `Cache-Control: private, no-store`, sin caché CDN/service worker. Robots no es control de acceso. No PII/tokens en browser storage, URLs, logs, analítica o errores; únicamente referencias opacas propuestas. Enlaces de copia con payload mínimo sin identidad paciente/correo/RUT. Limpiar DOM/memoria al expirar/revocar sesión; preservar SEO público.

## 7. Criterios de aceptación futuros

| ID | Evidencia requerida |
|---|---|
| TEAM-01 | Admin y ambos profesionales CRUD en ambas agendas; actor auditado es el usuario real, no la pestaña. |
| TEAM-02 | Paciente/no autorizado/revocado no accede a página, consultas, mutaciones ni detalle de equipo; agendas ajenas rechazadas; resolver solo propio. |
| TEAM-03 | Pestañas/rangos no mezclan respuestas tardías; estados distinguibles sin color y sin estados de sincronización externa. |
| TEAM-04 | Cita manual 60 minutos; bloqueo sin paciente; jornadas/ventana/bloqueos según D01/D04, sin asumir hoy o más de semana. |
| TEAM-05 | Carreras paciente/equipo y bloqueo/cita tienen un ganador por intervalo/profesional; dos agendas simultáneas válidas. |
| TEAM-06 | Destino ocupado conserva origen; versión antigua `412`, falta `428`, sin pérdida ni sobreescritura. |
| TEAM-07 | Cancelar/desbloquear requiere confirmar; desistir no muta; aceptar libera al commit, audita y no purga PII. |
| TEAM-08 | Doble envío y timeout antes/después de commit no duplican acciones; resolver sin PII ni efectos; misma clave/body, sin `202` ni jobs. |
| TEAM-09 | CSRF/Origen inválidos y clave reutilizada con contenido distinto rechazados; membresía revalidada en ambas agendas; cero correos/API Calendar. |
| TEAM-10 | Teclado/lector/móvil, cabeceras, limpieza de sesión y ausencia PII en almacenamiento/logs/URLs verificadas; copia mínima independiente, canceladas sin copia. |

Pruebas futuras, no ejecutadas ni aprobadas por esta entrega documental. [Plan S05](../planes/05-panel-equipo.md).
