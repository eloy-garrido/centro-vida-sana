# P09 — Tipos y contrato compartido

Spec canónico: [S09](../specs/09-contratos-api.md). Responsable: coordinador + backend-reservas; consumidores frontend/QA. Estado: preparado, no ejecutado.

Frontera: [seguridad](../seguridad-cloudflare.md), cuenta `21c858ed53ec9083b6fcd89d18c27372`, Worker `vida-sana-reservas-staging`, D1 `3d91d453-2ef5-4601-80cf-27622a0787bf`, binding `DB`. Solo archivos/tests locales. Nueva aprobación para cada mutación remota, IDs exactos y parar por discrepancia; no otros proyectos/DNS/permisos/producción/URLs públicas.

## Pasos

1. Revisar decisiones [D01–D09](../decisiones.md) que afectan payload/rangos. Parametrizar pendientes; no declararlos aprobados por tener un tipo.
2. Crear `src/shared/reservas/` con IDs, DTOs y códigos error S09; validadores servidor con límites y rechazo de campos extra. Frontend importa solo tipos/datos públicos, nunca secretos o repositorios.
3. Añadir mocks/fixtures locales que implementen exactamente los contratos, sin endpoints de bypass desplegables.
4. Implementar tests contractuales de forma/método/auth/CSRF/If-Match/idempotencia y endpoint resolve sin PII. Comprobar contenido/error/HTTP consistentes con spec.
5. Conectar router y servicios P01/P02/P03. Guardar resultado únicamente tras commit; replay autoriza de nuevo y no representa estado actual de la entidad.
6. Frontend P04/P05 usa las mismas formas; revisar que no aparezcan DTOs de `202`, Calendar, outbox o estado pendiente externo.
7. Revisar redacción/códigos finales con todos los consumidores antes de integrar E2E. Cambios actualizan spec/tipos/tests en la misma entrega.

## Salida y pruebas futuras

- API-01–05 y ejemplos de petición/respuesta válidos/erróneos por endpoint.
- Futuro `pnpm run test -- contracts` y `pnpm run check`, tras crear scripts; no ejecutados por este plan.
- Mocks pueden comenzar sin D01/D02/D03 cerradas, pero endpoints reales afectados no habilitados hasta decisión/aprobación.
- No añadir historia clínica, listado familiar, UI de membresías o API de Cloudflare accesible desde la aplicación.
