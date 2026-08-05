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

  // ── v3 — cuenta o espacio de trabajo ───────────────────────────────────────
  //
  // Nace de un uso real: varios chats de ChatGPT de una cuenta y otros de otra,
  // abiertos a la vez. Todos caben en la Torre, pero sin esto se ven iguales.
  //
  // Es una etiqueta que escribe el usuario, una vez por perfil de navegador. La
  // aplicación NUNCA la deduce leyendo la página: no sabe con qué cuenta estás
  // ni tiene forma de averiguarlo.
  //
  // Las tareas que ya existían se quedan sin cuenta (NULL), que es la verdad:
  // nadie dijo a cuál pertenecían.
  `
  ALTER TABLE tasks ADD COLUMN account TEXT;
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
