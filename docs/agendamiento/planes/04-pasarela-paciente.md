# Plan S04 — Pasarela del paciente

Estado: **propuesta lista para revisión**, 2026-11-05. Solo planificación documental: no autoriza implementar ni ejecutar los pasos, instalar herramientas, migrar, desplegar o publicar. [Spec S04](../specs/04-pasarela-paciente.md) define PAT-01–PAT-09.

## Frontera de entrada obligatoria

Leer [AGENTS.md](../../../AGENTS.md), [contexto](../contexto.md), [seguridad Cloudflare](../seguridad-cloudflare.md), [inventario](../cloudflare-staging.md) y [plan maestro](implementacion.md). Únicos destinos posibles de staging, **no autorización de uso remoto**:

- Cuenta `21c858ed53ec9083b6fcd89d18c27372`.
- Worker `vida-sana-reservas-staging`.
- D1 `vida-sana-reservas-staging`, UUID `3d91d453-2ef5-4601-80cf-27622a0787bf`.
- Binding `DB` exclusivamente a ese UUID; configuración `infra/cloudflare-staging/wrangler.jsonc`.

Creación inicial terminada. Cada migración, secreto, deploy o exposición necesita nueva aprobación acotada, destino explícito y lectura de verificación restringida; discrepancia = detenerse, no reemplazar recursos ni usar defaults. Mantener workers.dev/previews deshabilitados. Sin DNS, dominios, rutas, producción, otros proyectos/cuentas, IAM/permisos, facturación, recursos nuevos ni exploración global. Sin borrar/restaurar/recrear sin autorización específica. La frontera es operativa, no garantía IAM del MCP. Frontend/QA locales; revisión sin mutaciones. No delegar ni acceder remotamente como parte de esta entrega.

## Dependencias y decisiones

- S01: identidad Google, sesiones, CSRF y autorización dueño/equipo.
- S02: perfil por cuenta, instantánea, minimización, consentimiento y retención.
- S03: D1 autoritativa, dos agendas, exclusión, commit atómico/idempotencia y resolución de comandos.
- [S09](../specs/09-contratos-api.md): único contrato canónico vigente propuesto; ratificarlo antes de integrar. No copiar esquemas divergentes en UI.
- [S06](../specs/06-copia-calendario.md): copia manual Google/ICS sin API Calendar ni correo; no ejecutar la versión descartada en `historico/`.

Puerta funcional: D01 jornadas, D02 extremo semanal, D05 paciente/perfil/RUT y D06 privacidad/retención antes de datos/reservas reales. D03 correos reales autorizados, D04 ventana equipo/bloqueos y D07 cambios/cancelación/traslado deben quedar coherentes para integración cruzada, sin habilitar historial/autogestión paciente. D08 proyecto/callbacks/login Google antes de identidad real; D09 URL protegida staging/aprobaciones antes de cualquier piloto remoto. Los ejemplos de correos/09:00 no son configuración.

## Pasos futuros numerados

1. **Revisión y aprobación de diseño local.** Confirmar decisiones y contratos de S01/S02/S03/S09/S06, registrar qué sigue pendiente y pedir autorización independiente de implementar. Entregable: matriz de reglas/pruebas PAT y contratos sin `202`, jobs o `pending_google`. Se permiten futuros mocks ficticios solo si se aprueba su implementación; no inventar política faltante.
2. **Preparar infraestructura de UI local.** Tras aprobación, inspeccionar scripts/estructura existentes y proponer `src/pages/reservar.astro`, `src/components/booking/PatientFlow.astro` y componentes de pasos bajo `src/components/booking/`; nombres sujetos a revisión. Reutilizar `BaseLayout.astro`, tokens y datos de clínica/profesionales sin tocar legado ni `dist/`. Entregable: shell noindex accesible, sin PII prerenderizada, con estados mock diferenciados.
3. **Integrar identidad y perfil.** Archivos propuestos `src/scripts/booking/patient-flow.ts` y `src/lib/booking/api.ts` (o ubicación compartida acordada en S09). Consumir GET sesión y GET/PUT perfil; sugerencias Google/precarga por cuenta y edición para tercero, según D05/D06. Sin guardar formulario en navegador. Entregable PAT-01/02/08 y manejo de expiración/guardado fallido, con tipos canónicos S09.
4. **Integrar tarjetas y slots.** Componentes propuestos `ProfessionalCards.astro` y `SlotPicker.astro` en `src/components/booking/`. GET disponibilidad para `felipe`/`eduardo`; invalidación de selección y respuestas tardías. Fechas Chile: mañana calendario, 60 minutos, máximo semanal conforme D02. Entregable PAT-03/04/05 con reloj controlado y configuración ficticia explícita, nunca jornada inferida.
5. **Resumen y commit recuperable.** Proponer `BookingSummary.astro`, `BookingConfirmation.astro` y módulo compartido `src/lib/booking/command-recovery.ts`. POST reserva con CSRF/clave; `201 committed`, detalle por GET solo dueño/equipo. Resolver POST sesión+CSRF, body `{idempotencyKey,method,path}`, propio sin PII y sin ejecutar. Timeout mantiene clave: mismo body solo desde memoria o resolver tras recarga. Propuesta limitada de `sessionStorage` solo ID/clave opacos, sin body/PII/tokens. Entregable PAT-06/07/08 incluyendo fallo antes/después del commit, desconocido/expirado y ausencia de nueva intención automática.
6. **Copia manual y seguridad visual.** Componente propuesto `CalendarCopy.astro` compartible con S05. GET autorizado `/api/bookings/:id/calendar` ofrece enlace Google/ICS mínimo sin RUT/identidad del paciente; advertencia de copia independiente y deshabilitada al cancelar. No correo/API Calendar/OAuth offline/sync/Queues/DO. Cabeceras no-store/noindex requieren handler/runtime aprobado, no solo meta HTML. Entregable PAT-09 sin nuevo historial/listado de reservas paciente.
7. **Validación y revisión local.** Archivos de pruebas propuestos `tests/booking/patient-flow.*`, `tests/booking/patient-api.*`, `tests/booking/concurrency.*`; elegir runner y comandos en entrega aprobada antes de afirmar ejecución. Matriz PAT-01–09, accesibilidad, fechas/DST, autorización, CSRF, perfil de tercero, idempotencia, conflictos cruzados S05 y copia cancelada. Entregable: evidencia real, revisión de seguridad/roles/concurrencia y diff de alcance.
8. **Puertas remotas separadas.** Solo tras cierre local, presentar diff, SQL, secretos necesarios sin valores, comandos, destino exacto, efecto y verificación para aprobar migración, secretos y deploy por operación/lote concreto. D09 exige aprobación separada de URL protegida y cuentas ficticias; D08 callbacks autorizados. Sin datos reales antes de D05/D06. Producción/DNS fuera del plan y de toda aprobación implícita.

## Verificaciones/comandos FUTUROS — no ejecutados

- `npm run build`: mínimo frontend, no prueba de seguridad/concurrencia.
- `npm run dev`: inspección local con fixtures; `npm run preview`: inspección del build local cuando corresponda.
- No existe script `test` configurado: no inventar `npm test` ni marcar tests aprobados. Definir runner/scripts locales con autorización antes de implementarlos.
- Pruebas unitarias de fechas/validación; integración S09 de sesión/perfil/resolver/detalle/calendar; carreras reales contra D1 **local** ficticia; E2E teclado/móvil, reload y timeout antes/después del commit. Matriz dueño/equipo/ajeno y ausencia de PII en storage, URLs, cachés/logs.

No se han ejecutado build ni pruebas funcionales en esta entrega documental. Cierre futuro: archivos tocados, decisiones aprobadas/pendientes, evidencias y límites; no declarar piloto por un mock local.
