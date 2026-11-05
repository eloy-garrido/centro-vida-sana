# P06 — Enlace y descarga para calendario personal

Spec: [S06](../specs/06-copia-calendario.md). Responsable: backend-reservas + frontend-reservas. Dependencias: P01/P03/P09; integración UI P04/P05. Estado: propuesto, no ejecutado.

Leer [seguridad](../seguridad-cloudflare.md) e [inventario](../cloudflare-staging.md). Cuenta `21c858ed53ec9083b6fcd89d18c27372`, Worker `vida-sana-reservas-staging`, D1 `3d91d453-2ef5-4601-80cf-27622a0787bf`, binding `DB`. Plan local; aprobación explícita para cada cambio remoto, sin otros proyectos/DNS/permisos/producción/URLs públicas. Discrepancia = detenerse.

## Pasos

1. Definir DTO mínimo de copia desde reserva actual autorizada: profesional, título genérico, horario y dirección. No nombre/email/RUT del paciente ni tokens.
2. Implementar generador puro `src/server/calendar-copy/` para template URL Google y archivo ICS UTC conforme S06; sin SDK, token o API Calendar.
3. Añadir endpoint autenticado y no-store, opciones JSON o `format=ics`; rechazar canceladas y acceso ajeno. Derivar desde DB, no query de texto libre.
4. Integrar botón tras confirmación/detalle de equipo y aviso explícito de copia no sincronizada. Abrir externo solo tras clic, con noreferrer; no precargar.
5. Tests de autorización/cancelación, caracteres/CRLF y DST. Revisar que no hay PII en URL/file/telemetría.
6. Usuario comprueba manualmente guardado en su calendario con citas ficticias; agentes no crean/modifican eventos externos. El usuario puede descartar la copia sin afectar la reserva.

## Verificación futura

COPY-01–05 y tests API correspondientes; futuro `pnpm run test -- calendar-copy` y E2E del botón, comandos definitivos al configurar runner. Prueba manual Google/ICS se registra como tal, no como sincronización o garantía de deduplicación.

No se necesita proyecto Google para Calendar, consentimiento offline, correo padre ni envío de email. D08 solo afecta login previo. No nuevas credenciales/recursos Cloudflare para esta función.
