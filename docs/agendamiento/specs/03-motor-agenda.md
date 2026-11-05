# S03 — Motor propio de disponibilidad y reservas

Estado: diseño vigente propuesto; no código ni SQL aprobado. Responsable: backend-reservas. Plan: [P03](../planes/03-motor-agenda.md).

Obligatorio: [contexto](../contexto.md), [frontera](../seguridad-cloudflare.md), [inventario](../cloudflare-staging.md), [decisiones](../decisiones.md). Local primero. Cualquier destino no inventariado o mutación no aprobada exige detenerse; no recursos adicionales, DNS ni producción.

## Reglas de negocio

- Agendas `felipe` y `eduardo` independientes en D1. Ambas pueden tener una cita a la misma hora.
- Atención: 60 minutos completos; inicio separado por una hora, alineación de jornada D01. La cita completa cabe entre apertura/cierre y fuera de pausas.
- Paciente desde mañana por fecha local Chile, no `ahora+24h`. Máximo semanal D02; propuesta pendiente D+1…D+7 inclusive.
- D01 fija horarios/excepciones; D04 fija ventana y duración de bloqueos del equipo. Sin configuración aprobada no habilitar cupos reales.
- Intervalos `[inicio,fin)`. Fin de una cita puede coincidir con inicio de otra. Cualquier solapamiento parcial con bloqueos se rechaza.
- No restringir por un calendario personal externo; solo la agenda D1 es oficial. No API Calendar/correos/colas/DO.

## Consulta

Generar slots desde jornada aprobada usando fecha local `America/Santiago`, convertir instantes a UTC y restar entradas `confirmed` del profesional. Responder fechas/horas, no nombres ni detalles de otras citas. La lectura no bloquea un slot; el commit revalida reglas y exclusión.

Reloj inyectable; no fijar offset -03/-04 ni sumar 24h para día local. Fechas inexistentes/ambiguas por DST requieren resolución explícita y tests. Cliente envía instante RFC3339 UTC; servidor deriva fin, comprueba alineación y ventana. No aceptar duración/profesional inventados.

## Exclusión atómica propuesta

Usar una sola tabla `agenda_entries`. Triggers BEFORE INSERT y BEFORE UPDATE rechazan entradas activas si existe otra activa del mismo profesional con:

`existing.start_at < new.end_at AND existing.end_at > new.start_at`

UPDATE excluye el mismo ID; también controlar reactivación/cambio de estado y profesional. Usar `RAISE(ABORT, código_estable)` en el trigger, no un SELECT previo como garantía. CHECK de `end>start`, fin de atención a +3600 segundos e integridad por kind. No `OR REPLACE` ni rutas que evadan triggers.

D1 serializa las escrituras de su base; una sentencia con trigger comprueba y modifica dentro de la misma transacción. Componer entrada + auditoría + resultado idempotente con `DB.batch()` transaccional. Si una sentencia falla, revertir todo el lote. No hacer BEGIN/COMMIT de varias peticiones independientes ni bloquear en memoria.

Probar este diseño sobre D1 local antes de fijar migración; si el runtime no ofrece garantías requeridas, detenerse y presentar alternativa, sin crear DO u otra base automáticamente. Referencia: [batch D1](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch).

## Comandos, versiones y red

1. Autenticar/autorizar de nuevo, validar CSRF/Origin y estructura mínima del payload/clave/método/ruta; calcular fingerprint sin reevaluar todavía jornada, ventana o precondición de versión de la entidad.
2. Buscar resultado `(actor,idempotencyKey)`: mismo método/ruta/fingerprint → devolver resultado original; distinto → `409 IDEMPOTENCY_MISMATCH`. Un comando ya confirmado se reproduce aunque haya cambiado el día, la jornada, la política o la versión de la entidad; la autorización actual sí sigue siendo obligatoria.
3. Solo para comandos nuevos, validar reglas actuales, ventana, consentimiento y payload completo; capturar reloj/versión de política. Ejecutar batch con escritura de entidad, auditoría y resultado. La clave única de comando es parte de esa transacción: una carrera/replay no puede dejar otro cambio persistido.
4. PATCH/DELETE exigen versión esperada (`If-Match`). La comparación y prueba de que la fila fue efectivamente modificada ocurren dentro del batch mediante guardas SQL/trigger; un UPDATE de cero filas no autoriza auditoría ni resultado de éxito. Preleer versión en JS no basta. Probar ausencia de efecto ante versión obsoleta/entidad faltante.
5. Solo después de commit retornar éxito `201/200`. Sin estado persistente `pending_google`, invitaciones o reconciliación externa.

Carrera con la misma clave: si el lote perdedor falla por unicidad, trigger de intervalo o versión porque el ganador ya aplicó la misma intención, releer primero el recibo autoritativo `(actor,key)`. Si coincide fingerprint/método/ruta, devolver replay, no un falso conflicto de cupo/versión. Si no coincide, `IDEMPOTENCY_MISMATCH`; si no existe, devolver el error real seguro sin efectos. Probarlo para creación y edición, no solo envíos secuenciales.

Estados de entidad: `confirmed` y `cancelled`. Errores de validación/cupo/versión no cambian la entidad anterior. Al reprogramar, UPDATE de intervalo bajo trigger; si destino falla, se conserva íntegra la cita original. Cancelar cambia estado y versión atómicamente, dejando libre el intervalo sin borrado de historia.

Si se pierde respuesta tras commit, la UI conserva clave y resuelve comando o repite exactamente con la misma clave/body. La resolución `not_found` no demuestra que otra solicitud no siga en vuelo; no generar otra clave automáticamente. Lecturas de resolución/membresía autoritativas; no activar read replication sin revisar consistencia.

## Aceptación

- SLOT-01: hoy 12:00 permite mañana 09:00 si jornada/cupo aprobados; hoy se rechaza al paciente.
- SLOT-02: 20 escrituras concurrentes mismo intervalo dejan una sola entrada/auditoría/comando ganador; perdedores sin efectos.
- SLOT-03: mismo horario en ambos profesionales confirma dos citas; bloqueos parciales y carrera paciente/equipo excluidos.
- SLOT-04: idempotencia y timeout después de commit no duplican cita; misma clave con otro cuerpo tras commit se rechaza. Reintentar un éxito después de medianoche, cambio de jornada/política o edición posterior devuelve el recibo original sin reevaluar reglas nuevas; no evita revalidar permisos actuales.
- SLOT-05: edición a destino ocupado, versión vieja o cancelación concurrente conserva origen o produce un único cambio válido, nunca auditoría falsa.
- SLOT-06: fallo inyectado de auditoría/command_results revierte entrada; cancelación permite nuevo uso del intervalo sin borrar histórico.
- SLOT-07: DST, medianoche, jornadas/pausas, D+7/D+8 según decisión y reglas de equipo se validan en servidor.

Dependencias: S01, S02, S09; D01/D02/D04/D07. Traslado entre profesionales no se habilita sin D07 y contrato explícito.
