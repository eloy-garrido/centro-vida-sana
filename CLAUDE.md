# CLAUDE.md

La guía compartida y actualizada para agentes está en [`AGENTS.md`](./AGENTS.md). Léela antes de modificar el proyecto.

Puntos críticos:

- El sitio activo usa **Astro 5 + Tailwind CSS 3**, con fuentes en `src/`; no la versión estática heredada de la raíz.
- Ejecuta `npm run build` como verificación mínima del frontend.
- El alcance del futuro agendamiento está en `docs/agendamiento/contexto.md`.
- Antes de acceder a Cloudflare lee `docs/agendamiento/seguridad-cloudflare.md` y `cloudflare-staging.md`. Única cuenta `21c858ed53ec9083b6fcd89d18c27372`, Worker `vida-sana-reservas-staging`, D1 `3d91d453-2ef5-4601-80cf-27622a0787bf`, binding `DB`; IDs explícitos y aprobación acotada antes de cualquier mutación. No otros proyectos, DNS, permisos, producción ni URLs públicas. Ante discrepancia, detenerse.
- Plan vigente: `docs/agendamiento/planes/implementacion.md`. Specs históricos de Google Calendar no ejecutables: agenda propia D1, Google solo login, sin correos. La frontera es operativa, no una garantía de aislamiento IAM del MCP.
- Los agentes especializados de OpenCode están en `.opencode/agents/`.
- Conserva los cambios existentes del usuario y no realices mutaciones Git, despliegues o migraciones remotas sin autorización explícita.
