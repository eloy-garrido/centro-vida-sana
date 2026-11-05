# Histórico S03 — Motor con sincronización Calendar, no ejecutar

> **HISTÓRICO — NO EJECUTAR su plan.** Requiere adaptación al alcance propio D1, Google solo login y sin Calendar/correos. Mandan `../contexto.md`, `../seguridad-cloudflare.md`, `../cloudflare-staging.md` y `../planes/implementacion.md`. Ningún recurso, permiso, dominio o despliegue descrito aquí queda autorizado.

Estado: reglas confirmadas + diseño técnico propuesto. Responsable: backend-reservas. Depende de S01, S02, S06 y decisiones D01/D02/D04.

## Reglas

- Dos profesionales independientes: la misma hora puede estar reservada una vez para cada uno.
- Cada atención ocupa 60 minutos completos y los inicios se ofrecen separados por una hora, alineados a la jornada aprobada. Terminar antes no libera tiempo.
- Pacientes: desde el día calendario siguiente en `America/Santiago`, no desde `ahora + 24h`.
- Máximo una semana: **D02 pendiente** para límites exactos. Propuesta a aprobar: días locales D+1 a D+7 incluidos, equivalente a `[inicio D+1, inicio D+8)`.
- Jornadas, pausas, días y excepciones: **D01 pendiente**. Las 09:00 eran un ejemplo, no una jornada aprobada.
- Ventana del equipo para crear/editar/bloquear hoy o después de una semana: **D04 pendiente**. No habilitar excepciones implícitas.
- Intervalos `[inicio, fin)`; citas contiguas válidas salvo pausas/buffers aprobados. La cita completa debe caber en jornada.

## Disponibilidad

Servidor genera candidatos desde jornada y reglas aprobadas, convierte a UTC con biblioteca compatible Workers y resta: ocupación local pendiente/confirmada, bloqueos y `freeBusy` del calendario seleccionado. Eventos externos parciales bloquean cualquier cupo que se solape, aunque duren menos de una hora; respetar días completos, recurrencias y transparencia según Google.

Respuesta solo con IDs/instantes de cupos, zona y límites; nunca detalles de eventos ajenos. Revalidar siempre al confirmar. Error de `freeBusy` global o por calendario = disponibilidad desconocida, no libre. Fechas manipuladas, offsets falsos o cupos inventados se rechazan en servidor.

## Exclusión propuesta

Durable Object por profesional coordina operaciones; D1 conserva el bloqueo atómico verificable. Propuesta: celdas UTC de un minuto para **cada minuto solapado** por el intervalo, con unicidad `(professional_id, cell_start_utc)`. Los instantes de cita se validan sin segundos; al importar ocupación externa se redondean sus bordes hacia fuera si se materializa. Esta granularidad técnica no cambia la duración de 60 minutos.

Adquirir todas las celdas y registrar operación/reserva en un lote transaccional probado. Un conflicto revierte el lote completo. Misma vía para paciente, equipo, bloqueos y reintentos. Alternativa de exclusión por intervalos solo si demuestra garantías equivalentes. No confiar en una comprobación SELECT seguida de INSERT sin exclusión atómica.

No mantener un lock en memoria o `blockConcurrencyWhile` durante llamadas de red lentas. Persistir primero; las celdas son autoridad durante el I/O. Leer ocupación con consistencia apropiada (primario/sesión D1 según configuración); nunca liberar basándose en una réplica atrasada.

## Máquina de estados

| Operación | Estado interno | Ocupación | Finalización |
|---|---|---|---|
| Crear | pending_google | Nuevo intervalo adquirido | Evento confirmado → confirmed |
| Resultado Google incierto | pending_reconciliation | Conservar | Consultar mismo ID de evento, no generar otro |
| Crear rechazado de forma definitiva | failed/conflict | Liberar solo tras certeza de no evento activo | Respuesta segura, elegir otro cupo |
| Editar horario | updating | Conservar antiguo y adquirir destino; celdas comunes siguen siendo de la entidad | Google actualizado → cambiar versión/liberar antiguo sobrante |
| Cancelar/eliminar | cancelling | Conservar intervalo hasta resolver Google | Evento ausente/cancelado confirmado → cancelled y liberar |

Propuesta: «eliminar» del panel cancela el evento Google y conserva una marca mínima interna, no borra definitivamente datos personales. Necesita aprobación D07. Eliminar un bloqueo sigue la misma lógica recuperable.

Actualizaciones/cancelaciones usan versión esperada y operación exclusiva por entidad. Evitar borrar celdas comunes o reservas ajenas en reintentos. Si un cambio exige otro profesional, no implementarlo como atajo: MVP propuesto permite cambiar fecha/hora/datos dentro de la misma agenda; traslado entre agendas requiere política adicional D07.

Idempotencia: clave única por actor/operación y hash canónico del contenido. Repetir misma clave/contenido devuelve la misma operación; contenido diferente produce `409 IDEMPOTENCY_MISMATCH`. Las claves y resultados tienen política de retención aprobada, no expiran mientras la operación está incierta.

## Recuperación

Toda operación externa lleva ID estable y trabajo persistente. Reintentos con backoff y jitter, cantidad y tiempo máximos configurados; al agotarlos, bloquear intervención automática, conservar ocupación incierta y alertar a operador. Nunca reintentar para siempre ni liberar por edad sin reconciliación. Calendar permite solapamientos externos; detectar/alertar, no prometer exclusión frente a escrituras fuera de la app.

## Aceptación

- SLOT-01: hoy 12:00 permite mañana 09:00 si jornada/cupo lo permiten; hoy nunca al paciente.
- SLOT-02: N confirmaciones al mismo cupo → una sola reserva confirmada; peticiones parcialmente solapadas y carrera paciente/equipo también excluidas.
- SLOT-03: igual hora en Eduardo y Felipe → dos reservas válidas.
- SLOT-04: reintento tras timeout no crea otro evento ni libera un cupo incierto.
- SLOT-05: dos ediciones concurrentes → una aceptada y otra conflicto de versión; cancelar contra editar no pisa cambios.
- SLOT-06: fallos inyectados en cada transición recuperan estado sin perder celdas ni bloquear indefinidamente sin alerta.
- SLOT-07: DST, pausas, límites y eventos externos de pocos minutos no habilitan cupos incorrectos.

## Plan del módulo

1. Aprobar D01/D02/D04 y definir reloj inyectable con tests de fechas.
2. Implementar jornada/disponibilidad sin mutaciones y adaptador Calendar simulado.
3. Probar atomicidad de celdas, idempotencia y versionado en runtime local D1/DO.
4. Implementar crear, luego editar/cancelar/bloqueos con misma máquina de estados.
5. Añadir reconciliación, fallos parciales y contención N concurrentes; pasar S08 antes de conectar cuentas reales.
