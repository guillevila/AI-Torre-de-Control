import { dirname } from 'node:path'
import { mkdirSync } from 'node:fs'
import sqlite from 'node-sqlite3-wasm'
import { taskSchema, type Task } from '@torre/contracts'
import { MIGRATIONS } from './schema.js'
import type { TaskRepository } from './task-repository.js'

const { Database } = sqlite

type Cell = string | number | bigint | Uint8Array | null | undefined
type Row = Record<string, Cell>

/** Lee una columna de texto tolerando null. */
const text = (value: Cell): string | null =>
  value === null || value === undefined ? null : String(value)

/** Lee una columna de texto que la base de datos declara NOT NULL. */
const required = (value: Cell): string => String(value ?? '')

/**
 * Persistencia real en un fichero SQLite.
 *
 * Se usa `node-sqlite3-wasm`: SQLite compilado a WebAssembly. Escribe un fichero
 * `.db` estándar (se puede abrir con cualquier herramienta de SQLite) pero no
 * necesita compilarse en el ordenador del usuario. Ver ADR-002.
 */
export class SqliteTaskRepository implements TaskRepository {
  private readonly db: InstanceType<typeof Database>

  constructor(filePath: string) {
    mkdirSync(dirname(filePath), { recursive: true })
    this.db = new Database(filePath)
    this.db.run('PRAGMA foreign_keys = ON')
    this.migrate()
  }

  /**
   * Aplica solo las migraciones que falten, usando el número de versión que
   * SQLite guarda dentro del propio fichero.
   */
  private migrate(): void {
    const row = this.db.get('PRAGMA user_version') as Row | null
    const current = Number(row?.['user_version'] ?? 0)

    for (let version = current; version < MIGRATIONS.length; version += 1) {
      const migration = MIGRATIONS[version]
      if (!migration) continue
      this.db.exec(migration)
      // PRAGMA no admite parámetros, y el valor es un entero que controlamos
      // nosotros (nunca viene de fuera), así que interpolarlo es seguro aquí.
      this.db.exec(`PRAGMA user_version = ${version + 1}`)
    }
  }

  list(): Task[] {
    const rows = this.db.all(
      `SELECT * FROM tasks ORDER BY last_activity_at DESC`,
    ) as unknown as Row[]
    return rows.map((row) => this.toTask(row)).filter((task): task is Task => task !== null)
  }

  findById(id: string): Task | null {
    const row = this.db.get(`SELECT * FROM tasks WHERE id = ?`, [id]) as unknown as Row | null
    return row ? this.toTask(row) : null
  }

  save(task: Task): void {
    this.db.run(
      `INSERT INTO tasks (
         id, title, provider, external_url, external_session_id, project_path,
         status, status_source, status_confidence,
         started_at, finished_at, last_activity_at, created_at, updated_at, notes
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title               = excluded.title,
         provider            = excluded.provider,
         external_url        = excluded.external_url,
         external_session_id = excluded.external_session_id,
         project_path        = excluded.project_path,
         status              = excluded.status,
         status_source       = excluded.status_source,
         status_confidence   = excluded.status_confidence,
         started_at          = excluded.started_at,
         finished_at         = excluded.finished_at,
         last_activity_at    = excluded.last_activity_at,
         updated_at          = excluded.updated_at,
         notes               = excluded.notes`,
      [
        task.id,
        task.title,
        task.provider,
        task.externalUrl,
        task.externalSessionId,
        task.projectPath,
        task.status,
        task.statusSource,
        task.statusConfidence,
        task.startedAt,
        task.finishedAt,
        task.lastActivityAt,
        task.createdAt,
        task.updatedAt,
        task.notes,
      ],
    )
  }

  close(): void {
    if (this.db.isOpen) this.db.close()
  }

  /**
   * Convierte una fila de la base de datos en una tarea validada.
   *
   * Si una fila estuviera corrupta (por una edición manual del fichero, por
   * ejemplo) se descarta con un aviso en lugar de tumbar la aplicación entera:
   * es preferible perder una tarea que no poder abrir la torre de control.
   */
  private toTask(row: Row): Task | null {
    const candidate = {
      id: required(row['id']),
      title: required(row['title']),
      provider: required(row['provider']),
      externalUrl: text(row['external_url']),
      externalSessionId: text(row['external_session_id']),
      projectPath: text(row['project_path']),
      status: required(row['status']),
      statusSource: required(row['status_source']),
      statusConfidence: required(row['status_confidence']),
      startedAt: text(row['started_at']),
      finishedAt: text(row['finished_at']),
      lastActivityAt: required(row['last_activity_at']),
      createdAt: required(row['created_at']),
      updatedAt: required(row['updated_at']),
      notes: text(row['notes']),
    }

    const parsed = taskSchema.safeParse(candidate)
    if (!parsed.success) {
      console.warn(
        `[torre] Fila de tarea descartada por no cumplir el modelo (id=${candidate.id}):`,
        parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
      )
      return null
    }
    return parsed.data
  }
}
