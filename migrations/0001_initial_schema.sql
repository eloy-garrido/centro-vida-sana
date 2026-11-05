-- ============================================================================
-- Centro Vida Sana Austral — Migración Inicial Cloudflare D1
-- Conforme a S01 (identidad), S02 (datos y privacidad) y S03 (exclusión atómica)
-- ============================================================================

-- 1. IDENTIDAD Y SESIONES (S01)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_attempts (
  state_hash TEXT PRIMARY KEY,
  code_verifier TEXT NOT NULL,
  nonce TEXT NOT NULL,
  return_to TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- 2. MIEMBROS DEL EQUIPO Y PROFESIONALES (S01 / S05 / D03)
CREATE TABLE IF NOT EXISTS team_members (
  email TEXT PRIMARY KEY,
  google_sub TEXT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'professional')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS professionals (
  id TEXT PRIMARY KEY CHECK (id IN ('felipe', 'eduardo')),
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  box_name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
);

-- 3. PERFIL RECORDADO DEL PACIENTE (S02 / D05)
CREATE TABLE IF NOT EXISTS patient_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  encrypted_payload TEXT NOT NULL,
  version TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 4. TABLA ÚNICA DE AGENDA: CITAS Y BLOQUEOS (S02 / S03 / S05)
CREATE TABLE IF NOT EXISTS agenda_entries (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('appointment', 'block')),
  professional_id TEXT NOT NULL REFERENCES professionals(id),
  start_at INTEGER NOT NULL,
  end_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  version TEXT NOT NULL,
  booked_by_user_id TEXT NULL REFERENCES users(id),
  encrypted_snapshot TEXT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK (end_at > start_at),
  CHECK (kind != 'appointment' OR (end_at - start_at) = 3600),
  CHECK (kind != 'appointment' OR encrypted_snapshot IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_agenda_entries_active_overlap
  ON agenda_entries (professional_id, start_at, end_at)
  WHERE status = 'confirmed';

CREATE INDEX IF NOT EXISTS idx_agenda_entries_user
  ON agenda_entries (booked_by_user_id, id);

-- 5. TRIGGERS DE EXCLUSIÓN ATÓMICA DE SOLAPAMIENTOS (S03)
-- Garantiza matemáticamente que NUNCA coexistan dos entradas activas ('confirmed')
-- del mismo profesional que solapen en el intervalo [start_at, end_at).
CREATE TRIGGER IF NOT EXISTS trg_agenda_entries_no_overlap_insert
BEFORE INSERT ON agenda_entries
FOR EACH ROW
WHEN NEW.status = 'confirmed'
BEGIN
  SELECT RAISE(ABORT, 'SLOT_CONFLICT')
  WHERE EXISTS (
    SELECT 1 FROM agenda_entries
    WHERE professional_id = NEW.professional_id
      AND status = 'confirmed'
      AND start_at < NEW.end_at
      AND end_at > NEW.start_at
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_agenda_entries_no_overlap_update
BEFORE UPDATE OF start_at, end_at, status, professional_id ON agenda_entries
FOR EACH ROW
WHEN NEW.status = 'confirmed'
BEGIN
  SELECT RAISE(ABORT, 'SLOT_CONFLICT')
  WHERE EXISTS (
    SELECT 1 FROM agenda_entries
    WHERE id != NEW.id
      AND professional_id = NEW.professional_id
      AND status = 'confirmed'
      AND start_at < NEW.end_at
      AND end_at > NEW.start_at
  );
END;

-- 6. REGISTRO DE IDEMPOTENCIA Y RECIBOS DE COMANDOS (S09 / P03)
CREATE TABLE IF NOT EXISTS command_results (
  actor_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  payload_fingerprint TEXT NOT NULL,
  http_status INTEGER NOT NULL,
  resource_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  version TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (actor_id, idempotency_key)
);

-- 7. EVENTOS DE AUDITORÍA SIN PII (S02 / S03)
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  version TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- 8. DATOS OPERACIONALES INICIALES
INSERT OR IGNORE INTO professionals (id, name, title, box_name, is_active) VALUES
  ('felipe', 'Felipe Méndez', 'Quiropráctico & Kinesiólogo', 'Box 1 Quiropraxia', 1),
  ('eduardo', 'Eduardo Lagos', 'Acupunturista & Medicina Tradicional China', 'Box 2 Acupuntura', 1);

INSERT OR IGNORE INTO team_members (email, role, is_active, created_at) VALUES
  ('centrovida.sanaaustral@gmail.com', 'admin', 1, 1730815200);
