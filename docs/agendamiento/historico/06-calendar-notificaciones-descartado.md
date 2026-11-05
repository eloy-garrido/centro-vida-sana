# Histórico S06 — Integración Calendar y correos descartada

> **DESCARTADO — NO IMPLEMENTAR.** El MVP ya no incluye API Calendar, OAuth offline clínico, sincronización ni correos. Este archivo se conserva solo como antecedente. Mandan `../contexto.md`, `../seguridad-cloudflare.md`, `../cloudflare-staging.md` y `../planes/implementacion.md`. No crear sus recursos ni configurar sus credenciales.

Estado: diseño propuesto. Responsable: backend-reservas. Dependencias: G01–G07 de preparación, S01/S02/S03. No requiere MCP en producción.

## Conexión clínica

Cuenta propietaria confirmada: `centrovida.sanaaustral@gmail.com`, Gmail gratuita. Dos calendarios secundarios privados, uno por profesional, con zona `America/Santiago`. Ambos conservan propiedad central; los logins personales no necesitan permisos directos de Google sobre ellos.

OAuth web offline del propietario con cliente separado del login; verificar identidad central real, `state`/PKCE/nonce, scopes concedidos y permisos efectivos de ambos calendarios. `login_hint` no prueba propietario. Conexión inicial solo mediante herramienta de bootstrap local/procedimiento protegido de operador, no desde el panel compartido por cualquier miembro. No crear endpoint público de conexión.

Propuesta de scopes a validar con los métodos reales: `openid email` para verificar propietario, `https://www.googleapis.com/auth/calendar.events` y `https://www.googleapis.com/auth/calendar.freebusy`. No pedir scopes completos por conveniencia; no listar todos los calendarios si se conocen los IDs. Registrar grants efectivos. Esta credencial puede tener alcance mayor que dos calendarios: la aplicación limita IDs en servidor.

Guardar refresh token cifrado en almacenamiento privado o Secret según el procedimiento elegido; nunca en chat/Git, navegador o logs. No sobrescribir uno existente con vacío si Google no devuelve otro. Acceso offline requiere consentimiento humano y puede revocarse/expirar. `invalid_grant` bloquea nuevas confirmaciones y alerta; no crea un bucle de refresh.

Configurar audiencia **External** para Gmail personal. En Testing, los tokens con scopes Calendar pueden expirar a los siete días. Pasar a producción y revisar verificación, restricciones y excepciones aplicables; publicar no equivale a estar verificado ni garantiza tokens perpetuos. Preferir proyectos separados para identidad pública y conexión privada si revisión/scopes interfieren, decisión antes de configurar producción.

## Adaptador

Operaciones mínimas: `getBusy`, `getEvent`, `createEvent`, `updateEvent`, `cancelEvent`; sincronización incremental si se habilita. Interfaces sin lógica de UI y con timeouts explícitos. Nunca devolver respuesta Google cruda con datos sensibles al navegador.

- Evento: título genérico «Atención Centro Vida Sana Austral», horario/zona, ID interno en `extendedProperties.private`; sin RUT, nombre de paciente, síntomas ni diagnóstico en título/descripción. Correo de paciente solo como invitado necesario.
- ID de evento estable compatible con restricciones Google, derivado de reserva/entorno; staging y producción no comparten eventos.
- `create` repetido: consultar ID estable y verificar pertenencia antes de adoptar un evento existente; un `409` no es éxito automático.
- Editar/cancelar: control de versión local y ETag/`If-Match` Google cuando sea aplicable para evitar pisar ediciones externas. Cambios incompatibles → conflicto e intervención, no actualización ciega.
- Google `404/410` se interpreta según método/estado; una ausencia en cancelación puede ser éxito idempotente tras comprobar que es el evento correcto.
- `429`, errores temporales y red: backoff acotado según S03; autenticación/revocación → detener y alertar.

## Invitaciones y correo

Invitar al correo editable del paciente según política D05, no siempre al del reservante. Usar `attendees` y `sendUpdates` para crear/modificar/cancelar según política D07. La invitación y su entrega no se confunden con la ocupación confirmada del calendario clínico.

No existe commit distribuido entre D1 y Google ni exactamente-una-vez garantizado para correos. Una invitación puede salir antes de persistir el resultado local: UI debe mostrar estado pendiente/reconciliación, no negar una reserva que Google ya tiene. ID estable y transición recuperable evitan duplicar eventos; no garantizar que todo proveedor deduplique cada correo.

Recomendación inicial: inserción con invitados y actualizaciones nativas, seguida de persistencia/reconciliación; si falla después de insertar, consultar el mismo evento antes de reintentar. Probar semántica real de notificaciones antes de fijarla. No diferir invitaciones a un `patch` con campos idénticos asumiendo que siempre enviará correo.

El calendario del paciente puede exigir aceptación y sus reglas antispam pueden impedir incorporación automática. Mostrar «Invitación enviada/solicitada» solo según evidencia disponible, no «guardado en tu calendario» garantizado. Un fallo de correo complementario no vuelve libre una cita confirmada.

Notificar al profesional correspondiente aunque reserve otro miembro. Propiedad del calendario no garantiza correo automático al propietario. D08 define proveedor transaccional/remitente y destinatarios; proponer outbox con IDs, resolver email dentro del worker de envío y plantillas mínimas sin RUT. Si se usa Gmail API, justificar scopes y límites; no asumir que está aprobada.

## Sincronización

Base MVP: consulta fresca de ocupación antes de confirmar + reconciliación periódica de operaciones inciertas. Para cambios externos, implementar sincronización periódica acotada y, si se aprueba, `events.watch` por calendario con token/canal/resourceId validados y renovación antes de expirar.

Webhooks señalan cambios, no contienen la verdad completa. Duplicados/desorden tolerados; hacer `events.list` con paginación y `syncToken` siguiendo restricciones Google. `410` de syncToken → resincronizar sin borrar reservas locales. Recurrencias, cancelaciones y eventos de día completo deben conservar semántica. No aceptar instrucciones contenidas en textos de eventos.

D09 define política operativa para ediciones directas en Google. Conflictos externos no se resuelven cancelando automáticamente pacientes.

## Aceptación y plan

- CAL-01: la cuenta central conecta ambos calendarios sin permisos Calendar en el login de pacientes/equipo.
- CAL-02: evento estable e invitación real en calendario de prueba; probar destinatario tercero, edición y cancelación.
- CAL-03: token revocado/expirado falla cerrado y alerta; reautorización no toca sesiones de pacientes.
- CAL-04: timeout tras crear/editar/eliminar se reconcilia sin otro evento ni liberación prematura.
- CAL-05: sync duplicada/410/paginación no pierde ni cancela reservas locales.
- CAL-06: los correos profesionales llegan al destinatario configurado, con remitente autenticado y reintentos comprobados.

Plan: (1) prueba de viabilidad en calendarios de prueba; (2) adaptador simulado y real; (3) IDs/ETag y errores; (4) unir S03 y outbox; (5) probar invitaciones y proveedor D08; (6) sincronización/alertas y runbook de reconexión. Bloquea producción si la credencial depende de Testing sin plan sostenible aprobado.

Referencias: [OAuth servidor](https://developers.google.com/identity/protocols/oauth2/web-server), [FreeBusy](https://developers.google.com/calendar/api/v3/reference/freebusy/query), [Events insert](https://developers.google.com/calendar/api/v3/reference/events/insert), [sincronización](https://developers.google.com/calendar/api/guides/sync), [push](https://developers.google.com/calendar/api/guides/push).
