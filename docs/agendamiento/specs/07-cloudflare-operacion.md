# S07 — Plataforma mínima y staging seguro

Estado: arquitectura vigente propuesta; bootstrap ya creado, aplicación no desplegada. Responsable: coordinador + backend-reservas. Plan: [P07](../planes/07-cloudflare-operacion.md).

## Perímetro obligatorio

Aplican [seguridad-cloudflare.md](../seguridad-cloudflare.md) y el [inventario](../cloudflare-staging.md). Únicos destinos administrativos permitidos, sujetos a aprobación de cada mutación:

- Cuenta `21c858ed53ec9083b6fcd89d18c27372`.
- Worker `vida-sana-reservas-staging`.
- D1 `vida-sana-reservas-staging`, UUID `3d91d453-2ef5-4601-80cf-27622a0787bf`, binding `DB`.
- Configuración `infra/cloudflare-staging/wrangler.jsonc`.

IDs explícitos, sin cuentas por defecto, listados globales ni otros proyectos. Discrepancia = detenerse. La aprobación de crear estos recursos terminó. DNS, dominios, permisos, facturación, recursos extra, producción y exposición pública no están autorizados. El MCP no está certificado como limitado por IAM a esta allowlist.

## Arquitectura propuesta

Mantener **Astro estático + Tailwind** para páginas públicas y shells UI sin datos personales. Un Worker pequeño atiende `/auth/*` y `/api/*`, controla acceso a `/agenda` y sirve assets generados por Astro mediante Workers Static Assets. D1 es única fuente de sesión, roles y agenda.

Esto evita exigir SSR/adaptador Astro para el MVP. Validar compatibilidad mediante spike local antes de fijar archivos; si no funciona, proponer cambio, no instalar otro framework automáticamente. No Durable Objects, KV, Queues, Cron ni servicios de correo como dependencias iniciales.

Binding de assets propuesto `ASSETS` en **el mismo Worker**, no servicio de otro proyecto. Incorporarlo al remoto será un cambio de bindings expresamente incluido en el lote a aprobar; el inventario remoto actual solo contiene `DB`.

Router Worker-first para API/auth y todas las variantes del panel (`/agenda`, slash, HTML/index y rutas auxiliares). No permitir bypass de autorización por servir un asset antes del middleware. El shell prerenderizado no contiene datos, pero la ruta y cada API administrativa exigen rol. Métodos desconocidos y rutas API no se convierten en fallback HTML.

## Archivos propuestos y configuración

- `src/worker/index.ts`: router, middleware y fetch de assets públicos.
- `src/server/`: auth, datos, motor, validación, exportación.
- `src/pages/reservar.astro`, `src/pages/agenda.astro`: shells ligeros; datos privados por API.
- `migrations/`: SQL versionado, solo local hasta aprobación.
- Conservar `infra/cloudflare-staging/worker.js` como bootstrap hasta sustituirlo mediante diff aprobado; configurar `main` y assets en la misma carpeta sin cambiar IDs.

Proponer Node/gestor único y lockfile coherente antes de dependencias. No tocar componentes previamente modificados por el usuario sin coordinar integración de CTA.

Variables servidor: `APP_ENV`, `APP_ORIGIN`, `GOOGLE_LOGIN_CLIENT_ID`, `CLINIC_TIME_ZONE=America/Santiago`. Secrets: `GOOGLE_LOGIN_CLIENT_SECRET`, `PII_ENCRYPTION_KEY`, `COMMAND_HMAC_KEY`. Otros secretos solo si el diseño los requiere y se documentan. No `PUBLIC_*` para identidad sensible, roles o keys. Miembros iniciales provisionados de forma controlada, sin UI.

Local: `.dev.vars` ignorado y ejemplo sin valores reales. Sin binding remoto en modo dev, sin datos reales en fixtures y sin ruta de bypass auth desplegable. Staging usa exclusivamente IDs inventariados y callbacks D08/D09 aprobados.

## HTTP, exposición y operación

- APIs/HTML privados: `Cache-Control: private, no-store`, sin caché CDN/service worker y sin analítica sensible. `/reservar`, `/agenda` y exportación noindex; no incluirlas en sitemap.
- Preservar canonicals/SEO/assets/redirects/contactos públicos. Headers de `vercel.json` no se trasladan automáticamente: reproducir CSP y seguridad en Worker/asset config, sin relajar CSP global por conveniencia.
- URLs `workers.dev`/preview apagadas hasta D09. Si se solicita prueba HTTPS, aprobar tanto la URL como el mecanismo de protección y callbacks; no cambiar DNS de producción.
- Flag servidor propuesto `BOOKING_WRITES_ENABLED=false` hasta activar piloto aprobado; lectura del equipo sigue validando rol. No usarlo como sustituto de seguridad.
- Logs mínimos de IDs/códigos/latencia, sin cuerpos ni credenciales. Para diez atenciones semanales bastan métricas básicas, sin sistema adicional de observabilidad.
- Documentar recuperación nativa D1 (ventana real depende del plan) y rollback de código compatible con schema. No ejecutar restore/DROP ni sistema complejo de backup por este spec.

## Aceptación

- OPS-01: build Astro sirve páginas públicas y Worker APIs localmente con D1 local, sin despliegue ni llamadas administrativas remotas.
- OPS-02: cuenta/Worker/UUID/binding iguales al inventario; cualquier comando que intente otro destino falla en revisión/preflight antes de red.
- OPS-03: API/panel sin caché/bypass; rutas públicas y SEO sin regresión.
- OPS-04: cada cambio de staging tiene diff/SQL/secret names/destino/exposición y aprobación; URLs siguen apagadas si no fueron aprobadas.
- OPS-05: runbook mínimo y apagado de escrituras documentados; no claims de aislamiento IAM o backup verificado sin evidencia.

Dependencias: D08/D09 para pruebas reales; todas las decisiones pertinentes para piloto. Producción es un proyecto futuro con nuevos recursos y autorización separada.
