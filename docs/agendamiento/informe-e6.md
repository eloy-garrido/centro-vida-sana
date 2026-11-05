# Informe de Validación y Auditoría E6 — Agenda Propia D1

**Fecha de ejecución:** 2026-11-05  
**Entorno:** 100% Local (Node.js v22.19.0, Astro 5, SQLite `node:sqlite`)  
**Rama:** `feature/agendamiento`  
**Destino de staging:** Worker `vida-sana-reservas-staging` / D1 `3d91d453-2ef5-4601-80cf-27622a0787bf` (sin mutación remota ejecutada)

---

## 1. Resumen Ejecutivo

Todas las suites de prueba unitarias, transaccionales, de contratos API (S09) y de concurrencia e2e han sido ejecutadas exitosamente a nivel local con **39 tests pasando de 39 ejecutados (100% verde)** y compilación exitosa del frontend en `dist/` (10 páginas estáticas, 0 errores).

| Suite de Pruebas | Archivo | Casos | Estado |
|---|---|---|---|
| Contratos, RUT y DTOs | `tests/contracts/contracts.test.ts` | 9 | **PASS** |
| Esquema D1 y Triggers | `tests/database/schema.test.ts` | 7 | **PASS** |
| Autenticación, Sesiones y CSRF | `tests/auth/auth.test.ts` | 8 | **PASS** |
| Motor de Agenda y Políticas | `tests/agenda/agenda.test.ts` | 7 | **PASS** |
| Router Canónico S09 | `tests/api/router.test.ts` | 4 | **PASS** |
| Matriz E2E y Concurrencia | `tests/integration/e2e-matrix.test.ts` | 4 | **PASS** |
| **Total** | | **39** | **39 PASS (100%)** |

---

## 2. Cobertura de Criterios de Aceptación (S08)

### Grupo AUTH & DATA
- **QA-01 (OIDC de identidad):** Validación de ID Token contra Google OIDC, verificación de `sub`, `email_verified`, `iss`, `aud`, y rechazo de tokens expirados o sin firma.
- **QA-02 (Sesiones y CSRF):** Sesiones HttpOnly en D1 con expiración absoluta de 8 horas, revocación instantánea en logout y validación obligatoria de `X-CSRF-Token` derivado determinísticamente para toda mutación (`POST`, `PUT`, `PATCH`, `DELETE`).
- **QA-03 (Roles e IDOR):** Aislamiento estricto por actor: un paciente no puede leer ni resolver comandos de otro paciente. Las rutas `/api/team/*` retornan `403 Forbidden` cuando son consultadas por cuentas que no pertenecen a `team_members`.
- **QA-04 (Paciente tercero):** El titular de la cuenta Google puede registrar una reserva indicando nombre, correo, RUT y teléfono de otra persona sin comprometer su identidad.
- **QA-05 (Validación de Documento):** Módulo 11 canónico con dígito verificador `0-9` y `K`, soporte para pasaporte extranjero y rechazo de entradas malformadas (`422 Validation Error`).

### Grupo SLOT & CONCURRENCY
- **QA-06 / QA-07 (Fechas, Huso Horario y Jornada):** Conversión estricta a zona `America/Santiago`, manejo de DST, turnos exactos de 60 minutos, jornadas oficiales aprobadas en D01 (Lunes a Viernes 09:00 a 21:00 con colación 13:00-14:00; Sábados 09:00 a 14:00; Domingos cerrado). Ventana de reserva para pacientes: mañana (D+1) a D+7.
- **QA-08 (Carrera real de concurrencia):** 10 peticiones simultáneas sobre el mismo cupo de un profesional resultan en exactamente 1 reserva confirmada (`201 Created`) y 9 rechazos inmediatos por conflicto (`409 SLOT_CONFLICT`).
- **QA-09 (Agendas independientes):** Turnos en el mismo horario para Felipe Méndez y Eduardo Lagos coexisten y se confirman simultáneamente sin interferencia mutua.
- **QA-10 (Bloqueos de equipo):** Un bloqueo administrativo de 60 minutos compite con las citas y previene cualquier reserva de pacientes en ese intervalo.
- **QA-14 (Control de versiones If-Match):** Toda edición o cancelación por parte del equipo requiere la cabecera `If-Match` con la versión actual (ej. `"v1"`). Si falta, retorna `428 Precondition Required`; si la versión es obsoleta, retorna `412 Precondition Failed`.

### Grupo COPY & PRIVACIDAD
- **QA-16 (Copia a Calendario sin PII):** Las URLs de Google Calendar y archivos `.ics` generados contienen exclusivamente el título de la atención, profesional, horario y dirección clínica. **Cero RUT, cero correo y cero datos personales en el enlace externo.** Texto de advertencia visible: *«Se añadirá una copia. Si la hora cambia o se cancela, debes actualizar tu calendario personal.»*
- **QA-17 (Sin fuga de PII en errores ni almacenamiento):** Cero datos de pacientes en logs de auditoría, cero datos personales en URLs o en `sessionStorage`. Los errores de validación identifican el campo pero nunca hacen eco de los valores personales.

---

## 3. Estado de la Frontera de Seguridad

1. **Desarrollo 100% Local:** Ningún comando remoto de migración ni despliegue fue ejecutado. No se tocó la base remota D1 ni se expuso el Worker de staging.
2. **Workers.dev y previews:** Se mantienen deshabilitados (`workers_dev: false`, `preview_urls: false` en `infra/cloudflare-staging/wrangler.jsonc`).
3. **Noindex y No-Store:** Rutas `/reservar` y `/agenda` incluyen `<meta name="robots" content="noindex, nofollow" />`, cabeceras `Cache-Control: private, no-store` y `X-Robots-Tag: noindex, nofollow` en el router HTTP.
