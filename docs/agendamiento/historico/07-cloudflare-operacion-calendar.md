# Histórico S07 — Plataforma del diseño con Calendar, no ejecutar

> **HISTÓRICO — NO EJECUTAR su plan.** Requiere adaptación al alcance propio D1, Google solo login y sin Calendar/correos. Mandan `../contexto.md`, `../seguridad-cloudflare.md`, `../cloudflare-staging.md` y `../planes/implementacion.md`. Ningún recurso, permiso, dominio o despliegue descrito aquí queda autorizado; no ejecutar su migración de DNS/producción ni crear recursos adicionales.

Estado: propuesta técnica, sin recursos remotos creados. Responsables: coordinador y backend-reservas. Usuario aprueba cuentas, costes, dominio y despliegues.

## Plataforma

Conservar Astro, páginas públicas prerenderizadas y JS ligero. Propuesta: Workers con Static Assets + adaptador Cloudflare compatible; no forzar actualización masiva de Astro/Tailwind. Probar compatibilidad del runtime/librerías OAuth/cifrado y del entrypoint para Durable Objects y tareas programadas antes de fijar arquitectura.

Si el adaptador no permite integrar limpiamente DO/Cron, separar Worker de API/servicios con bindings y mantener API same-origin mediante rutas. Registrar la decisión antes de implementar; no introducir dos arquitecturas a la vez.

Persistencia D1, DO por profesional, Cron para outbox/reconciliación; Queues opcional según coste/garantías. KV no guarda autoridad de sesiones, roles, reservas o bloqueos. Revisar plan, límites y facturación de Cloudflare; Gmail gratuito no implica infraestructura gratuita.

## Entornos

| Entorno | Datos y calendarios | Secretos | Dominio |
|---|---|---|---|
| Local | D1/DO local, Google simulado por defecto | Archivo privado excluido de Git | localhost puerto fijo propuesto 4321 |
| Staging | D1/DO propios, dos calendarios de prueba | OAuth/remitente de prueba | Host HTTPS estable por aprobar D10 |
| Producción | D1/DO propios, calendarios clínicos | Credenciales y claves exclusivas | centrovidasana.cl |

No copiar pacientes reales a staging ni registrar callbacks OAuth para cada preview efímero. No usar calendarios reales en tests E2E automáticos.

## Configuración propuesta

Nombres exactos se ratifican antes de G03; valores secretos nunca en docs:

- Públicos/configuración servidor: `APP_ORIGIN`, `APP_ENV`, `CLINIC_TIME_ZONE=America/Santiago`, `CALENDAR_OWNER_EMAIL`, IDs privados `GOOGLE_CALENDAR_FELIPE_ID` / `GOOGLE_CALENDAR_EDUARDO_ID`, `GOOGLE_LOGIN_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_ID`.
- Secrets: `GOOGLE_LOGIN_CLIENT_SECRET`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `PII_ENCRYPTION_KEY`, `TOKEN_ENCRYPTION_KEY`; refresh token cifrado según S06; `MAIL_API_KEY` solo si proveedor elegido. Claves de webhook/CSRF según implementación revisada, no sumar secretos sin necesidad.
- Bindings propuestos: `DB`, `AGENDA_COORDINATOR`; añadir binding de Queue solo si se decide utilizarla.
- Miembros iniciales y correos destinatarios se provisionan fuera del bundle público; sin direcciones de ejemplo habilitadas.

Entregar `.dev.vars.example` sin valores reales y exclusiones de Git para `.dev.vars*`/`.env*` con excepciones de ejemplos. No almacenar credenciales descargadas de Google en `public/` o repositorio. Versionar claves y ensayar rotación/restauración.

## Migración del sitio

1. Estandarizar gestor de paquetes y Node con lockfile coherente, sin borrar archivos desconocidos.
2. Build del sitio público con mismo contenido/rutas/recursos; no tocar cambios previos del usuario.
3. Trasladar headers, redirects, CSP, caché y protección de Vercel a Cloudflare; `vercel.json` no se aplica solo.
4. APIs y páginas privadas: `Cache-Control: private, no-store`, bypass de caché CDN, sin analítica de datos personales; OAuth callbacks sin scripts externos. `noindex` no es control de acceso.
5. Mantener indexación/canonicals/sitemap de páginas públicas, imágenes, tel/WhatsApp y redirecciones existentes.
6. Staging y aprobación previa a dominio/DNS; revisar DNS/MX para no romper correo al cambiar nameservers. No cambiar dominio de producción durante prototipo.

## Operación y recuperación

- Métricas sin datos personales: fallos Calendar, colas pendientes por edad, conflictos, latencia y auth fallida agregada. Alertas a operador por canal aprobado D08/D10.
- Feature flag servidor para desactivar nuevas reservas sin borrar ocupación; mantener acceso del equipo a incidencias según estado seguro y fallback WhatsApp.
- Runbooks: reconexión Calendar, operación incierta, conflicto externo, rotación de secretos, pérdida de clave, restauración D1 y reconciliación posterior. Restaurar DB antigua no debe duplicar eventos Google ni notificaciones.
- Backup y retención aprobados D06; prueba de restauración aislada antes de producción. Nunca ejecutar migración remota sin aprobación por entorno.
- Rollback no consiste en restaurar un HTML y olvidar reservas: separar rollback de código, schema y DNS, mantener compatibilidad/máquina de estados y pausar mutaciones si es necesario.

## Aceptación y plan

- OPS-01: local/staging/producción tienen bindings, calendarios y secretos aislados.
- OPS-02: rutas públicas conservadas; APIs no cacheadas; CSP y cookies inspeccionadas en HTTPS real.
- OPS-03: backup/restore de prueba, reconexión y pausa de reservas ensayados.
- OPS-04: presupuestos/límites, operador y procedimiento de rollback aprobados.

Plan: prueba adaptador/runtime → configuración local reproducible → provisión staging aprobada → migraciones locales/staging → headers y smoke test → runbooks y backup → autorización explícita de producción/DNS → piloto con monitorización.

Referencias: [Astro Cloudflare](https://docs.astro.build/en/guides/deploy/cloudflare/), [Static Assets](https://developers.cloudflare.com/workers/static-assets/), [D1](https://developers.cloudflare.com/d1/), [Durable Objects](https://developers.cloudflare.com/durable-objects/).
