-- ============================================================================
-- Centro Vida Sana Austral — Migración 0002: Verificación de Asistencia
-- ============================================================================

ALTER TABLE agenda_entries ADD COLUMN attendance_status TEXT NOT NULL DEFAULT 'attended' CHECK (attendance_status IN ('attended', 'no_show', 'pending'));
ALTER TABLE agenda_entries ADD COLUMN attendance_updated_at INTEGER NULL;
ALTER TABLE agenda_entries ADD COLUMN attendance_updated_by TEXT NULL REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_agenda_entries_attendance
  ON agenda_entries (attendance_status, professional_id, start_at);
