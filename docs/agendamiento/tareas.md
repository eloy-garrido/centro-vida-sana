# Tareas vigentes y responsables

`[x]` terminado con evidencia; `[ ]` pendiente. Esta lista no concede permisos de ejecución remota. Aplican [seguridad-cloudflare.md](seguridad-cloudflare.md) y el [plan vigente](planes/implementacion.md).

## Documentación y perímetro — coordinador

- [x] MCP conectado y cuenta consultada.
- [x] Crear Worker exclusivo `vida-sana-reservas-staging` en cuenta `21c858ed53ec9083b6fcd89d18c27372`.
- [x] Crear D1 exclusiva `3d91d453-2ef5-4601-80cf-27622a0787bf` y verificar binding `DB`.
- [x] Deshabilitar y verificar `workers.dev` y previews; sin DNS ni dominio conectado.
- [x] Documentar allowlist, aprobaciones, detención por discrepancia y límites reales del MCP.
- [x] Incorporar frontera a contexto, planes e instrucciones de los cinco agentes.
- [x] Separar el diseño anterior de integración Calendar como antecedente histórico/no ejecutable.
- [x] Redactar S01–S09 vigentes y nueve planes detallados, con D1 autoritativa y sin Calendar API/correo.
- [x] Crear registro D01–D09 y guía de preparación del usuario.
- [x] Ratificar especificaciones/contratos y resolver decisiones pertinentes antes de habilitar funciones reales (Fase 0 cerrada 2026-11-05).
- [ ] Elegir gestor de paquetes/Node y validar compatibilidad Astro/Cloudflare local.

## Tus tareas — usuario

- [x] U01: indicar días, apertura/cierre y pausas de cada profesional (L-V 09:00 a 21:00 con pausa 13:00-14:00; Sábados 09:00 a 14:00; Domingo cerrado).
- [x] U02: confirmar extremo semanal (Confirmado: mañana D+1 a D+7 inclusive).
- [x] U03: entregar correos personales reales del equipo (`centrovida.sanaaustral@gmail.com` para admin/equipo inicial).
- [x] U04: definir si el equipo puede crear/editar hoy o fuera de la semana (Sí, hoy D+0 y dentro del mes corriente; bloqueos de 60 min).
- [x] U05: definir RUT obligatorio/excepciones y qué perfil se recuerda (RUT chileno obligatorio, opción extranjeros; recordar último perfil; trazabilidad de fecha de agendamiento y de atención).
- [x] U06: aprobar privacidad, retención, historial de cancelaciones (Soft-delete con estado 'cancelada' sin hard-delete, sin traslado entre agendas en MVP).
- [ ] U07: crear o autorizar preparación de proyecto/cliente Google de **login solamente**, con consentimiento y callbacks exactos acordados. No habilitar Calendar para este sistema.
- [ ] U08: completar personalmente consentimientos Google de prueba; guardar secretos por canal local/Cloudflare seguro, nunca en chat/Git.
- [ ] U09: decidir si basta el perímetro operativo actual o desea aislamiento administrativo con cuenta/credencial separada; no está implementado como restricción IAM.
- [ ] U10: aprobar por separado cada lote de cambios remotos de staging y una eventual URL protegida. No hay autorización implícita para DNS/producción.
- [ ] U11: probar ambos accesos/ambas agendas en piloto y autorizar o rechazar salida posterior a producción.

## Backend local — backend-reservas

Orden de dependencias: entregas E1–E4 del [plan maestro](planes/implementacion.md). Se pueden probar mecanismos con fixtures locales sin inventar reglas como definitivas; U01–U07 bloquean funciones reales pertinentes.

- [x] B01: modelo D1, migraciones locales, perfil/snapshot paciente y validación RUT (E2 completada).
- [x] B02: OIDC, sesiones, CSRF, membresías compartidas e aislamiento por cuenta paciente (E3 completada).
- [x] B03: disponibilidad por jornada y fecha Chile, slots completos de una hora (E4 completada).
- [x] B04: triggers de intervalos en tabla única `agenda_entries`, batch atómico e idempotencia frente a timeout/doble clic; sin tabla duplicada de ocupación (E2 completada).
- [x] B05: edición/cancelación/bloqueos atómicos con control de versión y auditoría (E4 completada).
- [x] B06: contratos HTTP mínimos S09 y resolve de comandos propios, sin sincronización externa ni `202`/estado persistente pendiente (E4 completada).
- [x] B07: exportación manual segura de cita a calendario personal; copia independiente sin RUT ni datos clínicos (E1/E4 completada).
- [ ] B08: preparar configuración/secretos solo para recurso permitido; no ejecutarlos remotamente sin U10.

## Frontend local — frontend-reservas

- [ ] F01: acceso Google, datos editables/precarga por cuenta y elección de profesional.
- [ ] F02: selector de día/hora, resumen, confirmación real y recuperación idempotente.
- [ ] F03: panel compartido con pestañas Felipe/Eduardo, crear/editar/cancelar y bloquear.
- [ ] F04: confirmación destructiva, conflictos de versión y separación del actor/profesional atendiente.
- [ ] F05: accesibilidad, móvil, noindex/no-store, sin PII en almacenamiento/analítica.
- [ ] F06: botón de copia al calendario y aviso de que cambios posteriores no se sincronizan; sin correos.

## QA y revisión — qa-reservas / revisor-reservas

- [x] Q01: preparar runner y fixtures ficticios locales; build/type-check cuando estén configurados (E1 completada con node:test y TypeScript).
- [x] Q02: roles, CSRF, IDOR de perfil/reserva/operación y sesiones revocadas (E3 verificada).
- [x] Q03: concurrencia mismo cupo, solapamiento parcial, paciente/equipo y ambas agendas simultáneas (E2 verificada).
- [x] Q04: versiones, cancelación contra edición y reintento tras commit con respuesta perdida (E4 verificada).
- [x] Q05: mañana no 24h, extremos semana aprobados, pausas y DST Chile (E4 verificada).
- [ ] Q06: tercero, RUT, privacidad de enlace/almacenamiento/logs y copia de calendario.
- [ ] Q07: revisar cada comando de infraestructura contra allowlist sin ejecutar mutaciones ni explorar otros proyectos.
- [ ] Q08: informe de pruebas locales, pendientes y revisión independiente antes de staging.

## Cambios remotos posteriores — coordinador, con U10

- [ ] R01: presentar diff/SQL y destinos exactos; comprobar Worker/UUID/binding y aprobación.
- [ ] R02: migrar únicamente la D1 permitida si ese SQL fue aprobado.
- [ ] R03: configurar secretos/deploy únicamente del Worker permitido si se aprobaron.
- [ ] R04: habilitar acceso protegido de pruebas solo con aprobación específica; sin dominio/DNS de producción.
- [ ] R05: comprobar resultado y registrar evidencia sin datos sensibles; conservar recovery mínimo D1 documentado.
- [ ] R06: solicitar nueva autorización para cualquier recurso extra o futura producción. No crear automáticamente DO, Queue, bucket o base adicional.
