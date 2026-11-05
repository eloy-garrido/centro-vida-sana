# P03 — Motor transaccional propio

Spec: [S03](../specs/03-motor-agenda.md). Responsable: backend-reservas. Depende de P02/P09 y middleware P01 para integrar API. D01/D02/D04/D07 gobiernan reglas reales. Estado: propuesto, no ejecutado.

Perímetro obligatorio [seguridad](../seguridad-cloudflare.md): cuenta `21c858ed53ec9083b6fcd89d18c27372`, Worker `vida-sana-reservas-staging`, D1 `3d91d453-2ef5-4601-80cf-27622a0787bf`, binding `DB`. Solo local salvo aprobación remota exacta. Sin otros recursos/proyectos, DNS, permisos, producción o URLs públicas; parar por discrepancia.

## Secuencia

1. Crear reloj/políticas tipados en `src/server/agenda/`; tests de mañana local, rango semanal parametrizado, jornadas y DST. Fixtures explícitos, sin jornadas productivas inventadas.
2. Generar slots de 60 minutos por profesional y descontar `agenda_entries` activas. Respuesta sin datos de terceros.
3. Probar spike SQL en runtime D1 local: triggers INSERT/UPDATE de no solapamiento entre reservas/bloqueos, contigüidad permitida, cancelación/reactivación y cambio de intervalo.
4. Definir guardas de versión/resultado: UPDATE de cero filas u obsoleto no produce auditoría ni recibo de éxito. Demostrarlo con fallos inyectados; no basta preleer en JS.
5. Implementar comando transaccional `DB.batch()` que une entidad, auditoría y recibo idempotente; única clave por actor. Fingerprint HMAC canónico sin guardar cuerpo personal en recibo. Ordenar auth/CSRF → estructura/fingerprint → replay → reglas actuales solo para nuevo comando; probar reintento tras medianoche/cambio de jornada/edición posterior.
6. Añadir creación, luego edición/cancelación y bloqueos por el mismo servicio. Fracaso revierte lote completo; sin procesos externos ni estado persistido pendiente.
7. Implementar replay/resolve y lectura actual de entidad. Tras fallo concurrente de batch, releer recibo propio antes de devolver conflicto de slot/versión: el ganador puede haber aplicado la misma clave. Si respuesta se pierde tras commit, conservar clave; `not_found` no habilita nueva intención automática.
8. Conectar a endpoints S09 y ejecutar carreras locales paciente/equipo; documentar resultados para QA.

## Entregables / salida

- Código propuesto `src/server/agenda/{policy,availability,commands}.ts`, repositorios y migraciones de trigger/guards.
- Tests SLOT-01–07: mismo cupo, parcial, dos profesionales, bloqueos, versiones, batch rollback y commit con respuesta perdida.
- Comandos futuros `pnpm run test -- agenda` y `pnpm run test:integration:local`; runner definido en P07/P08. Nada ejecutado en esta entrega.
- Validación obligatoria con D1 local real, no solo SQLite/mocks. Si la exclusión no es verificable, detener y revisar diseño; no crear DO por cuenta propia.
- Revisión independiente antes de proponer SQL/deploy en la allowlist remota. D01/D02/D04/D07 pendientes impiden operar sobre pacientes reales.
