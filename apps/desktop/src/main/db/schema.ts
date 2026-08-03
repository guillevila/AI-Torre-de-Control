/**
 * Esquema de la base de datos y sus migraciones.
 *
 * El control de versión se lleva con `PRAGMA user_version`, que es un número
 * que SQLite guarda dentro del propio fichero. Al arrancar se aplican solo las
 * migraciones que falten, así que abrir una base de datos antigua la pone al día
 * sin perder nada.
 *
 * Regla: una migración publicada NO se edita nunca. Se añade otra debajo.
 */
export const MIGRATIONS: readonly string[] = [
  // ── v1 — tabla de tareas ───────────────────────────────────────────────────
  `
  CREATE TABLE IF NOT EXISTS tasks (
    id                  TEXT PRIMARY KEY,
    title               TEXT NOT NULL,
    provider            TEXT NOT NULL,
    external_url        TEXT,
    external_session_id TEXT,
    project_path        TEXT,
    status              TEXT NOT NULL,
    status_source       TEXT NOT NULL,
    status_confidence   TEXT NOT NULL,
    started_at          TEXT,
    finished_at         TEXT,
    last_activity_at    TEXT NOT NULL,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL,
    notes               TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);
  CREATE INDEX IF NOT EXISTS idx_tasks_activity ON tasks (last_activity_at DESC);
  `,
]

/**
 * Nota de privacidad (D5): esta tabla no tiene ninguna columna capaz de guardar
 * el contenido de una conversación. `notes` es un campo que solo escribe el
 * usuario a mano; la aplicación nunca lo rellena con datos de la herramienta
 * externa. Hay un test que vigila que no aparezcan columnas prohibidas.
 */
export const FORBIDDEN_COLUMNS: readonly string[] = [
  'prompt',
  'response',
  'output',
  'messages',
  'transcript',
  'content',
  'conversation',
]
