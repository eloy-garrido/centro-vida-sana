# P01 — Implementar identidad y permisos

Spec: [S01](../specs/01-identidad-permisos.md). Responsable: backend-reservas. Depende de P02/P07 base local, P09 y D03/D08. Estado: preparado para revisión, no ejecutado.

## Perímetro

Cumplir [seguridad](../seguridad-cloudflare.md) e [inventario](../cloudflare-staging.md). Cuenta `21c858ed53ec9083b6fcd89d18c27372`, Worker `vida-sana-reservas-staging`, D1 `3d91d453-2ef5-4601-80cf-27622a0787bf`, binding `DB`. Solo local en este plan; mutación remota exige aprobación acotada e IDs exactos. No otros proyectos/DNS/permisos/producción/URLs públicas; discrepancia = detenerse.

## Pasos

1. Fijar DTOs/errores S09 y configuración D08. Elegir biblioteca OIDC/WebCrypto compatible con Workers, sin otro framework de UI.
2. Crear `src/server/auth/` con intentos OAuth de un uso, PKCE, state/nonce, callback y comprobación completa de ID token. Tiempo/reloj/proveedor inyectables para tests locales.
3. Implementar repositorios de sesiones/membresías sobre esquema P02. Rotación, revocación, TTL y binding de sub a correo autorizado.
4. Añadir middleware `requireSession`, `requireTeam`, CSRF/Origin y retorno local seguro; endpoints session/logout/start/callback.
5. Probar con proveedor simulado y D1 local; test fixtures solo en harness local, sin bypass o credenciales ficticias desplegables.
6. Cuando D03/D08 estén resueltas, preparar prueba OAuth real local o en staging protegido. Registrar callbacks exactos; usuario completa consentimientos. Aprobar por separado secretos y cambios remotos.

## Entregables y verificación futura

- Archivos propuestos `src/server/auth/*`, `src/server/repositories/sessions.ts`, middleware router y tests AUTH-01–05.
- Runner/commands se crean en P07: futuro `pnpm run test -- auth` y type-check; no ejecutados por redactar este plan. Si el filtro no coincide con runner elegido, documentar comando real al implementarlo.
- Cierre: replay/state/nonce/aud/issuer inválidos, logout, cuenta paciente/equipo, revocación y CSRF verificados; revisión read-only de seguridad.
- Bloqueo: sin D03/D08 no habilitar accesos reales; mocks no se convierten en allowlist o secreto de staging.
