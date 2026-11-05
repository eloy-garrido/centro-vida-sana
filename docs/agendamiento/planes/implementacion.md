# Plan maestro vigente — agenda propia D1

Estado: specs y planes redactados para revisión y ejecución posterior; esta entrega no implementa funciones ni concede permisos remotos.

## Mapa de módulos

| Módulo | Especificación | Plan detallado |
|---|---|---|
| Identidad/permisos | [S01](../specs/01-identidad-permisos.md) | [P01](01-identidad-permisos.md) |
| Datos/privacidad | [S02](../specs/02-datos-privacidad.md) | [P02](02-datos-privacidad.md) |
| Motor de agenda | [S03](../specs/03-motor-agenda.md) | [P03](03-motor-agenda.md) |
| Paciente | [S04](../specs/04-pasarela-paciente.md) | [P04](04-pasarela-paciente.md) |
| Equipo | [S05](../specs/05-panel-equipo.md) | [P05](05-panel-equipo.md) |
| Copia personal | [S06](../specs/06-copia-calendario.md) | [P06](06-copia-calendario.md) |
| Plataforma | [S07](../specs/07-cloudflare-operacion.md) | [P07](07-cloudflare-operacion.md) |
| QA/aceptación | [S08](../specs/08-pruebas-aceptacion.md) | [P08](08-pruebas-aceptacion.md) |
| Contratos API | [S09](../specs/09-contratos-api.md) | [P09](09-contratos-api.md) |

Las dependencias por módulo son de integración final, no obligan a esperar todo para crear mocks. El orden siguiente evita ciclos entre base de datos, autenticación y contratos.

## Orden ejecutable por entregas locales

| Entrega | Trabajo, dependencias y responsable | Salida verificable |
|---|---|---|
| E0 | Ratificar specs/arquitectura y registrar [D01–D09](../decisiones.md); coordinador + usuario | Decisiones cerradas o bloqueadas explícitamente; alcance local autorizado antes de código |
| E1 | P07 parte A + P09 tipos/mocks, QA harness P08; no requiere cuentas reales | Build público preservado, Worker/D1 locales, DTOs y fixtures sin bypass desplegable |
| E2 | P02 esquema/repositorios + spike de triggers P03; usa E1 | Migraciones locales y pruebas de no solapamiento/rollback sobre D1 local |
| E3 | P01 login/middleware con proveedor simulado y datos E2 | AUTH y DATA negativos, sesiones/roles/CSRF; OAuth real bloqueado hasta D03/D08 |
| E4 | P03 comandos/API sobre E2/E3 + resolve S09 | SLOT/API: transacción, versiones, idempotencia y respuesta perdida comprobadas |
| E5 | P04/P05 UI sobre contratos E1, pueden empezar mocks antes; P06 sobre API E4 | Pasarela/panel conectados y copia manual; PAT/TEAM/COPY con fixtures |
| E6 | P08 integración cruzada, E2E y revisión read-only sobre E3–E5 | Reporte real: aprobado/fallido/bloqueado/no ejecutado; hallazgos críticos/altos resueltos |
| E7 | Solicitud de staging, solo tras E6 y decisiones pertinentes | Lote de cambios/recurso/exposición presentado; ejecución bloqueada hasta nueva aprobación |

P04 y P05 pueden trabajarse en paralelo tras tipos/mocks estables, sin editar los mismos archivos compartidos a la vez. Toda entrega registra archivos permitidos, criterios asociados y comandos locales reales. Producción no forma parte de E7.

## Regla de entrada a cada fase

Leer [contexto](../contexto.md), [política obligatoria](../seguridad-cloudflare.md) e [inventario](../cloudflare-staging.md). No ejecutar los planes antiguos de Google Calendar.

Únicos destinos permitidos, sujetos a aprobación de cada mutación:

- Cuenta: `21c858ed53ec9083b6fcd89d18c27372`.
- Worker: `vida-sana-reservas-staging`.
- D1: `vida-sana-reservas-staging`, UUID `3d91d453-2ef5-4601-80cf-27622a0787bf`.
- Binding `DB` a ese UUID; configuración `infra/cloudflare-staging/wrangler.jsonc`.

Fuera de alcance: otros proyectos/cuentas, DNS, dominios, rutas, permisos, facturación y producción. URLs de Worker/preview siguen deshabilitadas. Discrepancia = detenerse, no sustituir recursos.

## Fase 0 — Documentación y decisiones

Responsable: coordinador; usuario confirma reglas.

- Frontera e inventario ya documentados. No hay autorización remota pendiente que pueda reutilizarse: la creación inicial está terminada.
- S01–S09 y sus planes ya están reformulados: D1 autoritativa, Google solo login, sin API Calendar/correos ni estados de sincronización externa. Ratificación técnica/decisiones y ejecución siguen pendientes.
- Resolver jornadas, semana máxima, ventana del equipo, bloqueos, correos autorizados, campos y retención.
- Entregable: especificaciones vigentes coherentes y contratos ratificados. El diseño anterior conservado en `historico/` y la evaluación marcada histórica no son instrucciones ejecutables.

## Fase 1 — Implementación y pruebas locales

Responsables: backend-reservas y frontend-reservas; QA local.

- Estandarizar gestor/Node; configurar desarrollo Astro/Workers sin desplegar.
- Diseñar migraciones D1 y exclusión atómica de intervalos, idempotencia, versiones y auditoría; validarlas en base local ficticia.
- Implementar Google OIDC de identidad, sesiones y membresías; mocks locales antes de autenticar cuentas reales.
- Construir pasarela y panel de dos pestañas. Equipo CRUD sobre ambas agendas, pacientes solo flujo propio.
- Añadir «Añadir a mi calendario» manual y advertencia de copia independiente, sin RUT ni datos clínicos en el enlace.
- Entregable: build y pruebas de roles/concurrencia/terceros/cancelación/timeouts/fechas, sin acceso a D1 remota.

Arquitectura propuesta: Astro estático + Worker con assets del mismo Worker, D1 y triggers transaccionales. No se requieren Durable Objects, colas ni ocupación en tabla duplicada; no crear recursos fuera del inventario por seguir arquitectura antigua. El futuro binding `ASSETS` requiere aprobación expresa en el lote remoto, pues el bootstrap actual solo tiene `DB`.

## Fase 2 — Solicitud de cambios de staging

Responsable: coordinador. **Bloqueada hasta autorización explícita.**

Presentar al usuario: cuenta/Worker/UUID exactos, diff del código, SQL de migración, efecto sobre datos, comandos/API, exposición de red y verificación propuesta.

- Solicitar aprobación separada de migración remota, secretos y despliegue; puede aprobarse un lote concreto si todo está descrito.
- Validar nombres/UUID/bindings mediante lectura acotada antes de ejecutar. No depender de una cuenta por defecto.
- No borrar/recrear DB para solucionar un error; detener y presentar alternativa.
- Mantener URLs deshabilitadas salvo autorización específica de exposición protegida. No tocar DNS del sitio.
- Entregable: informe real de cambios y lecturas de comprobación; no marcar prueba real por una simulación local.

## Fase 3 — Piloto protegido

Responsables: QA + usuario; revisión de seguridad read-only.

Con URL de pruebas y cuentas de ensayo expresamente aprobadas: verificar OAuth, aislamiento, roles, dos agendas simultáneas, bloqueo único por intervalo y copia manual al calendario.

No datos reales sin política de privacidad aprobada. Sin correos, sincronización Calendar ni exploración de otros proyectos. Revisar recuperación nativa D1 y procedimiento mínimo, sin restaurar recursos remotos de forma automática.

## Fase 4 — Producción, futura y no autorizada

Requiere solicitud nueva: nombres/IDs exclusivos de producción, permisos, dominio/DNS, migraciones, plan de publicación y vuelta atrás. Nunca convertir staging a producción cambiando su nombre ni usar una base ajena.

## Cierre de cada entrega

Registrar archivos, recursos exactos tocados, aprobación, verificación y límites. Confirmar que no cambió nada fuera de la allowlist. Ante error de permisos o cuota, informar: no ampliar permisos, cuenta o plan automáticamente.
