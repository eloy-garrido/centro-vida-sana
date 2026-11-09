# Endurecimiento de Seguridad y Corrección de Bugs de Agendamiento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir las vulnerabilidades de seguridad, fallos de atomicidad transaccional, errores de zona horaria (`America/Santiago` UTC-3/UTC-4) y defectos algorítmicos detectados en la auditoría del sistema de reservas y agenda.

**Architecture:** Se endurece la capa de autenticación y enrutamiento (`src/server/router.ts`, `src/server/auth/*`), se añade cifrado real AES-256-GCM con WebCrypto para los snapshots y perfiles con PII/RUT, se incorpora ejecución transaccional por lotes (`db.batch`) en el adaptador D1/SQLite (`src/server/db/adapter.ts`), se corrigen los cálculos de huso horario chileno y rangos semiabiertos `[from, to)` en el motor de agenda (`src/server/agenda/*`), y se sincronizan los flujos de cliente en `src/pages/reservar.astro` y `src/pages/agenda.astro`.

**Tech Stack:** TypeScript, Astro 5, Cloudflare Workers + D1, Node 22 (`node:sqlite`, `node:test`), WebCrypto API (`crypto.subtle`).

**Spec:** `docs/agendamiento/contexto.md`, `docs/agendamiento/specs/01-identidad-permisos.md`, `docs/agendamiento/specs/02-datos-privacidad.md`, `docs/agendamiento/specs/03-motor-agenda.md`, `docs/agendamiento/specs/09-contratos-api.md`

## Global Constraints

- Zona horaria oficial de negocio: `America/Santiago` (con soporte exacto para horario de verano UTC-3 e invierno UTC-4).
- Cero dependencias externas nuevas; utilizar exclusivamente APIs estándar de WebCrypto (`crypto.subtle`), `Intl.DateTimeFormat` y `node:sqlite` en pruebas.
- Ningún cambio ni mutación remota en Cloudflare D1/Workers; toda verificación se ejecuta localmente con `npm test` y `npm run build`.
- No exponer RUT, tokens ni PII en URLs, logs ni mensajes de error.

## Review Focus

- Peticiones a `POST /api/mock-login` en entorno de Worker (`isDev: false` o `env` de staging/producción) deben ser rechazadas con `403 FORBIDDEN`.
- Peticiones a `GET /auth/google/callback?error=<script>...` deben escapar caracteres HTML para impedir XSS reflejado.
- Sesiones creadas en el callback de Google OAuth con `{ nowSeconds }` deben almacenar `expires_at` numérico entero (`nowSeconds + 28800`) y expirar tras 8 horas.
- Citas agendadas en horario de invierno chileno (ej. julio, UTC-4) a las 09:00 hrs locales deben calcularse como `13:00:00.000Z` (no `12:00:00.000Z`) tanto en backend como en `/agenda`.
- Consultar `/api/team/schedule?professionalId=felipe&from=2026-11-06&to=2026-11-07` no debe incluir citas del `2026-11-07` en la vista del `2026-11-06`, y debe incluir `availableSlots` para el día actual (`D+0`).

---

### Task 1: Endurecimiento de Autenticación, Sesiones, OAuth XSS y Cookies

**Files:**
- Modify: `src/server/auth/crypto.ts`
- Modify: `src/server/auth/middleware.ts`
- Modify: `src/server/auth/session-service.ts`
- Modify: `src/server/router.ts`
- Modify: `infra/cloudflare-staging/worker.js`
- Test: `tests/auth/auth.test.ts`

**Interfaces:**
- Produces:
  - `escapeHtml(raw: string): string` en `src/server/auth/middleware.ts`
  - `createSession(db: DatabaseAdapter, userId: string, options?: number | { ttlSeconds?: number; nowSeconds?: number }): Promise<{ rawToken: string; csrfToken: string; expiresAt: number }>` en `src/server/auth/session-service.ts`
  - `validateSession(db: DatabaseAdapter, rawToken: string, nowSeconds?: number): Promise<ValidatedSessionData | null>` en `src/server/auth/session-service.ts`

- [ ] **Step 1: Write the failing security and session tests in `tests/auth/auth.test.ts`**

Añadir pruebas al final de `tests/auth/auth.test.ts` que verifiquen:
1. `createSession(adapter, user.id, { nowSeconds: 1762440000 })` guarda un `expires_at` entero igual a `1762440000 + 28800` y `validateSession(adapter, session.rawToken, 1762440000 + 28801)` retorna `null`.
2. `POST /api/mock-login` con `{ isDev: false }` retorna `403` con código `FORBIDDEN`.
3. `GET /auth/google/callback?error=<script>alert(1)</script>` retorna `400` cuyo cuerpo contiene `&lt;script&gt;alert(1)&lt;/script&gt;` y no `<script>`.
4. `POST /api/logout` sobre `https://centrovidasana.cl/api/logout` emite `Set-Cookie` limpiando `__Host-vsa_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure`.
5. `validateSafeReturnUrl('/reservar.evil.com')` y `validateSafeReturnUrl('/reservar\r\nSet-Cookie: x=1')` retornan `'/reservar'`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types tests/auth/auth.test.ts`
Expected: FAIL en las nuevas aserciones.

- [ ] **Step 3: Implement auth and router fixes in `src/server/auth/middleware.ts`, `src/server/auth/session-service.ts`, `src/server/router.ts`, and `infra/cloudflare-staging/worker.js`**

1. En `src/server/auth/middleware.ts`:
   - Exportar `escapeHtml(str: string): string` reemplazando `&`, `<`, `>`, `"`, `'`.
   - En `validateSafeReturnUrl(rawUrl)`: rechazar cualquier cadena con caracteres de control `/[\r\n\0]/` y validar que la ruta coincida exactamente con `/`, `/reservar`, `/agenda`, `/quiropraxia`, `/acupuntura` o vaya seguida únicamente de `/`, `?` o `#`.
2. En `src/server/auth/session-service.ts`:
   - Actualizar `createSession(db, userId, options: number | { ttlSeconds?: number; nowSeconds?: number } = SESSION_TTL_SECONDS)` para soportar tanto un número `ttlSeconds` como el objeto `{ ttlSeconds, nowSeconds }`, garantizando que `expiresAt` sea siempre un entero.
   - Aceptar `nowSeconds = Math.floor(Date.now() / 1000)` opcional en `validateSession`, `revokeSession`, `createOAuthAttempt` y `consumeOAuthAttempt`.
   - En `findOrCreateUser`, usar `ON CONFLICT(google_sub) DO UPDATE SET name = excluded.name, email = excluded.email, updated_at = excluded.updated_at` o manejo de colisión para evitar errores de concurrencia.
3. En `src/server/router.ts`:
   - En `POST /api/mock-login`: verificar `const allowMock = options.isDev ?? !options.env; if (!allowMock) return errorResponse('FORBIDDEN', 'Mock login deshabilitado en este entorno.', 403);` y reemplazar `Buffer.from(email).toString('hex')` por `(await sha256Hex(email)).slice(0, 24)`.
   - En `POST /api/logout`: pasar `url.protocol === 'https:'` a `createClearSessionCookie(url.protocol === 'https:')`.
   - En `requireCsrf()`: verificar también `if (!validateSameOrigin(request.headers, url.origin)) throw new ApiCommandError('INVALID_CSRF', 'Origen de petición no autorizado.', 403);`.
   - En `GET /auth/google/callback`: escapar `error` y `validation.error` con `escapeHtml(...)` y añadir cabecera `'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'"`.
   - Pasar `nowSeconds` a `validateSession(db, sessionToken, nowSeconds)`.
4. En `infra/cloudflare-staging/worker.js`:
   - Pasar `{ env, isDev: false }` a `handleApiRequest(request, db, { env, isDev: false })`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --experimental-strip-types tests/auth/auth.test.ts`
Expected: PASS

---

### Task 2: Cifrado Real en Reposo (AES-256-GCM) para PII y RUT

**Files:**
- Modify: `src/server/auth/crypto.ts`
- Modify: `src/server/agenda/profile.ts`
- Modify: `src/server/agenda/commands.ts`
- Modify: `src/server/agenda/team.ts`
- Modify: `src/server/agenda/details.ts`
- Test: `tests/database/schema.test.ts`

**Interfaces:**
- Produces:
  - `encryptPiiJson(payload: unknown, secret?: string): Promise<string>` en `src/server/auth/crypto.ts`
  - `decryptPiiJson<T = Record<string, any>>(stored: string | null | undefined, secret?: string): Promise<T | null>` en `src/server/auth/crypto.ts`

- [ ] **Step 1: Write the failing encryption test in `tests/database/schema.test.ts`**

Añadir un test en `tests/database/schema.test.ts` que guarde un perfil con `savePatientProfile` y cree una reserva con `executeCreateBookingCommand`, consulte directamente las columnas crudas `encrypted_payload` en `patient_profiles` y `encrypted_snapshot` en `agenda_entries` mediante SQL, y verifique que:
1. Comienzan con el prefijo `'enc:v1:'`.
2. **No** contienen en texto plano el RUT (`'16.789.012-1'`) ni el nombre del paciente.
3. Al leerlos con `getPatientProfile` y `getBookingDetails`, se descifran de forma transparente devolviendo los datos originales.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types tests/database/schema.test.ts`
Expected: FAIL porque actualmente se almacena `JSON.stringify` en texto claro.

- [ ] **Step 3: Implement `encryptPiiJson` and `decryptPiiJson` in `src/server/auth/crypto.ts` and wire into agenda services**

1. En `src/server/auth/crypto.ts`:
   - Derivar una clave `CryptoKey` AES-GCM de 256 bits mediante `SHA-256` del secreto (`secret || process.env?.PII_ENCRYPTION_KEY || 'vsa-local-dev-pii-key-2026'`).
   - En `encryptPiiJson`: generar un IV aleatorio de 12 bytes con `crypto.getRandomValues`, cifrar con `AES-GCM` y retornar `enc:v1:${bufferToBase64Url(iv)}:${bufferToBase64Url(ciphertext)}`.
   - En `decryptPiiJson`: si la cadena empieza con `enc:v1:`, separar IV y ciphertext, descifrar con `AES-GCM` y parsear JSON; si empieza con `{` (fixtures legados en tests), hacer `JSON.parse` como fallback seguro.
2. Usar `await encryptPiiJson(...)` y `await decryptPiiJson(...)` en `src/server/agenda/profile.ts`, `src/server/agenda/commands.ts`, `src/server/agenda/team.ts` y `src/server/agenda/details.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --experimental-strip-types tests/database/schema.test.ts`
Expected: PASS

---

### Task 3: Transacciones Atómicas (`db.batch`), Idempotencia de Bloqueos, Validación Estricta y Concurrencia `If-Match`

**Files:**
- Modify: `src/server/db/adapter.ts`
- Modify: `src/server/agenda/commands.ts`
- Modify: `src/server/agenda/team.ts`
- Modify: `src/server/agenda/profile.ts`
- Modify: `src/server/agenda/details.ts`
- Modify: `src/server/router.ts`
- Test: `tests/agenda/agenda.test.ts`

**Interfaces:**
- Produces:
  - `DatabaseAdapter.batch(statements: Array<{ sql: string; params?: any[] }>): Promise<void>` en `src/server/db/adapter.ts`
  - `executeCreateBlockCommand(...)` devuelve `Promise<{ result: MutationResult; isReplay: boolean }>` (o mantiene compatibilidad retornando `MutationResult` con soporte de replay en `router.ts`).

- [ ] **Step 1: Write the failing transactional, validation, and concurrency tests in `tests/agenda/agenda.test.ts`**

Añadir pruebas en `tests/agenda/agenda.test.ts` que comprueben:
1. Enviar `If-Match: v1` (sin comillas) a `executeCancelBookingCommand` actualiza realmente el registro en `agenda_entries` a `status = 'cancelled'` (no un falso positivo con 0 filas afectadas).
2. Reintentar `executeCreateBlockCommand` con la misma `Idempotency-Key` y mismo payload devuelve el mismo bloqueo (idempotencia) y registra una fila en `audit_events` (`action = 'create_team_block'`) y en `command_results`.
3. Reintentar `executeCreateBlockCommand` con la misma `Idempotency-Key` y distinto horario lanza `409 IDEMPOTENCY_MISMATCH`.
4. Llamar a `executeCreateBookingCommand` con `professionalId: 'invalido'`, o `patient.name: 'A'`, o `patient.phone: 'abc'` lanza `ApiCommandError` (`400`/`422 VALIDATION_ERROR`) y nunca `500`.
5. Intentar editar o cancelar un `block` usando `executeEditTeamBookingCommand` o `executeCancelBookingCommand` retorna `404 NOT_FOUND`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types tests/agenda/agenda.test.ts`
Expected: FAIL en las nuevas pruebas.

- [ ] **Step 3: Implement `db.batch`, block idempotency, strict validation, and `If-Match` fix**

1. En `src/server/db/adapter.ts`:
   - Implementar `batch(statements)` en `createD1Adapter` (usando `await d1.batch(statements.map(s => d1.prepare(s.sql).bind(...(s.params ?? []))))`) y en `createSqliteAdapter` (usando `BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK`).
2. En `src/server/agenda/commands.ts` y `src/server/agenda/team.ts`:
   - Validar `isAllowedProfessional(request.professionalId)` (retornando `400 VALIDATION_ERROR` si no es `'felipe'` o `'eduardo'`).
   - Validar `request.patient` como objeto no nulo, `name` (`trimmed.length >= 2 && trimmed.length <= 120`), `validateEmail`, `validateDocument`, y `validatePhone(request.patient.phone)`.
   - Ejecutar las escrituras de `agenda_entries`, `audit_events` y `command_results` dentro de un único `await db.batch([...])`.
   - En `executeCancelBookingCommand`, filtrar `AND kind = 'appointment'`, usar `existing.version` en el `WHERE id = ? AND version = ?` (evitando el desajuste por comillas), y verificar que la actualización se aplique dentro de `db.batch`.
   - En `executeEditTeamBookingCommand` y `getBookingDetails`, exigir `kind = 'appointment'`.
   - En `executeCreateBlockCommand`, validar `isAllowedProfessional`, `isValidRfc3339Utc(request.startAt)`, `isAlignedToHour(request.startAt)`, duración de 3600s, consultar `command_results` para replay/mismatch e insertar atómicamente con `db.batch` en `agenda_entries`, `audit_events` (`create_team_block`) y `command_results`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --experimental-strip-types tests/agenda/agenda.test.ts`
Expected: PASS

---

### Task 4: Algoritmos de Zona Horaria (`America/Santiago` DST), Ventana de Equipo y Consultas SQL Acotadas

**Files:**
- Modify: `src/server/agenda/policy.ts`
- Modify: `src/server/agenda/availability.ts`
- Modify: `src/server/agenda/team.ts`
- Test: `tests/agenda/agenda.test.ts`

**Interfaces:**
- Produces:
  - `chileLocalToUtcSeconds(year: number, month: number, day: number, hour: number, minute?: number): number` exacto tanto en invierno (UTC-4) como en verano (UTC-3), incluyendo `hour = 0`.
  - `validateDateRange(fromDate: string, toDate: string, maxDays?: number): { fromSec: number; toSec: number }` en `src/server/agenda/policy.ts`.

- [ ] **Step 1: Write the failing DST, team window, and SQL range tests in `tests/agenda/agenda.test.ts`**

Añadir pruebas en `tests/agenda/agenda.test.ts` para:
1. Horario de invierno en Chile (ej. `2026-07-15`, UTC-4): `chileLocalToUtcSeconds(2026, 7, 15, 0, 0)` debe ser `2026-07-15T04:00:00.000Z` y `chileLocalToUtcSeconds(2026, 7, 15, 9, 0)` debe ser `2026-07-15T13:00:00.000Z`.
2. `isWithinTeamBookingWindow`: si `now` es `2026-11-25`, rechaza una fecha en `2027-12-03` (`false`) y permite hasta 31 días hacia adelante (`true`).
3. `getTeamSchedule(adapter, 'felipe', '2026-11-06', '2026-11-07', nowChile)` cuando hoy es `2026-11-06` (`D+0`):
   - Devuelve `availableSlots` con los 11 turnos del día `2026-11-06` (no vacío).
   - No incluye en `entries` una cita agendada para el `2026-11-07`.
4. `getAvailableSlots` con un rango inválido o mayor a 35 días (`from: '2026-01-01', to: '2028-01-01'`) lanza `ApiCommandError` (`400 VALIDATION_ERROR`).

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types tests/agenda/agenda.test.ts`
Expected: FAIL en las 4 aserciones.

- [ ] **Step 3: Implement timezone, window, and range fixes in `src/server/agenda/policy.ts`, `src/server/agenda/availability.ts`, and `src/server/agenda/team.ts`**

1. En `src/server/agenda/policy.ts`:
   - En `chileLocalToUtcSeconds`: calcular la diferencia completa en milisegundos entre `Date.UTC(year, month - 1, day, hour, minute, 0)` y `Date.UTC(localParts.year, localParts.month - 1, localParts.day, localParts.hour, localParts.minute, 0)`, sumándola a `guessDate` (y refinando una segunda pasada si cruza transición DST).
   - En `isWithinTeamBookingWindow`: verificar `diffDays >= 0 && diffDays <= 31` (o mes en curso del mismo año / primeros 7 días del mes inmediatamente siguiente del año correspondiente).
   - Exportar `validateDateRange(fromDate: string, toDate: string, maxDays = 35)` que valide `/^\d{4}-\d{2}-\d{2}$/`, compruebe `toDate > fromDate` y `diffDays <= maxDays`, o lance `ApiCommandError('VALIDATION_ERROR', 'Rango de fechas inválido o excesivo.', 400)`.
2. En `src/server/agenda/availability.ts`:
   - Invocar `validateDateRange(params.fromDate, params.toDate, 35)` al inicio de `getAvailableSlots`.
3. En `src/server/agenda/team.ts`:
   - En `getTeamSchedule`: validar el rango con `validateDateRange(fromDate, toDate, 35)`, pasar `forTeam: true` a `getAvailableSlots`, y filtrar en SQL con `WHERE professional_id = ? AND start_at >= ? AND start_at < ? ORDER BY start_at ASC` usando los límites UTC de `[fromDate, toDate)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --experimental-strip-types tests/agenda/agenda.test.ts`
Expected: PASS

---

### Task 5: Sincronización de Frontend en `/reservar` y `/agenda`

**Files:**
- Modify: `src/pages/agenda.astro`
- Modify: `src/pages/reservar.astro`
- Test: `tests/integration/e2e-matrix.test.ts`

**Interfaces:**
- Consumes: `getTeamSchedule` y `getAvailability` desde `AgendamientoClient`.

- [ ] **Step 1: Update `src/pages/agenda.astro` to eliminate hardcoded UTC-3 offsets and cross-day collisions**

1. En `src/pages/agenda.astro`:
   - Crear una función helper `chileHourToUtcIso(dateStr: string, hour: number): string` que calcule el instante UTC exacto para `America/Santiago` (usando `Intl.DateTimeFormat` para determinar si el día está en UTC-3 o UTC-4, sin hardcodear `hour + 3`).
   - Usar `chileHourToUtcIso(activeDateString, hour)` y `chileHourToUtcIso(activeDateString, hour + 1)` en `openBookingModal` y `createBlockDirect`.
   - En `renderScheduleRows`, verificar que `e.startAt` pertenezca a `activeDateString` en `America/Santiago` además de coincidir en `hour` y `e.status === 'confirmed'`.
   - Ocultar `#btn-dev-quick-team` salvo cuando `window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'`.

- [ ] **Step 2: Update `src/pages/reservar.astro` to rotate `Idempotency-Key` on payload change and invalidate slot cache on `409 SLOT_CONFLICT`**

1. En `src/pages/reservar.astro`:
   - Crear ` regenerateIdempotencyKey()` y llamarla cuando el usuario cambie de profesional, seleccione un horario distinto o avance desde el Paso 3 al Paso 4 con cambios en los datos del paciente.
   - En el bloque `catch` de `btnFinalConfirm`, si `err instanceof ApiError && err.code === 'SLOT_CONFLICT'`, limpiar `loadedAvailabilityForPro = null; slotsByDate.clear(); selectedSlotUtc = null;` y regenerar `currentIdempotencyKey`, para que al regresar al Paso 2 se recargue la disponibilidad actualizada desde el servidor.
   - Ocultar `#btn-step-3-quick-login` salvo cuando `window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'`.

- [ ] **Step 3: Run full test suite and Astro static build**

Run: `npm test && npm run build`
Expected: Todos los tests en `tests/**/*.test.ts` pasan con 0 fallos y `astro build` compila sin errores en `dist/`.
