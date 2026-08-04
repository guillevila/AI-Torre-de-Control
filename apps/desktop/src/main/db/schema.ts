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

  // ── v2 — historial de estados (decisión D19) ───────────────────────────────
  //
  // Una fila por cada cambio de estado. Es lo que permite responder «¿desde
  // cuándo lleva esperándome?» y «¿quién dijo que había terminado?».
  //
  // Las tareas que ya existían cuando se añadió esta tabla no tienen historial
  // previo: su primera línea será su próximo cambio. Es correcto y honesto —
  // inventar un historial retroactivo sería justo lo contrario de lo que esta
  // tabla existe para garantizar.
  `
  CREATE TABLE IF NOT EXISTS task_status_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id     TEXT NOT NULL,
    from_status TEXT,
    to_status   TEXT NOT NULL,
    source      TEXT NOT NULL,
    confidence  TEXT NOT NULL,
    at          TEXT NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_history_task ON task_status_history (task_id, at DESC);
  CREATE INDEX IF NOT EXISTS idx_history_at ON task_status_history (at DESC);
  `,

  // ── v3 — la conversación de la tarea, ¿ha terminado? (D23-bis) ─────────────
  //
  // Es lo que permite reciclar el muñeco cuando cierras una sesión y abres
  // otra en la misma carpeta, en vez de acumular uno por reinicio.
  //
  // Las tareas que ya existían se marcan como TERMINADAS (DEFAULT 1) a
  // propósito: casi todas vienen de sesiones ya cerradas, y si alguna sigue
  // viva se corrige sola con su siguiente señal, que siempre marca la
  // conversación como viva. El error en el otro sentido —marcar viva una
  // muerta— no se corregiría nunca, porque una sesión cerrada ya no habla.
  `
  ALTER TABLE tasks ADD COLUMN session_ended INTEGER NOT NULL DEFAULT 1;
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
