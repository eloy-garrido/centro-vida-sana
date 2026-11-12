-- ============================================================================
-- Centro Vida Sana Austral — Migración 0003: Ficha y Notas de Evolución
-- ============================================================================

CREATE TABLE IF NOT EXISTS patient_notes (
  id TEXT PRIMARY KEY,
  patient_key TEXT NOT NULL,
  booking_id TEXT NULL REFERENCES agenda_entries(id) ON DELETE SET NULL,
  professional_id TEXT NOT NULL CHECK (professional_id IN ('felipe', 'eduardo')),
  author_user_id TEXT NOT NULL REFERENCES users(id),
  author_name TEXT NOT NULL,
  encrypted_content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_patient_notes_lookup
  ON patient_notes (patient_key, created_at DESC);
