# P07 — Base local y staging con control de cambios

Spec: [S07](../specs/07-cloudflare-operacion.md). Responsable: coordinador + backend-reservas. Estado: plan preparado, no ejecutado. La creación bootstrap ya está terminada.

## Allowlist no ampliable por el agente

Leer [seguridad](../seguridad-cloudflare.md) e [inventario](../cloudflare-staging.md). Cuenta `21c858ed53ec9083b6fcd89d18c27372`; Worker `vida-sana-reservas-staging`; D1 UUID `3d91d453-2ef5-4601-80cf-27622a0787bf`, binding `DB`. IDs explícitos; discrepancia = detenerse. No otros proyectos/cuentas, DNS, dominios, permisos, facturación, producción, recursos extra ni URLs públicas sin aprobación específica. Esto no es aislamiento IAM certificado del MCP.

## Parte A — Local primero

1. Estandarizar pnpm (propuesto por lockfile/Vercel actual) y versión Node compatible; inspeccionar lockfiles antes de cambiar. Conservar modificaciones previas del usuario.
2. Revisar dependencias/runtime y aprobar adiciones mínimas de Wrangler/tipos/runner. No actualizar Astro/Tailwind masivamente.
3. Crear spike Worker + Static Assets sobre build Astro estático y `ASSETS` local: router `/auth/*`/`/api/*`, guardas `/agenda` y variantes de asset, sin fallback de HTML en API.
4. Mantener nombres/IDs remotos en config staging; dev usa D1 local, sin `--remote` ni remote bindings. Cambiar `main`/assets se prepara en diff, no se despliega.
5. Definir scripts futuros locales: `build`, `check`, `test` (alias de unitarias), `test:unit`, `test:integration:local`, `test:e2e:local`, `test:artifact`, `db:migrate:local`, `dev:worker`. Usar pnpm si se ratifica gestor; documentar comandos reales y entorno al implementarlos.
6. Preparar ejemplos de secretos con valores vacíos/ficticios y exclusiones `.dev.vars*`/`.env*`; sin token ni credencial en repositorio.
7. Añadir preflight local de comandos/destino: rechazar config/IDs distintos y switches remotos en scripts de prueba. Es defensa adicional, no permiso de red.

## Parte B — Propuesta de staging, bloqueada por D09

8. Presentar lote: SQL exacto, diff Worker, cambios de bindings (incluido `ASSETS` del mismo Worker), nombres de secrets, flags, cuenta/UUID y verificaciones. Obtener aprobación del lote o de cada acción.
9. Tras aprobación y lectura del recurso exacto, aplicar solo ese lote. Si bindings/IDs divergen o hay error, detenerse; no reset/recreación ni ampliar permisos/cuenta/plan.
10. Mantener `workers.dev`/previews apagados salvo autorización específica que defina URL, protección y callbacks. Publicación HTTPS no se deduce de aprobar el deploy.
11. Verificar por recurso exacto, sin listar globalmente ni explorar logs/datos ajenos. Registrar qué cambió, autorización y resultados.

## Parte C — Operación mínima

12. Documentar pausa servidor de nuevas escrituras, errores y rollback de código/schema compatible.
13. Revisar recuperación nativa D1 y límites del plan, sin restaurar DB remota por este plan. No sistema de backups complejo.
14. Piloto solo con fixtures/cuentas de prueba y política D06 antes de datos reales. Producción/DNS requieren solicitud independiente y recursos futuros, no convertir staging.

## Cierre

OPS-01–05 + smoke local + privacidad/caché/CSP/SEO. Evidencia separa scripts preparados, tests locales, cambios remotos aprobados y pruebas no hechas. No abrir fases remotas por redactar o aprobar estos documentos.
