# Especificación de Diseño: Ficha y Notas de Evolución de Pacientes

**Fecha:** 2026-11-11  
**Estado:** Propuesta aprobada lista para plan de implementación  
**Ámbito:** Panel del Equipo (`/agenda`), Cloudflare D1 y API REST del servidor

---

## 1. Resumen y Propósito

Permitir que los profesionales de Centro Vida Sana Austral (Felipe Méndez y Eduardo Lagos) puedan registrar y consultar notas clínicas de evolución de sus pacientes directamente desde el panel interno de gestión de agendas (`/agenda`).

Al hacer clic sobre la cita de un paciente en el panel de agenda:
1. Se abre el **Modal de Ficha del Paciente**.
2. En la parte superior se muestran los datos del paciente y el formulario para redactar de inmediato la **nota de la sesión actual**.
3. En la parte inferior se muestra el **historial cronológico de notas previas** organizadas en un formato tipo **acordeón colapsable por fecha**:
   - Cada nota muestra la fecha de la sesión y una etiqueta con el color institucional del profesional:
     - **Felipe Méndez (Quiropraxia / Kinesiología):** Azul petróleo (`#134E5E`).
     - **Eduardo Lagos (Acupuntura / MTC):** Verde salvia (`#2E4D38`).
   - Al hacer clic sobre una fecha, la tarjeta se expande suavemente revelando el contenido completo y legible.
   - En la esquina superior derecha de cada nota expandida se incluye un **icono de lápiz (✏️)** que permite editar el texto directamente inline.

---

## 2. Modelo de Persistencia y Cifrado (Cloudflare D1)

### 2.1 Migración SQL (`migrations/0003_patient_notes.sql`)

```sql
-- ============================================================================
-- Centro Vida Sana Austral — Migración 0003: Ficha y Notas de Evolución
-- ============================================================================

CREATE TABLE IF NOT EXISTS patient_notes (
  id TEXT PRIMARY KEY,
  patient_key TEXT NOT NULL,                     -- Clave canónica normalizada (ej: "RUT:12345678-K")
  booking_id TEXT NULL REFERENCES agenda_entries(id) ON DELETE SET NULL,
  professional_id TEXT NOT NULL CHECK (professional_id IN ('felipe', 'eduardo')),
  author_user_id TEXT NOT NULL REFERENCES users(id),
  author_name TEXT NOT NULL,
  encrypted_content TEXT NOT NULL,               -- Contenido clínico cifrado con AES-GCM
  created_at INTEGER NOT NULL,                   -- Unix timestamp UTC en segundos
  updated_at INTEGER NOT NULL                    -- Unix timestamp UTC en segundos
);

CREATE INDEX IF NOT EXISTS idx_patient_notes_lookup
  ON patient_notes (patient_key, created_at DESC);
```

### 2.2 Unificación del Paciente (`patient_key`)
Para asociar las notas a lo largo de citas sucesivas, se utiliza como identificador principal el RUT normalizado del paciente (obtenido del snapshot de la cita):
- Formato RUT: `RUT:12345678-K` (sin puntos, con guion y dígito verificador en mayúscula).
- Formato Pasaporte / Otro: `PASSPORT:NUMERO` o `EMAIL:correo@ejemplo.cl` como mecanismo de contingencia si no posee RUT chileno.

### 2.3 Seguridad y Cifrado en Reposo
- El texto clínico jamás se almacena en texto plano en la base de datos D1.
- Se reutiliza la función existente `encryptPiiJson` / `decryptPiiJson` (AES-256-GCM con IV aleatorio por registro derivado de la clave secreta `PII_ENCRYPTION_KEY`).
- Acceso exclusivo: solo usuarios autenticados con rol de equipo (`capabilities.teamAgenda === true`) pueden ejecutar consultas o mutaciones sobre notas.

---

## 3. Endpoints de Backend (API REST)

### 3.1 `GET /api/team/bookings/:bookingId/notes`
- **Autenticación:** Sesión activa de equipo.
- **Acción:**
  1. Obtiene la cita `bookingId` y desencripta el `encrypted_snapshot` para conocer al paciente y calcular `patient_key`.
  2. Consulta la tabla `patient_notes` filtrando por `patient_key` ordenado por `created_at DESC`.
  3. Desencripta cada nota en memoria.
- **Respuesta (`200 OK`):**
  ```json
  {
    "patient": {
      "name": "María González",
      "rut": "14.289.442-3",
      "phone": "+56 9 9123 4567",
      "email": "maria@ejemplo.cl"
    },
    "patientKey": "RUT:14289442-3",
    "notes": [
      {
        "id": "note_1700000000_abc",
        "professionalId": "felipe",
        "professionalName": "Felipe Méndez",
        "authorName": "Felipe Méndez",
        "content": "Ajuste cervical C5-C6. Reporta alivio de cefaleas tensionales.",
        "createdAt": "2026-11-04T15:00:00Z",
        "updatedAt": "2026-11-04T15:00:00Z",
        "isEdited": false
      }
    ]
  }
  ```

### 3.2 `POST /api/team/patients/:patientKey/notes`
- **Autenticación:** Sesión de equipo + cabecera `X-CSRF-Token`.
- **Cuerpo:**
  ```json
  {
    "content": "Texto de la nota de evolución...",
    "professionalId": "felipe",
    "bookingId": "cita_id_opcional"
  }
  ```
- **Validaciones:** `content` con longitud entre 1 y 4.000 caracteres, saneamiento contra inyección HTML.
- **Respuesta (`201 Created`):** Objeto nota recién guardado y desencriptado.

### 3.3 `PATCH /api/team/notes/:noteId`
- **Autenticación:** Sesión de equipo + cabecera `X-CSRF-Token`.
- **Cuerpo:**
  ```json
  {
    "content": "Texto modificado de la nota..."
  }
  ```
- **Acción:** Cifra el contenido, actualiza `encrypted_content` y `updated_at` en D1.
- **Respuesta (`200 OK`):** Objeto nota actualizado con `isEdited: true`.

---

## 4. Diseño de la Interfaz de Usuario (`src/pages/agenda.astro`)

### 4.1 Activador en la Lista de Citas
- En cada fila de cita, el contenedor de datos del paciente tendrá cursor de puntero, realce visual accesible y un botón/icono identificador (`📋 Ficha y Notas`).
- Al hacer clic, se abre el modal cargando la información del paciente de forma asíncrona.

### 4.2 Modal de Ficha del Paciente (`#modal-patient-notes`)
1. **Cabecera del Modal:**
   - Nombre del paciente y badges con RUT, Teléfono (con enlace `tel:`) y Correo.
   - Botón de cierre (`✕`) con soporte de teclado `Escape` y accesibilidad ARIA (`role="dialog"`).

2. **Área Superior: Redacción de Nueva Nota:**
   - Textarea expandible con etiqueta *"Nota de atención de hoy"*.
   - Identificador del profesional atendiente según la pestaña activa en la agenda (`Felipe` o `Eduardo`).
   - Botón principal *"Guardar Nota"* con estado de carga (spinner).
   - Al guardar, la nota se agrega al historial inferior sin recargar la página.

3. **Área Inferior: Historial de Notas en Acordeón:**
   - Si no hay notas: Estado vacío elegante (*"Sin notas previas. Puedes escribir la primera arriba."*).
   - Si existen notas: Lista de barras contraídas por fecha:
     - **Barra colapsada:**
       - Fecha legible en zona horaria de Chile (ej: *«14 de Noviembre, 2026»*).
       - Badge de profesional con color de marca:
         - Azul Petróleo (`border-teal-600 bg-teal-50 text-teal-900`) para Felipe Méndez.
         - Verde Salvia (`border-emerald-600 bg-emerald-50 text-emerald-900`) para Eduardo Lagos.
       - Icono de flecha desplegable (`▼ / ▶`).
     - **Contenido expandido (al hacer clic en la barra):**
       - Muestra el texto completo con saltos de línea preservados (`whitespace-pre-wrap`).
       - Muestra fecha/hora exacta y marca `(editado)` si `updated_at > created_at`.
       - **Icono de lápiz (✏️)** en la esquina superior derecha:
         - Al hacer clic, el texto se convierte en un textarea editable con botones *"Guardar cambios"* y *"Cancelar"*.

---

## 5. Estrategia de Pruebas y Criterios de Aceptación

1. **PERSISTENCIA & CIFRADO:**
   - La tabla `patient_notes` se crea e indexa correctamente.
   - En SQLite / D1, el campo `encrypted_content` almacena datos encriptados que no pueden leerse en texto plano sin la clave secreta.
   - Dos reservas independientes con el mismo RUT comparten las notas asociadas.

2. **SEGURIDAD & RUTAS:**
   - Peticiones anónimas o con cuenta de paciente a `/api/team/*` son rechazadas con `401 Unauthorized` o `403 Forbidden`.
   - Modificaciones con `POST` y `PATCH` requieren token CSRF válido.

3. **UI & ACCESIBILIDAD:**
   - El modal se abre y enfoca correctamente; se cierra con botón o tecla `Escape`.
   - El acordeón expande y contrae las notas al interactuar con el teclado o ratón.
   - El icono de lápiz conmuta el estado de edición sin pérdida de datos.
   - `npm run build` compila sin errores de TypeScript ni estilos rotos.
