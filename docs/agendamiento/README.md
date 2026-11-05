# Agendamiento — índice de especificaciones y planes

Estado: nueve specs y nueve planes vigentes redactados para revisión/ejecución posterior. Recursos bootstrap de staging creados y verificados, aplicación no implementada. No hay autorización general de implementar, migrar o desplegar por esta entrega documental. Fecha: 2026-11-05.

## Por dónde empezar

1. [Frontera obligatoria de infraestructura](seguridad-cloudflare.md) e [inventario autorizado](cloudflare-staging.md).
2. [Lista completa de tareas con responsables y dependencias](tareas.md).
3. [Plan de implementación por entregas](planes/implementacion.md).
4. [Decisiones D01–D09](decisiones.md) y [preparación del usuario](preparacion-usuario.md).

## Especificaciones y planes vigentes

Estos documentos sustituyen la propuesta Calendar y separan requisitos confirmados, decisiones pendientes y diseño técnico propuesto. Los planes detallados están enlazados desde cada spec y desde el plan maestro; aprobar documentación no autoriza mutaciones remotas.

| ID | Especificación | Responsable principal |
|---|---|---|
| S01 | [Identidad, sesiones y permisos](specs/01-identidad-permisos.md) | backend-reservas |
| S02 | [Datos, perfiles y privacidad](specs/02-datos-privacidad.md) | backend-reservas + usuario |
| S03 | [Disponibilidad, reservas y concurrencia](specs/03-motor-agenda.md) | backend-reservas |
| S04 | [Pasarela del paciente](specs/04-pasarela-paciente.md) | frontend-reservas |
| S05 | [Panel compartido del equipo](specs/05-panel-equipo.md) | frontend-reservas + backend-reservas |
| S06 | [Copia manual al calendario personal](specs/06-copia-calendario.md) | backend-reservas + frontend-reservas |
| S07 | [Cloudflare, migración y operación](specs/07-cloudflare-operacion.md) | coordinador + backend-reservas |
| S08 | [Pruebas y aceptación](specs/08-pruebas-aceptacion.md) | qa-reservas + revisor-reservas |
| S09 | [Contratos HTTP compartidos](specs/09-contratos-api.md) | coordinador + backend-reservas |

El plan maestro define entregas E0–E7, dependencias, responsables y verificaciones. S09 es la única fuente del contrato HTTP. S03 fija exclusión transaccional en D1 y S08 las pruebas requeridas.

## Diseño anterior

La carpeta `historico/` y [evaluación inicial](evaluacion-y-arquitectura.md) contienen antecedentes descartados, no instrucciones de ejecución. No recuperar de allí scopes Calendar, sincronización, correos, DO, colas, cambios DNS o nuevas bases.

## Qué es definitivo y qué no

- **Confirmado:** requisitos aceptados en [contexto.md](contexto.md).
- **Propuesto:** decisiones técnicas de estos documentos; necesitan validación al iniciar la implementación.
- **Pendiente Dxx:** ver [registro de decisiones](decisiones.md). No sustituir una decisión por un valor de ejemplo.
- **Completado:** solo cuando exista evidencia. Un documento redactado no significa que Google o Cloudflare estén configurados.

Orden de precedencia: última decisión explícita del usuario → contexto confirmado → especificaciones aprobadas → propuesta de arquitectura. Cualquier diferencia debe corregirse en todos los documentos afectados.

La [evaluación inicial](evaluacion-y-arquitectura.md) conserva los hallazgos y fundamentos, pero no sustituye los contratos de implementación.

## Límites

Incluido: login Google solo identidad, datos editables del paciente/tercero, precarga por cuenta, dos profesionales, reservas de 60 minutos con D1 como agenda oficial, confirmación visible y copia manual al calendario personal; panel compartido con dos pestañas y CRUD de ambas agendas.

Excluido: correos, API Google Calendar, sincronización de calendarios, pagos, historia clínica, autogestión de cancelación por pacientes, recordatorios y UI de membresías. El MCP es herramienta administrativa, no parte del sistema paciente. Otros proyectos, DNS, permisos y producción permanecen fuera del alcance autorizado.
