# Histórico S02 — Datos del diseño con Calendar, no ejecutar

> **HISTÓRICO — NO EJECUTAR su plan.** Requiere adaptación al alcance propio D1, Google solo login y sin Calendar/correos. Mandan `../contexto.md`, `../seguridad-cloudflare.md`, `../cloudflare-staging.md` y `../planes/implementacion.md`. Ningún recurso, permiso, dominio o despliegue descrito aquí queda autorizado.

Estado: propuesta de modelo lógico; no es migración SQL aprobada. Responsable: backend-reservas. Aprobación de políticas: usuario. Depende de D03, D05, D06 y S07.

## Modelo mínimo

| Entidad | Campos/conceptos principales | Integridad/acceso |
|---|---|---|
| users | ID interno, Google `sub` único, correo verificado, nombre | Identidad no editable desde formulario de paciente |
| sessions / oauth_attempts | hash sesión, usuario, expiración/revocación; estado/nonce/PKCE temporales | Un solo uso OAuth; expiración y limpieza |
| team_members | usuario/sub, correo autorizado, etiqueta admin/profesional, activo | Ambas etiquetas dan CRUD sobre las dos agendas; sin UI de membresías |
| professionals | ID público estable de datos existentes, calendario configurado, jornada, zona | Solo dos valores admitidos; configuración privada |
| patient_profiles | dueño `user_id`, nombre, correo y RUT cifrados, versión, consentimiento | Solo dueño en flujo paciente; precarga del último perfil confirmado |
| bookings | ID, profesional, reservante nullable en ingreso manual, snapshot paciente cifrado, inicio/fin UTC, origen, estado, versión, evento Google | Snapshot no cambia al editar perfil; acceso de equipo auditado |
| blocks | ID, profesional, intervalo, estado, versión, evento Google | Sin paciente/RUT requerido para bloqueo administrativo |
| occupancy | profesional, celda temporal UTC, referencia reserva/bloqueo/operación | Unicidad atómica por profesional/celda; S03 |
| operations | ID, actor, tipo, hash de petición, clave idempotencia, estado, versión esperada | Vincula todos los reintentos y su resultado |
| outbox_jobs | tipo, ID operación/entidad, estado, intento, próxima ejecución | Sin copiar nombre, email o RUT al payload |
| calendar_connection / sync | propietario verificado, token cifrado, scopes, syncToken/canal por calendario | Acceso exclusivo de servicios de integración |
| audit_events | actor interno, acción, ID entidad/operación, fecha, resultado | Sin nombre, correo, RUT ni snapshot de datos clínicos |

DDL, índices y migraciones reversibles se diseñarán con pruebas locales. Revisar capacidades transaccionales de D1 antes de fijar SQL. No simular transacciones mediante varias peticiones independientes.

## Perfiles de terceros

MVP propuesto: un perfil editable recordado por cuenta; al reservar para otra persona se puede actualizar explícitamente ese perfil. Mostrar claramente qué se recordará. No crear directorio familiar/múltiples perfiles sin nueva aprobación. La reserva guarda siempre su propia instantánea. La política de persistencia exacta se confirma en D05.

GET/PUT de perfil deducen el dueño de la sesión, nunca de `userId` enviado. No buscar personas globalmente por RUT. El equipo consulta datos necesarios de reservas, no todo el historial de perfiles de usuarios.

RUT: normalización y dígito verificador módulo 11 en servidor, con pruebas de `K` y formatos. Validar formato no acredita identidad. D05 debe resolver menores, extranjeros/sin RUT y si es obligatorio en ingreso manual. No convertir un RUT en identificador público ni en contraseña.

## Privacidad

- Propuesta: cifrado autenticado de nombre, correo y RUT en D1; claves versionadas en Workers Secrets, fuera de la base. Si se requiere búsqueda, justificarla y usar HMAC con clave separada, no hash simple del RUT.
- Datos personales solo en cuerpos HTTPS autorizados. No incluirlos en query strings, analítica, logs, payloads de Queue, títulos/descripciones de Calendar ni almacenamiento web persistente. El correo del invitado sí se envía a Google de forma necesaria y declarada.
- No capturar diagnóstico, síntomas ni ficha clínica en el MVP.
- Perfil editable no equivale al nombre/correo verificado de login; explicar la diferencia en UI.
- Cifrado en reposo del proveedor no sustituye controles por usuario, minimización, política de privacidad y gestión de claves.
- Política pública debe explicar Google, Cloudflare y eventual proveedor de correo, finalidad, datos de terceros, retención y canal de derechos. Revisión jurídica a cargo del usuario; no afirmar cumplimiento legal automático.
- D06 bloquea producción hasta decidir retención, eliminación/anonimización, backups y auditoría. No retener indefinidamente por defecto.

## Aceptación

- DATA-01: un usuario no puede leer/editar perfiles ni operaciones de otro mediante IDs manipulados.
- DATA-02: editar perfil no modifica reservas anteriores ni el rol de la cuenta.
- DATA-03: validaciones RUT/formato/email se aplican en servidor; límites de longitud y SQL parametrizado.
- DATA-04: exportación de logs y cachés de prueba no contiene datos personales, cookies ni tokens.
- DATA-05: se restaura un backup de prueba con sus claves y se ejecuta una política de retención ensayada, una vez aprobada.

## Plan del módulo

1. Resolver política de perfil, campos y retención (U05/U06).
2. Crear migraciones locales, índices y restricciones; semilla ficticia sin correos autorizados de ejemplo.
3. Implementar repositorios con cifrado/versiones y tests de aislamiento.
4. Implementar perfil/snapshot, auditoría y operaciones; luego integrar motor S03.
5. Ensayar limpieza, restauración y revocación; revisión independiente antes de datos reales.
