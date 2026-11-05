# Plan S08 — Preparación y ejecución futura de QA

Estado: **plan vigente, no ejecutado**. Especificación: [S08](../specs/08-pruebas-aceptacion.md). Dependencias normativas: [contexto](../contexto.md), [plan maestro](implementacion.md), [seguridad](../seguridad-cloudflare.md) e [inventario](../cloudflare-staging.md). Aprobar estos documentos no concede permiso para implementar, instalar, ejecutar pruebas ni operar servicios. Esta entrega solo modifica documentación.

## 1. Frontera completa

QA de backend y UI trabaja **localmente por defecto**, con datos sintéticos y D1 local real, sin credenciales remotas. La revisión de seguridad es read-only. No se necesita acceso administrativo remoto para construir ni probar localmente.

Allowlist remota exacta, que no constituye autorización para usarla:

- Cuenta: `21c858ed53ec9083b6fcd89d18c27372`.
- Único Worker: `vida-sana-reservas-staging`.
- Única D1: `vida-sana-reservas-staging`, UUID `3d91d453-2ef5-4601-80cf-27622a0787bf`.
- Binding: `DB` exclusivamente a ese UUID.
- Configuración: `infra/cloudflare-staging/wrangler.jsonc`.

Antes de cada cambio remoto se necesita aprobación nueva, explícita y acotada de operación/lote, cuenta y recurso, SQL/diff, impacto, comandos, exposición y verificación. Creación bootstrap y aprobación documental no son permisos reutilizables. Usar destinos explícitos, nunca cuenta/recurso implícitos; ante discrepancia detenerse, sin sustitución ni recreación.

No recursos extra, DNS, dominios/rutas, permisos/IAM, facturación, producción, URL pública ni acceso a otros proyectos/cuentas. Mantener `workers.dev` y previews deshabilitados. Secretos, migraciones, despliegue y eventual URL protegida requieren aprobaciones específicas; no activarlos para facilitar QA. No listar globalmente recursos ni explorar datos ajenos. No borrar/restaurar/recrear D1 o Worker sin autorización específica. La frontera es operativa: no afirmar que el MCP está técnicamente limitado a ella. Este plan no requiere MCP ni comandos remotos.

## 2. Dependencias y bloqueos

| Dependencia | Requisito antes de aceptar |
|---|---|
| S01 identidad | OIDC, sesiones, membresías de servidor y CSRF definidos; D03/D08 para prueba real |
| S02 datos | Separación reservante/paciente, snapshots y política D05/D06 |
| S03 motor | Migraciones D1, exclusión INSERT/UPDATE/reactivación, transacciones, idempotencia y versiones |
| S04/S05 UI | Pasarela y panel de dos pestañas, ambos integrados al mismo backend local |
| S06 copia | Enlace Google/ICS manual, privado y sin sincronización |
| S07 operación | Entorno local aislado, configuración segura y procedimiento mínimo de recuperación |
| S09 contratos | HTTP canónico, `If-Match`, errores y resolución de comandos acordados antes de fijar asserts |
| D01/D02/D04/D07 | Jornadas, extremos semana, ventana/bloqueos del equipo y cambios/cancelación; fixtures no sustituyen decisiones |
| D09 | Cualquier piloto/URL de staging bloqueado sin aprobación específica |

La regla ya confirmada es 60 minutos y desde mañana calendario en `America/Santiago`, no 24 horas. No reabrirla como decisión pendiente. Google solo login; no Calendar API/correos/OAuth offline/sync/Queues/DO.

## 3. Secuencia propuesta y entregables

### Paso 1 — Congelar contratos y trazabilidad

- Revisar S01–S09 y resolver contradicciones antes de codificar tests.
- Enlazar cada criterio AUTH/DATA/SLOT/PAT/TEAM/COPY/API/OPS con QA-01–21, fixture, nivel y estado.
- Mantener D01–D09 y casos bloqueados visibles. Los tres usuarios ficticios representan administrador y dos profesionales con permisos en ambas agendas, no direcciones reales autorizadas.
- Entregable futuro: matriz trazable y registro de decisiones, sin marcar aceptación por lectura documental.

### Paso 2 — Preparar harness exclusivamente local

- Bajo una solicitud futura de implementación, acordar Node/gestor/versiones y proponer Vitest para unidades/integración y Playwright para E2E.
- Preparar runtime Workers con D1 local persistida en directorio aislado de fixtures; migraciones reales y puertos de loopback. Guardar configuración de tests separada de cualquier ejecución remota.
- Asegurar que el runner falla si se apunta a URL no local o necesita credenciales de Cloudflare. No usar `--remote` ni datos reales.
- Implementar reloj inyectable y proveedor OIDC simulado con fallos. Identidad de test solo en build local de test: probar su exclusión y rechazo en artefactos desplegables, nunca backdoor activable por header/query/env.
- Entregable futuro: harness reproducible, seed sintético y comandos documentados tras existir. No instalar ni cambiar runtime en esta entrega.

### Paso 3 — Reglas, identidad y privacidad

- Cubrir QA-01–07: callback/state/nonce/firma/claims/replay, CSRF, sesión, IDOR, roles, paciente tercero, RUT condicionado a D05 y privacidad D06.
- Fechas: mañana con menos de 24 horas, hoy, medianoche, DST/zona Chile, mes/año, pausas y fronteras de semana según decisión. Incluir navegador en otra zona.
- Entregable futuro: casos unitarios e integración HTTP con evidencia de controles reales, distinguiendo simulación OIDC de login real.

### Paso 4 — Concurrencia y transacciones D1 local real

- Ejecutar QA-08–11 y QA-14 contra el motor local, nunca mocks de transacciones: 20 comandos concurrentes por intervalo; dos profesionales simultáneos; paciente contra bloqueo/edición; miembros con versiones obsoletas.
- Probar triggers con SQL INSERT/UPDATE y reactivación/reset de cancelada, solapamiento parcial/contención, adyacencia, liberación y nueva ocupación. No debilitar constraints para obtener verde.
- Inyectar fallos antes del commit en reserva/ocupación/auditoría/resultado idempotente; comprobar rollback completo. Tras commit descartar respuesta y reiniciar proceso: resolución/reintento con misma clave recupera un único resultado durable.
- Probar `POST /api/commands/resolve` con `{idempotencyKey,method,path}`, autenticación y CSRF; misma clave/cuerpo, clave/cuerpo distinto y clave ajena. No GET con claves en URL, `202` ni `pending` externo.
- Entregable futuro: resultados repetibles, conteos SQL y trazas redactadas; limitaciones del emulador explícitas, sin proclamar validación remota.

### Paso 5 — E2E local paciente/equipo y copias

- Cubrir QA-12–18/20: flujo completo, pérdida de respuesta, confirmación solo tras persistencia, matriz tres usuarios × ambas agendas × CRUD, confirmación de cancelación y recuperación de conflicto.
- Comprobar lectura `GET /api/bookings/:id` y copia `GET /api/bookings/:id/calendar` para dueño/equipo; denegar IDOR. POST de mutaciones con idempotencia y edición/cancelación con `If-Match` según S09.
- Inspeccionar Google link/ICS decodificados sin nombre/email/RUT del paciente; aviso de copia independiente y sin actualización por cambios/cancelación. No abrir servicios externos para acreditar la generación local.
- Recorrer teclado, foco, anuncios, errores, pestañas y diálogos; 320/390/768/1280 px, zoom y reduced motion. Separar emulación móvil de cualquier futura prueba física.
- Entregable futuro: E2E, capturas/trace sintéticos redactados y registro de casos bloqueados.

### Paso 6 — Regresión y revisión read-only

- QA-19/21: build, inventario real de rutas públicas y regresión de navegación, fuentes/assets, WhatsApp, SEO/JSON-LD/canonicals/sitemap; `noindex` solo donde corresponde.
- Revisar código, migraciones, concurrencia, autorización, privacidad, contratos, artefacto sin fixture y ausencia de servicios descartados. Revisar recuperación nativa sin ejecutar restauraciones.
- Resolver hallazgos críticos/altos antes de cerrar implementación local; conservar diferencias entre revisión, test local y test remoto.
- Entregable futuro: informe read-only con hallazgos y evidencia real. No afirmar que un build valida el sistema completo.

### Paso 7 — Cierre local y eventual solicitud de piloto

- Registrar comandos efectivamente ejecutados, versiones, diff/commit, casos aprobados/fallidos/bloqueados/no ejecutados y riesgos. Crear informe en `docs/agendamiento/verificaciones/` solo al existir resultados.
- Si se solicita piloto, presentar por separado operaciones exactas, cuenta/Worker/D1/binding, SQL/diff, secretos necesarios, URL protegida y método de verificación; esperar autorización acotada antes de cada cambio remoto.
- D03/D05/D06/D08/D09 y las reglas pertinentes deben estar resueltas antes de pacientes/cuentas reales. No convertir éxito local en autorización de staging ni de producción.
- Entregable futuro: cierre local o informe bloqueado; piloto y producción siguen siendo fases distintas no autorizadas por este plan.

## 4. Comandos futuros, no ejecutados ni garantizados

Estas propuestas requieren primero implementar y aprobar el harness. No se afirma que existan los scripts de test ni dependencias. No ejecutar `npx` para descargar herramientas por deducción de este plan. Los futuros scripts deben forzar loopback/D1 local y rechazar destinos remotos.

| Comando propuesto | Condición/objetivo |
|---|---|
| `pnpm run build` | Script build existente; gestor pnpm propuesto P07, futura entrega sin desplegar |
| `pnpm run test:unit` | Script futuro Vitest, reglas/reloj/validaciones |
| `pnpm run test:integration:local` | Script futuro Workers/D1 local, migraciones y concurrencia real |
| `pnpm run test:e2e:local` | Script futuro Playwright contra frontend/backend de loopback |
| `pnpm run test:artifact` | Script futuro que verifica ausencia del bypass/secretos en artefacto desplegable |

No se incluyen comandos de deploy, migración remota, secretos, restauración ni activación de URL. El diseño posterior de scripts deberá documentar versiones, arranque/parada y aislamiento sin modificar recursos remotos. Cualquier limpieza solo afecta al directorio local de fixtures exacto, nunca al trabajo del usuario ni a una base remota.

## 5. Evidencia actual

Esta entrega produce únicamente S08 y este plan. **No se instalaron runners, no se ejecutaron tests/build, no se implementó runtime ni se operó Cloudflare.** Los resultados futuros deberán registrarse cuando existan; la revisión documental no cuenta como prueba funcional aprobada.
