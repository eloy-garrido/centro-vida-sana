# Registro y Verificación Manual de Asistencia de Pacientes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar en el sistema de agendamiento y en el panel del equipo (`/agenda`) el registro y verificación manual de asistencia de pacientes (`pending`, `attended`, `no_show`), permitiendo a los profesionales marcar con un clic si el paciente efectivamente asistió o no, eliminando ambigüedades por reagendamientos o inasistencias en el conteo histórico de atenciones.

**Architecture:** 
1. **D1 Schema & Migraciones:** Añadir las columnas `attendance_status` (`'pending'`, `'attended'`, `'no_show'`), `attendance_updated_at` y `attendance_updated_by` en la tabla `agenda_entries` mediante una nueva migración `migrations/0002_attendance_tracking.sql`, manteniendo intactos los triggers de solapamiento de horarios basados en `status = 'confirmed'`.
2. **Dominio & Backend (`src/server/agenda/*`):** Incorporar la función de comando `executeRecordAttendanceCommand` en `src/server/agenda/team.ts`, actualizar `getTeamSchedule` y `getBookingDetails` para exponer el estado de asistencia, y registrar eventos en `audit_events`.
3. **API & Router (`src/server/router.ts` & `src/lib/agendamiento/*`):** Exponer el endpoint protegido para miembros del equipo `POST /api/team/bookings/:id/attendance`, agregar validaciones de CSRF y autorización de equipo, y extender `AgendamientoClient.updateAttendance`.
4. **UI Panel de Agenda (`src/pages/agenda.astro`):** Sustituir el badge estático inferido por fecha por insignias reactivas basadas en `attendanceStatus` (`Asistió`, `No asistió`, `Pendiente`) con botones de acción rápida de un toque («✓ Asistió», «✕ No asistió», «Deshacer») tanto para citas del día de hoy como pasadas.

**Tech Stack:** TypeScript, Astro 5, Cloudflare Workers + D1 (SQLite en testing local con `node:sqlite`), Node 22 (`node:test`).

**Spec & Context:** `docs/agendamiento/contexto.md`, `docs/agendamiento/specs/02-datos-privacidad.md`, `docs/agendamiento/specs/05-panel-equipo.md`, `docs/agendamiento/specs/09-contratos-api.md`.

## Global Constraints

- Exclusividad de autorización: Solo miembros activos de `team_members` (`admin` o `professional`) pueden marcar o modificar la asistencia. Los pacientes no tienen acceso a estos controles ni a la mutación.
- Integridad transaccional: No se permite registrar asistencia sobre citas canceladas (`status = 'cancelled'`); retorna `409 BOOKING_CANCELLED`.
- Compatibilidad hacia atrás: Citas existentes sin valor explícito deben tratarse canónicamente como `'pending'`.
- Restricciones de privacidad: Toda mutación de asistencia se audita en `audit_events` registrando el `actor_id`, `booking_id` y timestamp, sin eco de PII en logs.
- Verificación local: Pruebas automatizadas con `npm test` y build de Astro con `npm run build`. Cero mutaciones remotas sin autorización explícita.

---

### Task 1: D1 Migration y Tipos TypeScript para Asistencia

**Files:**
- Create: `migrations/0002_attendance_tracking.sql`
- Modify: `src/lib/agendamiento/types.ts`
- Modify: `tests/database/schema.test.ts`

**Interfaces:**
- `AttendanceStatus = 'pending' | 'attended' | 'no_show'`
- `TeamScheduleEntry.attendanceStatus?: AttendanceStatus`
- `BookingDetail.attendanceStatus?: AttendanceStatus`
- `BookingDetail.attendanceUpdatedAt?: string`
- `UpdateAttendanceRequest = { attendanceStatus: AttendanceStatus }`

- [x] **Step 1: Crear la migración `migrations/0002_attendance_tracking.sql`**

Crear el archivo SQL con:
```sql
-- Centro Vida Sana Austral — Migración 0002: Verificación de Asistencia de Pacientes
ALTER TABLE agenda_entries ADD COLUMN attendance_status TEXT NOT NULL DEFAULT 'pending' CHECK (attendance_status IN ('pending', 'attended', 'no_show'));
ALTER TABLE agenda_entries ADD COLUMN attendance_updated_at INTEGER NULL;
ALTER TABLE agenda_entries ADD COLUMN attendance_updated_by TEXT NULL REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_agenda_entries_attendance
  ON agenda_entries (attendance_status, professional_id, start_at);
```

- [x] **Step 2: Actualizar `src/lib/agendamiento/types.ts`**

Añadir el tipo `AttendanceStatus`:
```typescript
export type AttendanceStatus = 'pending' | 'attended' | 'no_show';
```
Agregar `attendanceStatus?: AttendanceStatus` en `TeamScheduleEntry`, `BookingDetail` y definir `UpdateAttendanceRequest`.

- [x] **Step 3: Actualizar helper de base de datos en pruebas y escribir test de esquema en `tests/database/schema.test.ts`**

Asegurar que `createTestDatabase` aplique `0001_initial_schema.sql` y `0002_attendance_tracking.sql`, y añadir test:
- Verificar que las columnas `attendance_status`, `attendance_updated_at` y `attendance_updated_by` existan.
- Verificar que una inserción sin `attendance_status` tome el valor por defecto `'pending'`.
- Verificar que valores fuera de `pending`, `attended`, `no_show` arrojen error de restricción `CHECK`.

- [x] **Step 4: Ejecutar pruebas de esquema**

Run: `node --test --experimental-strip-types tests/database/schema.test.ts`
Expected: PASS.

---

### Task 2: Comando Backend y Lógica de Asistencia en `src/server/agenda/*`

**Files:**
- Modify: `src/server/agenda/team.ts`
- Modify: `src/server/agenda/details.ts`
- Test: `tests/agenda/agenda.test.ts`

**Interfaces:**
- Produces: `executeRecordAttendanceCommand(db: DatabaseAdapter, actor: { id: string }, bookingId: string, attendanceStatus: AttendanceStatus, nowSeconds?: number): Promise<{ ok: boolean; bookingId: string; attendanceStatus: AttendanceStatus; attendanceUpdatedAt: string }>` en `src/server/agenda/team.ts`
- `getTeamSchedule` mapea y retorna `attendanceStatus` para cada entrada tipo `'appointment'`.
- `getBookingDetails` retorna `attendanceStatus` y `attendanceUpdatedAt`.

- [x] **Step 1: Escribir pruebas unitarias en `tests/agenda/agenda.test.ts`**

Añadir subtests que verifiquen:
1. `executeRecordAttendanceCommand` actualiza una cita existente de `pending` a `attended` y registra en `audit_events`.
2. `executeRecordAttendanceCommand` permite cambiar de `attended` a `no_show` o de regreso a `pending`.
3. `executeRecordAttendanceCommand` con una cita cancelada arroja `409 BOOKING_CANCELLED`.
4. `executeRecordAttendanceCommand` con un estado inválido arroja `400 VALIDATION_ERROR`.
5. `executeRecordAttendanceCommand` con una cita inexistente arroja `404 NOT_FOUND`.
6. `getTeamSchedule` devuelve `attendanceStatus` con el valor actualizado.

- [x] **Step 2: Ejecutar pruebas para verificar que fallen**

Run: `node --test --experimental-strip-types tests/agenda/agenda.test.ts`
Expected: FAIL en los nuevos tests de comando de asistencia.

- [x] **Step 3: Implementar `executeRecordAttendanceCommand` y actualizar consultas en `src/server/agenda/team.ts` y `src/server/agenda/details.ts`**

- En `src/server/agenda/team.ts`:
  - Implementar la función validando el status, buscando la cita en `agenda_entries`, asegurando que `kind === 'appointment'` y no esté `cancelled`.
  - Ejecutar `db.batch` actualizando `attendance_status`, `attendance_updated_at = nowSeconds`, `attendance_updated_by = actor.id`, `updated_at = nowSeconds` e insertando evento en `audit_events` (`action: 'record_attendance'`).
  - Actualizar `getTeamSchedule` para incluir `attendance_status` en el `SELECT` y mapearlo a `attendanceStatus`.
- En `src/server/agenda/details.ts`:
  - Incluir `attendance_status` y `attendance_updated_at` en el `SELECT` de `getBookingDetails` y retornarlos en `booking`.

- [x] **Step 4: Ejecutar pruebas unitarias de agenda**

Run: `node --test --experimental-strip-types tests/agenda/agenda.test.ts`
Expected: PASS en todos los subtests.

---

### Task 3: Enrutador API, Cliente HTTP y Pruebas de Integración API

**Files:**
- Modify: `src/server/router.ts`
- Modify: `src/lib/agendamiento/client.ts`
- Test: `tests/api/router.test.ts`

**Interfaces:**
- Route: `POST /api/team/bookings/:id/attendance`
- Body: `{ attendanceStatus: 'pending' | 'attended' | 'no_show' }`
- Client: `AgendamientoClient.updateAttendance(bookingId: string, attendanceStatus: AttendanceStatus, csrfToken: string)`

- [x] **Step 1: Escribir pruebas de API en `tests/api/router.test.ts`**

Añadir pruebas que verifiquen:
1. `POST /api/team/bookings/:id/attendance` sin sesión retorna `401 UNAUTHORIZED`.
2. `POST /api/team/bookings/:id/attendance` autenticado como paciente común retorna `403 FORBIDDEN`.
3. `POST /api/team/bookings/:id/attendance` sin token CSRF retorna `403`.
4. `POST /api/team/bookings/:id/attendance` con sesión de equipo (`admin` / `professional`) y CSRF válido actualiza la asistencia y retorna `{ ok: true, bookingId, attendanceStatus: 'attended' }` con status `200`.

- [x] **Step 2: Ejecutar pruebas para verificar que fallen**

Run: `node --test --experimental-strip-types tests/api/router.test.ts`
Expected: FAIL en las pruebas de ruta de asistencia.

- [x] **Step 3: Implementar la ruta en `src/server/router.ts` y el método en `src/lib/agendamiento/client.ts`**

- En `src/server/router.ts`:
  - Interceptar `POST /api/team/bookings/:id/attendance` dentro del bloque de equipo `if (path.startsWith('/api/team/'))`.
  - Exigir `requireCsrf()`.
  - Validar payload y delegar en `executeRecordAttendanceCommand`.
  - Retornar respuesta JSON `200`.
- En `src/lib/agendamiento/client.ts`:
  - Agregar `updateAttendance(bookingId, attendanceStatus, csrfToken)`.

- [x] **Step 4: Ejecutar pruebas de API**

Run: `node --test --experimental-strip-types tests/api/router.test.ts`
Expected: PASS.

---

### Task 4: Interfaz de Usuario en el Panel del Equipo (`src/pages/agenda.astro`)

**Files:**
- Modify: `src/pages/agenda.astro`

**UI Capabilities:**
- Indicador visual claro del estado de asistencia:
  - 🟢 **Asistió** (verde esmeralda) con botón discreto para rectificar.
  - 🔴 **No asistió** (rojo/ámbar suave) con botón para rectificar.
  - ⏳ **Pendiente** (azul/slate) si no se ha registrado aún.
- Botones de acción rápida en la tarjeta de cita:
  - Botón «✓ Asistió» (marca inmediatamente en el servidor y actualiza la tarjeta).
  - Botón «✕ No asistió» (marca inasistencia).
  - Si ya está marcada, botón «Restablecer» o selector rápido para corregir cualquier equivocación.
- Soporte para eventos de feedback y loading en UI sin parpadeos ni recargas completas.

- [x] **Step 1: Actualizar la generación del DOM de citas en `renderSchedule`**

En `src/pages/agenda.astro`:
- Leer `entry.attendanceStatus` (por defecto `'pending'`).
- Reemplazar la etiqueta condicional basada únicamente en `isPastDate` por badges semánticos de asistencia.
- Insertar los controles de acción rápida:
  - Si `attendanceStatus === 'pending'`, mostrar botones `[✓ Asistió]` y `[✕ No asistió]`.
  - Si `attendanceStatus === 'attended'`, mostrar badge verde con botón de cambio `[Cambiar]`.
  - Si `attendanceStatus === 'no_show'`, mostrar badge de inasistencia con botón de cambio `[Cambiar]`.

- [x] **Step 2: Implementar el handler JavaScript de actualización de asistencia**

- Delegar en `AgendamientoClient.updateAttendance(bookingId, newStatus, currentCsrfToken)`.
- Mostrar micro-estado de carga o deshabilitar temporalmente los botones durante la petición fetch.
- Actualizar el objeto local `schedule.entries` con el nuevo estado y refrescar la tarjeta o vista sin pérdida de foco.
- Notificar error amigable en caso de falla de red o sesión expirada.

- [x] **Step 3: Ejecutar build de Astro para verificar tipos y maquetación**

Run: `npm run build`
Expected: Build exitoso sin errores en `dist/`.

---

### Task 5: Matriz de Integración y Regresión Completa

**Files:**
- Modify: `tests/integration/e2e-matrix.test.ts`

- [x] **Step 1: Añadir prueba de flujo completo en `tests/integration/e2e-matrix.test.ts`**

Verificar el flujo de extremo a extremo:
1. Paciente reserva cita en un horario disponible.
2. Profesional consulta `/api/team/schedule` y verifica que la cita aparezca con `attendanceStatus: 'pending'`.
3. Profesional marca la cita como `attended`.
4. La agenda refleja `attended`.
5. Si el profesional rectifica a `no_show`, la agenda refleja `no_show`.
6. Si la cita es cancelada con If-Match, intentos posteriores de registrar asistencia son rechazados con `409 BOOKING_CANCELLED`.

- [x] **Step 2: Ejecutar suite de pruebas completa**

Run: `npm test`
Expected: Todos los tests pasan (51+ tests exitosos).

- [x] **Step 3: Ejecutar build final**

Run: `npm run build`
Expected: Build estático limpio en `dist/`.
