# Histórico S01 — Identidad del diseño con Calendar, no ejecutar

> **HISTÓRICO — NO EJECUTAR su plan.** Requiere adaptación al alcance propio D1, Google solo login y sin Calendar/correos. Mandan `../contexto.md`, `../seguridad-cloudflare.md`, `../cloudflare-staging.md` y `../planes/implementacion.md`. Ningún recurso, permiso, dominio o despliegue descrito aquí queda autorizado.

Estado: especificación propuesta sobre requisitos confirmados. Depende de preparación Google y S07. Responsable: backend-reservas.

## Alcance confirmado

- Pacientes, profesionales y administrador acceden con Google OAuth/OIDC.
- La cuenta clínica `centrovida.sanaaustral@gmail.com` posee ambos calendarios; no es la cuenta de login obligatorio de los profesionales.
- Cada miembro autorizado del equipo puede operar **ambas** agendas. Pacientes no acceden al panel.
- Los correos ilustrativos de Felipe/Eduardo no son autorizaciones reales.

## Diseño propuesto

Dos integraciones separadas, con clientes OAuth distintos:

1. **Identidad del sitio:** scopes `openid email profile`; sin Calendar ni refresh tokens de pacientes.
2. **Conexión Calendar de la clínica:** consentimiento offline exclusivo de la cuenta central, según S06. Una membresía de equipo no autoriza a reemplazar esa conexión.

Flujo servidor Authorization Code + PKCE S256 y `state`/`nonce` aleatorios de un solo uso, vinculados al navegador, con expiración propuesta de diez minutos. Validar firma con JWKS, emisor Google permitido, audiencia del cliente esperado, expiración, `nonce`, `sub` y `email_verified`. No confiar en nombre/email enviados por el cliente ni en `login_hint` como prueba de identidad.

Crear/rotar sesión después de OAuth. Cookie opaca `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, sin `Domain`; prefijo `__Host-` en HTTPS. Guardar hash del identificador en D1, no el secreto de sesión en claro. Propuesta: ocho horas de duración absoluta; configurable y pendiente de validación operativa. Adaptación explícita de cookies para localhost, nunca degradar producción.

Logout por POST con CSRF, revocación inmediata en D1 y eliminación de cookie. Revocar la conexión Calendar no es lo mismo que cerrar una sesión del sitio.

## Autorización

Membresía inicial provisionada por configuración/migración controlada, no por un formulario público. Vincular correo verificado autorizado al `sub` en primer acceso y comprobar membresía activa en cada petición del equipo. No usar coincidencias parciales de correo ni confiar en un dominio completo.

| Actor | Perfil paciente propio | Disponibilidad | Crear reserva paciente | CRUD ambas agendas | Conectar Calendar central |
|---|---|---|---|---|---|
| Anónimo | No | No, propuesta MVP | No | No | No |
| Paciente autenticado | Sí | Sí | Sí | No | No |
| Miembro autorizado | Sí, si usa flujo paciente | Sí | Sí | Sí | No por pertenencia al equipo |
| Operador de conexión clínica | No adicional | No adicional | No adicional | Solo si también es miembro | Solo mediante procedimiento protegido y cuenta central verificada |

Identidad de quien actúa y profesional atendiente son campos distintos. Pestañas solo seleccionan una de las dos agendas permitidas; el backend obtiene sus IDs reales.

## Superficie HTTP y errores

S09 define `/auth/google/start`, `/auth/google/callback`, `/api/session` y `/api/logout`. Retorno posterior a OAuth limitado a rutas locales permitidas, sin open redirect. Callback sin analítica ni recursos de terceros; redirigir inmediatamente a una URL sin código OAuth. Suprimir query/body/headers sensibles de logs.

Mutaciones autenticadas requieren CSRF ligado a sesión, validación de `Origin`, contenido JSON permitido y CORS same-origin. Fallos: `401` sesión inexistente/expirada; `403` sin membresía o CSRF inválido. No revelar allowlist en mensajes.

## Aceptación

- AUTH-01: una cuenta Google normal llega a datos del paciente; un miembro activo llega al panel con ambas pestañas.
- AUTH-02: pacientes y usuarios revocados reciben `403` en cada endpoint de equipo, aunque fabriquen peticiones.
- AUTH-03: `state`, `nonce`, audiencia, firma o código repetido inválidos no crean sesión.
- AUTH-04: cambiar nombre/email del paciente no modifica identidad, rol ni autorización.
- AUTH-05: logout invalida el identificador anterior; retirar membresía tiene efecto sin esperar nueva autenticación.
- AUTH-06: ninguna respuesta al navegador contiene secretos o tokens Google; cookies y callbacks se inspeccionan en staging.

## Plan del módulo

1. Aprobar TTL, lista real de miembros y callbacks (D03, tareas U03/G03).
2. Implementar almacenamiento de intentos OAuth, sesiones y membresías S02.
3. Implementar flujo y middleware; probar errores con proveedor simulado.
4. Probar cuentas reales de prueba, revocación y CSRF; revisión de seguridad antes de conectar UI.
