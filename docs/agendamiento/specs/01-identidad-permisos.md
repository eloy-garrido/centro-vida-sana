# S01 — Identidad Google, sesiones y acceso compartido

Estado: especificación vigente propuesta para revisión; implementación y operaciones remotas no autorizadas por este documento. Responsable: backend-reservas. Plan: [P01](../planes/01-identidad-permisos.md).

Lectura obligatoria: [contexto](../contexto.md), [seguridad](../seguridad-cloudflare.md), [inventario](../cloudflare-staging.md), [decisiones](../decisiones.md). Solo recursos de staging inventariados, con IDs explícitos y nueva aprobación para cada mutación remota; detenerse ante discrepancia. Otros proyectos, DNS, permisos y producción quedan fuera.

## Alcance

Google identifica pacientes y equipo, nada más. Scopes exclusivos `openid email profile`, sin API Calendar, service account, OAuth offline clínico ni correo. Se usa `sub` como identidad; nombre/correo/RUT editables de la persona atendida no modifican el login.

Flujo servidor Authorization Code con PKCE S256, `state` y `nonce` aleatorios, ligados al navegador, con expiración propuesta diez minutos y consumo único. Validar firma/JWKS, issuer admitido, audiencia exacta, expiración, nonce, `sub` y `email_verified`. Intercambiar código en backend; nunca entregar tokens Google a JavaScript.

Tras login consultar membresía activa: paciente → `/reservar`; equipo → `/agenda`. Admin, Felipe y Eduardo comparten las mismas capacidades operativas sobre `felipe` y `eduardo`. No existe selector público de rol ni administración de miembros por UI. D03 y D08 requieren confirmación; los correos del catálogo no son automáticamente allowlist.

## Sesión y permisos

Cookie opaca con hash en D1, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, sin `Domain`; prefijo `__Host-` en HTTPS. Rotar después de OAuth; duración absoluta propuesta ocho horas según D08. Localhost admite adaptación explícita solo local. Logout POST con CSRF revoca sesión inmediatamente.

| Actor | Perfil propio / reservar | Ver detalle/copia de reserva | CRUD ambas agendas |
|---|---|---|---|
| Anónimo | No | No | No |
| Paciente | Sí | Solo creada por su cuenta | No |
| Miembro activo | Sí | Reservas de ambas agendas | Sí |
| Miembro revocado | Solo permisos de paciente si conserva sesión válida | Solo reservas que creó como reservante | No |

Revalidar membresía en cada petición de equipo. Primer acceso de un correo verificado autorizado vincula su `sub` de forma atómica; no migrar privilegios a otra identidad automáticamente. Entradas por ID comprueban pertenencia o membresía, no confianza en un ID opaco.

## Seguridad y errores

Retorno OAuth limitado a rutas locales permitidas, nunca URL externa. Callback sin analítica/recursos de terceros; redirección inmediata que quite código/state del navegador. No registrar query, Authorization, cookies ni bodies sensibles.

Mutaciones usan CSRF ligado a sesión, validación Origin, JSON y CORS same-origin. Límites de intentos y errores seguros. `401` sesión ausente; `403` permiso/CSRF; códigos no revelan allowlist. `no-store` para sesión/API privada. No exponer secretos en variables `PUBLIC_*`.

## Aceptación

- AUTH-01: paciente y equipo llegan al destino correcto; equipo opera ambas agendas, paciente no accede a endpoints administrativos.
- AUTH-02: firma/audiencia/issuer/nonce/state incorrectos, intento expirado o replay no crean sesión.
- AUTH-03: logout/revocación y rotación funcionan; editar datos del paciente no cambia rol/identidad.
- AUTH-04: miembro revocado pierde acceso administrativo sin nuevo login; IDs de otra cuenta no filtran reservas/perfil.
- AUTH-05: cookies/callbacks verificados; ningún token Google llega al frontend, logs o exportación de calendario.

Fuera de alcance: acceso a agendas externas, contraseñas propias, gestión de IAM de Cloudflare, autorización de recursos Google para citas. Dependencias: S02, S07, S09 y decisiones D03/D08.
