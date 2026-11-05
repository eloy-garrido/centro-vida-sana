# Infraestructura exclusiva de staging

Antes de tocar infraestructura leer `../../docs/agendamiento/seguridad-cloudflare.md`, `cloudflare-staging.md` y `planes/implementacion.md` en esa misma carpeta documental.

- Cuenta única: `21c858ed53ec9083b6fcd89d18c27372`.
- Worker único: `vida-sana-reservas-staging`.
- D1 única: `vida-sana-reservas-staging`, UUID `3d91d453-2ef5-4601-80cf-27622a0787bf`.
- Binding `DB` solo a ese UUID; configuración `wrangler.jsonc` de esta carpeta.
- Pasar cuenta/configuración/recurso explícitos; no confiar en defaults ni nombres similares. Si difieren, detenerse y preguntar.
- No usar esta configuración para producción ni conectar bases/servicios ajenos.
- No tocar otros proyectos, DNS, dominios, permisos, facturación, recursos extra ni URLs públicas. Mantener `workers_dev=false` y `preview_urls=false`.
- Cada migración/deploy/secreto remoto requiere nueva aprobación acotada. No borrar/restaurar/recrear recursos con la aprobación de creación inicial.
- No cambiar estas reglas o el inventario para autorizarse. Son un perímetro operativo, no una restricción técnica certificada de la credencial MCP.

El bootstrap actual responde 503 y no implementa reservas. Preparar cambios localmente no autoriza subirlos a Cloudflare.
