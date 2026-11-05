# Plan S05 — Panel compartido del equipo

Estado: **propuesta lista para revisión**, 2026-11-05. Plan documental, no permiso para implementar, migrar, desplegar o publicar. [Spec S05](../specs/05-panel-equipo.md) define TEAM-01–TEAM-10.

## Frontera de entrada obligatoria

Leer [AGENTS.md](../../../AGENTS.md), [contexto](../contexto.md), [seguridad Cloudflare](../seguridad-cloudflare.md), [inventario](../cloudflare-staging.md) y [plan maestro](implementacion.md). Destinos exclusivos posibles de staging, sin autorización remota por este plan:

- Cuenta `21c858ed53ec9083b6fcd89d18c27372`.
- Worker `vida-sana-reservas-staging`.
- D1 `vida-sana-reservas-staging`, UUID `3d91d453-2ef5-4601-80cf-27622a0787bf`.
- Binding `DB` únicamente a ese UUID, configuración `infra/cloudflare-staging/wrangler.jsonc`.

La creación inicial no autoriza más cambios. Mutaciones, secretos, migraciones, deploys y exposición requieren nuevas aprobaciones acotadas; especificar cuenta/recurso, comprobarlos y detenerse ante discrepancia, sin defaults ni sustituciones. workers.dev/previews siguen deshabilitados. No DNS, dominios, rutas, producción, otros proyectos/cuentas, IAM/permisos, facturación, recursos nuevos ni exploración global. No borrar/restaurar/recrear sin aprobación específica. Restricción operativa, no aislamiento IAM certificado del MCP. Frontend/QA locales, revisión sin mutaciones; esta entrega no delega ni accede remotamente.

## Dependencias y puertas funcionales

S01 identidad Google/roles en servidor; S02 privacidad/auditoría/versiones; S03 motor D1 compartido con paciente; [S09](../specs/09-contratos-api.md) contrato HTTP **único canónico**; [S06](../specs/06-copia-calendario.md) copia manual personal. Ratificar estos specs vigentes antes de integrar; no ejecutar sus versiones descartadas de `historico/`. S04 aporta carreras cruzadas y no implica acceso paciente al panel.

Decisiones a cerrar: **D01** jornadas; **D02** extremo semanal del paciente (no heredar al equipo); **D03** correos reales autorizados (ejemplos no válidos); **D04** ventana del equipo y reglas de bloqueo, sin asumir hoy ni más de semana; **D05** paciente/perfil/RUT y terceros; **D06** privacidad/retención; **D07** edición/cancelación/eliminación/desbloqueo e historial, traslado entre agendas no habilitado por defecto; **D08** proyecto/callbacks/login Google de identidad; **D09** URL protegida staging y aprobaciones independientes. Acciones con política sin cerrar no se habilitan con datos reales.

## Pasos futuros numerados

1. **Ratificar reglas y autorización local.** Revisar spec y decisiones con usuario, matriz admin/Felipe/Eduardo × ambas agendas × acciones y contratos S09. Solicitar autorización para implementar localmente; no confundir aprobación de docs con código/runtime. Entregable: reglas/puertas explícitas y fixtures ficticios, sin establecer allowlist con correos ilustrativos.
2. **Crear shell accesible de consulta.** Archivos propuestos `src/pages/agenda.astro`, `src/components/team/TeamSchedule.astro`, `AgendaTabs.astro`, `ScheduleList.astro` y `src/scripts/booking/team-schedule.ts`, sujetos a inspección de estructura aprobada. Reutilizar `BaseLayout.astro`, datos/tokens del sitio. Dos pestañas `felipe`/`eduardo`, lista móvil, fecha Chile, vacío/error/carga y descarte de respuestas tardías. Entregable TEAM-03/10 con mocks, no PII prerenderizada ni nuevo framework.
3. **Conectar sesión y lectura autorizada.** Consumir GET sesión y GET agenda equipo con validación en servidor a través de S01/S09; GET detalle reserva solo dueño/equipo para versión/datos mínimos. API cliente propuesta compartida `src/lib/booking/api.ts`, sin duplicar contratos de S04. No derivar rol del correo editable ni del tab. Entregable TEAM-01/02/09: ambas agendas para todos los miembros, paciente/revocado/ajeno rechazados; no RUT en lista general.
4. **Crear atenciones y bloqueos.** Componentes propuestos `TeamBookingForm.astro` y `TeamBlockForm.astro` en `src/components/team/`. POST `/api/team/bookings` y POST `/api/team/blocks` con sesión/CSRF/clave; citas de 60 minutos, bloqueos sin paciente según D04. Motor S03 D1 atómico compartido, sin ocupación optimista. Entregable TEAM-04/05/08: paciente/equipo/bloqueo compiten, agendas distintas independientes. No API Calendar, correo, OAuth offline, sync, Queues o DO.
5. **Editar y cancelar versionado.** Componente propuesto `ConfirmScheduleChange.astro`; PATCH/DELETE `/api/team/bookings/:id` y DELETE `/api/team/blocks/:id`, con CSRF, clave e `If-Match`. `428` sin versión, `412` obsoleta, `409` cupo/clave incompatible. Confirmar cancelación/desbloqueo; comparar antes/después; destino ocupado conserva origen. Sin traslado hasta D07, sin purga de PII implícita. Entregable TEAM-06/07/09 y auditoría del actor real en ambas agendas.
6. **Recuperar resultados inciertos.** Compartir propuesta `src/lib/booking/command-recovery.ts` de S04. Creaciones `201 committed`, cambios/cancelaciones `200 committed`, sin `202`, `pending_google` ni jobs. Timeout conserva clave, body y precondiciones en memoria para reenvío exacto o POST resolver con sesión+CSRF, body `{idempotencyKey,method,path}`, solo resultado propio sin PII/efectos. Propuesta limitada de `sessionStorage` solo ID/clave opacos; tras recarga resolver sin body, sin crear nueva intención por desconocimiento. Entregable TEAM-08/02 con límites de recuperación y sin sondeo infinito.
7. **Añadir copia manual y endurecer privacidad.** Reutilizar componente propuesto de S04 `src/components/booking/CalendarCopy.astro`. GET autorizado `/api/bookings/:id/calendar`: opciones enlace Google/ICS mínimas sin RUT ni identidad del paciente, aviso de independencia, sin copia si cancelada. Limpiar UI/memoria por revocación/logout, no PII en almacenamiento/URLs/logs; noindex/no-store en página y endpoints, sin cachear agenda. Entregable TEAM-10, incluyendo cabeceras reales del runtime aprobado, no solo meta.
8. **Validar y revisar localmente.** Archivos de pruebas propuestos `tests/booking/team-panel.*`, `tests/booking/team-api.*`, `tests/booking/concurrency.*`; runner/comandos por definir antes de implementación aprobada. Matriz TEAM-01–10 y PAT cruzados; ambos profesionales y admin operan ambas agendas, revocación inmediata, versiones, CSRF, dobles envíos y fallos antes/después de commit. Auditoría sin payload sensible. Revisión de roles/concurrencia/privacidad antes de cerrar.
9. **Solicitar staging por puertas separadas.** Presentar diff, SQL, impacto, secretos sin valores, cuenta/Worker/UUID exactos, comandos y verificación. Aprobar migraciones, secretos y deploy en operaciones/lotes explícitos; D09 exige aprobación adicional de exposición protegida manteniendo URLs deshabilitadas hasta entonces. D03/D08 antes de pruebas de login real; D05/D06 antes de datos reales. Piloto solo con URL/cuentas de ensayo aprobadas; producción/DNS y restauración requieren autorización distinta y no se ejecutan por este plan.

## Pruebas/comandos FUTUROS — no ejecutados

- `npm run build`: validación mínima del frontend; no acredita roles, consistencia ni concurrencia.
- `npm run dev` y, cuando corresponda, `npm run preview`: inspección exclusivamente local con datos ficticios.
- No hay framework ni script `test` configurado: acordar runner/scripts locales antes de escribir o anunciar comandos nuevos. No afirmar `npm test` aprobado.
- Unitarias de ventanas/versiones; integración de todos los endpoints × roles × ambas agendas; concurrencia contra D1 **local** ficticia, con solapamientos/adyacencias y rollback completo; timeout/cierre/recarga, resolver ajeno y claves incompatibles.
- E2E pestañas, confirmación destructiva/desistimiento, teclado/lector/móvil; copia cancelada, cabeceras, expiración y ausencia de PII en browser storage, logs/URLs/cachés.

Esta entrega no ejecuta build ni pruebas funcionales. Cierre futuro: evidencias efectivamente obtenidas, archivos, decisiones abiertas, aprobaciones y destinos tocados; nunca presentar mock local como piloto remoto ni ampliar permisos para superar errores.
