# Ficha y Notas de Evolución de Pacientes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar un sistema de ficha y notas clínicas de evolución para pacientes en el panel de agenda de Centro Vida Sana, permitiendo a los profesionales consultar el historial cronológico colapsable por fecha, registrar notas para la sesión actual y editar notas existentes.

**Architecture:** Se almacena cada nota en una tabla dedicada `patient_notes` en Cloudflare D1 indexada por `patient_key` (derivado del RUT normalizado del snapshot). El contenido clínico se cifra en reposo con AES-256-GCM mediante la clave de servidor `PII_ENCRYPTION_KEY`. En el frontend `/agenda`, al presionar la tarjeta del paciente se abre un modal con la redacción de la nota actual arriba y el historial colapsable tipo acordeón por fecha abajo, con distintivos de color institucional (Azul Felipe / Verde Eduardo) y edición rápida con icono de lápiz.

**Tech Stack:** Astro 5, TypeScript, Node.js SQLite (pruebas locales) / Cloudflare D1 (producción), Web Crypto API (AES-GCM), Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-11-11-patient-clinical-notes-design.md`

## Global Constraints

- Las notas clínicas se cifran con AES-256-GCM en D1; ningún texto clínico libre en texto plano en la base de datos.
- Solo usuarios con rol de equipo activo (`teamAgenda = true`) pueden acceder a consultas o mutaciones de notas (`401/403` para otros).
- Toda mutación (`POST`, `PATCH`) exige validación de `X-CSRF-Token` y cabeceras de origen seguro.
- La zona horaria para formatear fechas de presentación es estrictamente `America/Santiago`.
- Paleta institucional obligatoria: Felipe Méndez en Azul Petróleo (`#134E5E` / teal), Eduardo Lagos en Verde Salvia (`#2E4D38` / emerald).
- No ejecutar despliegues, migraciones remotas ni mutaciones Git sin autorización explícita del usuario.

## Review Focus

- Nota con caracteres especiales, emojis o saltos de línea múltiples se almacena y renderiza correctamente sin inyección HTML (`<script>` escapado).
- Paciente extranjero o sin RUT (pasaporte o contingencia de email) genera un `patient_key` válido y consistente.
- Edición con texto vacío o con espacios en blanco es rechazada con `400 Bad Request`.
- Usuario no autenticado o con cuenta de paciente recibe `401 Unauthorized` o `403 Forbidden` al invocar cualquier endpoint de notas.
- Dos citas en fechas distintas con el mismo RUT comparten inmediatamente el mismo historial acumulado de notas.

---

### Task 1: Migración D1 y Registro de Esquema

**Files:**
- Create: `migrations/0003_patient_notes.sql`
- Modify: `src/server/dev-middleware.ts`
- Modify: `tests/database/schema.test.ts`
- Modify: `tests/agenda/agenda.test.ts`
- Modify: `tests/api/router.test.ts`
- Modify: `tests/auth/auth.test.ts`
- Modify: `tests/integration/e2e-matrix.test.ts`

**Interfaces:**
- Produces: Tabla `patient_notes (id, patient_key, booking_id, professional_id, author_user_id, author_name, encrypted_content, created_at, updated_at)` e índice `idx_patient_notes_lookup`.

- [ ] **Step 1: Crear archivo de migración `migrations/0003_patient_notes.sql`**
Crear el DDL con claves foráneas, restricciones `CHECK (professional_id IN ('felipe', 'eduardo'))` e índice sobre `(patient_key, created_at DESC)`.

- [ ] **Step 2: Actualizar lista `migrationFiles` en suites de pruebas y middleware**
Agregar `'0003_patient_notes.sql'` al array `migrationFiles` en `src/server/dev-middleware.ts` y en todos los archivos de prueba en `tests/`.

- [ ] **Step 3: Escribir prueba unitaria en `tests/database/schema.test.ts`**
Verificar que la tabla `patient_notes` exista en la base de datos de prueba y acepte inserciones con campos requeridos.

- [ ] **Step 4: Ejecutar pruebas de base de datos**
Run: `npm test -- tests/database/schema.test.ts`
Expected: PASS

---

### Task 2: Capa de Servicio y Cifrado de Notas (`src/server/agenda/notes.ts`)

**Files:**
- Create: `src/server/agenda/notes.ts`
- Test: `tests/agenda/notes.test.ts`

**Interfaces:**
- Produces:
  - `normalizePatientKey(rutOrDoc: string, documentType?: string): string`
  - `getPatientNotesByBooking(db: DatabaseAdapter, bookingId: string, actor: { id: string; isTeam: boolean }): Promise<{ patient: PatientSnapshot; patientKey: string; notes: PatientNoteItem[] }>`
  - `createPatientNote(db: DatabaseAdapter, params: CreateNoteParams): Promise<PatientNoteItem>`
  - `updatePatientNote(db: DatabaseAdapter, noteId: string, content: string, actor: { id: string; isTeam: boolean }): Promise<PatientNoteItem>`

- [ ] **Step 1: Escribir pruebas unitarias en `tests/agenda/notes.test.ts`**
Cubrir normalización de clave de paciente, cifrado/descifrado de contenido, inserción de notas y edición con actualización de `updated_at`.

- [ ] **Step 2: Ejecutar pruebas para verificar que fallen**
Run: `npm test -- tests/agenda/notes.test.ts`
Expected: FAIL ("cannot find module ./notes.ts")

- [ ] **Step 3: Implementar `src/server/agenda/notes.ts`**
Implementar funciones con validación estricta de longitud (1 a 4000 caracteres), cifrado AES-256-GCM con `encryptPiiJson` / `decryptPiiJson`, y consultas SQL parametrizadas.

- [ ] **Step 4: Ejecutar pruebas para verificar que pasen**
Run: `npm test -- tests/agenda/notes.test.ts`
Expected: PASS

---

### Task 3: Endpoints REST en API Router (`src/server/router.ts`)

**Files:**
- Modify: `src/server/router.ts`
- Test: `tests/api/patient-notes-api.test.ts`

**Interfaces:**
- Produces:
  - `GET /api/team/bookings/:id/notes`
  - `POST /api/team/patients/:patientKey/notes`
  - `PATCH /api/team/notes/:id`

- [ ] **Step 1: Escribir pruebas de endpoints en `tests/api/patient-notes-api.test.ts`**
Probar autenticación de equipo requerida, rechazo de usuario anónimo con `401`, rechazo de CSRF faltante en mutaciones, creación y actualización de notas.

- [ ] **Step 2: Ejecutar pruebas de API para verificar que fallen**
Run: `npm test -- tests/api/patient-notes-api.test.ts`
Expected: FAIL (`404 NOT_FOUND`)

- [ ] **Step 3: Conectar rutas en `src/server/router.ts`**
En la sección `if (path.startsWith('/api/team/'))`, agregar los tres manejadores de ruta con `requireCsrf()`, validación de body y retorno de JSON.

- [ ] **Step 4: Ejecutar pruebas de API para verificar que pasen**
Run: `npm test -- tests/api/patient-notes-api.test.ts`
Expected: PASS

---

### Task 4: Tipos y Métodos en Cliente Frontend (`src/lib/agendamiento/`)

**Files:**
- Modify: `src/lib/agendamiento/types.ts`
- Modify: `src/lib/agendamiento/client.ts`

**Interfaces:**
- Produces:
  - `interface PatientNoteItem { id: string; professionalId: ProfessionalId; professionalName: string; authorName: string; content: string; createdAt: string; updatedAt: string; isEdited: boolean; }`
  - `interface BookingNotesResponse { patient: PatientSnapshot; patientKey: string; notes: PatientNoteItem[]; }`
  - Métodos en `AgendaClient`: `getBookingNotes(bookingId)`, `createPatientNote(patientKey, payload, csrfToken)`, `updatePatientNote(noteId, content, csrfToken)`.

- [ ] **Step 1: Declarar interfaces en `src/lib/agendamiento/types.ts`**
Agregar los tipos de datos para las notas, respuestas y peticiones.

- [ ] **Step 2: Implementar métodos en `AgendaClient` (`src/lib/agendamiento/client.ts`)**
Agregar `getBookingNotes`, `createPatientNote` y `updatePatientNote` utilizando el helper interno `requestJson`.

- [ ] **Step 3: Verificar compilación TypeScript**
Run: `npm run build`
Expected: Build exitoso sin errores de tipos.

---

### Task 5: Modal de Ficha y Acordeón de Notas en `/agenda` (`src/pages/agenda.astro`)

**Files:**
- Modify: `src/pages/agenda.astro`

**Interfaces:**
- Consumes: `AgendaClient.getBookingNotes`, `AgendaClient.createPatientNote`, `AgendaClient.updatePatientNote`.
- Produces: Modal accesible `#modal-patient-notes` con redacción de notas arriba, lista colapsable tipo acordeón abajo, marcas de color institucional y lápiz de edición.

- [ ] **Step 1: Añadir estructura HTML del modal `#modal-patient-notes` en `src/pages/agenda.astro`**
Crear el contenedor accesible con cabecera de paciente, área superior de formulario (textarea + botón "Guardar Nota") y contenedor inferior para la lista colapsable tipo acordeón.

- [ ] **Step 2: Modificar renderizado de citas para hacer clickeable la tarjeta del paciente**
En `renderSchedule()`, dotar al bloque del paciente de cursor interactivo y botón/etiqueta identificadora (`data-action="open-notes" data-booking-id="${entry.id}"`).

- [ ] **Step 3: Implementar lógica del modal y comportamiento del acordeón en el script cliente**
  - Al abrir el modal: cargar notas mediante `getBookingNotes(bookingId)`.
  - Renderizar tarjetas colapsadas por fecha con color institucional (Azul Felipe / Verde Eduardo).
  - Interactividad de acordeón: clic en la cabecera de la fecha expande/colapsa el texto de la nota.
  - Edición inline: clic en icono de lápiz (✏️) abre textarea con botones "Guardar cambios" y "Cancelar".
  - Guardar nueva nota: invocar `createPatientNote` y colocarla inmediatamente al inicio del acordeón.

- [ ] **Step 4: Verificar interactividad y accesibilidad del modal**
Verificar tecla Escape, cierre al hacer clic fuera, contraste WCAG AA, bordes temáticos `#134E5E` y `#2E4D38`.

---

### Task 6: Pruebas de Integración y Verificación Final

**Files:**
- Modify / Run: Suite completa de pruebas
- Run: `npm run build`

- [ ] **Step 1: Ejecutar la suite completa de pruebas automatizadas**
Run: `npm test -- --run`
Expected: Todas las pruebas existentes y nuevas pasan sin errores (58+ tests exitosos).

- [ ] **Step 2: Ejecutar build de producción en Astro**
Run: `npm run build`
Expected: Generación estática exitosa en `dist/` sin advertencias críticas ni errores.
