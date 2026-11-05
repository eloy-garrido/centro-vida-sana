# P02 — Persistencia y datos mínimos

Spec: [S02](../specs/02-datos-privacidad.md). Responsable: backend-reservas. Depende de P07 base/P09; políticas D05/D06. Estado: propuesto, no ejecutado.

Frontera: [seguridad](../seguridad-cloudflare.md), [inventario](../cloudflare-staging.md). Cuenta `21c858ed53ec9083b6fcd89d18c27372`; Worker `vida-sana-reservas-staging`; D1 `3d91d453-2ef5-4601-80cf-27622a0787bf`, binding `DB`. Trabajar en D1 **local**; cada mutación remota exige aprobación. No otros proyectos/DNS/permisos/producción/URLs públicas ni recursos nuevos. IDs distintos = detenerse.

## Pasos

1. Definir `migrations/` con usuarios, intentos/sesiones, membresías, profesionales, perfil, `agenda_entries`, recibos de comandos y auditoría. No Calendar/outbox/ocupación duplicada.
2. Preparar fixtures ficticios reproducibles, sin correos reales autorizados ni copia de datos remotos. Separar configuración operacional de textos comerciales.
3. Implementar repositorios parametrizados en `src/server/repositories/`, cifrado autenticado versionado en `src/server/security/` y validación de paciente/RUT.
4. Añadir perfil por dueño y snapshot inmutable por reserva. Perfil existente con control de versión; no búsqueda global por RUT.
5. Integrar constraints/triggers de P03. Probar foreign keys, rollback batch y límites de texto/cifrado con D1 local.
6. Documentar retención/limpieza según D06, incluyendo recibos/tombstones que impidan duplicar solicitudes antiguas. Sin plazo aprobado no programar borrado automático.
7. Preparar SQL y revisión de migración; presentar diff y destino al usuario antes de cualquier aplicación remota. Sin `DROP`/reset/recreación como solución automática.

## Cierre y pruebas futuras

- Tests DATA-01–05 de aislamiento/snapshot/validación/cifrado, plus pruebas SQL de P03 sobre runtime local.
- Futuro script `pnpm run db:migrate:local` debe fijar configuración staging y `--local`; su creación no implica ejecutarlo remoto.
- Futuro `pnpm run test -- data`, type-check y revisión de queries. Documentar comandos efectivos tras configurar runner, no resultados inventados.
- Entregar migraciones, diagrama lógico, límites y reporte de tests; backup mínimo solo documentación/revisión nativa, no restores remotos.
- D05/D06 bloquean datos reales, no fixtures locales. Cambiar schema con pérdida de datos requiere aprobación específica aparte.
