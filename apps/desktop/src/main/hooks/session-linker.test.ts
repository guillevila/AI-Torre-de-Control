import { beforeEach, describe, expect, it } from 'vitest'
import { InMemoryTaskRepository } from '../db/task-repository.js'
import { TaskService } from '../services/task-service.js'
import { SessionLinker } from './session-linker.js'

/**
 * Estos tests nacen de dos fallos reportados en el primer uso real:
 *
 *  - Abrir Claude Code en una subcarpeta creaba una tarea nueva en vez de
 *    reutilizar la del proyecto.
 *  - Una tarea cerrada a mano dejaba su carpeta sorda para siempre.
 */

let clock = 0
const now = () => new Date(Date.UTC(2026, 7, 4, 10, 0, clock++)).toISOString()
let ids = 0

let repository: InMemoryTaskRepository
let tasks: TaskService
let linker: SessionLinker

beforeEach(() => {
  clock = 0
  ids = 0
  repository = new InMemoryTaskRepository()
  tasks = new TaskService({ repository, now, newId: () => `task-${++ids}` })
  linker = new SessionLinker(tasks)
})

describe('encontrar la tarea de una sesión', () => {
  it('reutiliza la tarea con la carpeta exacta', () => {
    const existente = tasks.create({
      title: 'Mi proyecto',
      provider: 'claude_code',
      projectPath: 'C:/proyecto',
      status: 'running',
    })

    expect(linker.resolve('C:/proyecto', 'sesion-1').id).toBe(existente.id)
    expect(tasks.list()).toHaveLength(1)
  })

  it('tolera que la ruta venga escrita distinto', () => {
    const existente = tasks.create({
      title: 'Mi proyecto',
      provider: 'claude_code',
      projectPath: 'C:\\Proyecto\\',
      status: 'running',
    })

    expect(linker.resolve('c:/proyecto', null).id).toBe(existente.id)
  })

  it('REUTILIZA la del proyecto aunque la sesión arranque en una subcarpeta', () => {
    const proyecto = tasks.create({
      title: 'Mi proyecto',
      provider: 'claude_code',
      projectPath: 'C:/proyecto',
      status: 'running',
    })

    const encontrada = linker.resolve('C:/proyecto/apps/web', 'sesion-1')

    expect(encontrada.id).toBe(proyecto.id)
    expect(tasks.list()).toHaveLength(1)
  })

  it('con varias anidadas, elige la más específica', () => {
    tasks.create({
      title: 'Raíz',
      provider: 'claude_code',
      projectPath: 'C:/proyecto',
      status: 'running',
    })
    const web = tasks.create({
      title: 'Web',
      provider: 'claude_code',
      projectPath: 'C:/proyecto/apps/web',
      status: 'running',
    })

    expect(linker.resolve('C:/proyecto/apps/web/src', null).id).toBe(web.id)
  })

  it('no confunde proyectos con nombres parecidos', () => {
    tasks.create({
      title: 'Proyecto',
      provider: 'claude_code',
      projectPath: 'C:/proyecto',
      status: 'running',
    })

    const otra = linker.resolve('C:/proyecto-viejo', null)
    expect(otra.title).toContain('proyecto-viejo')
    expect(tasks.list()).toHaveLength(2)
  })

  it('la sesión manda sobre la carpeta si ya se conocía', () => {
    const porSesion = tasks.create({
      title: 'Otra cosa',
      provider: 'claude_code',
      projectPath: 'C:/otro-sitio',
      externalSessionId: 'sesion-conocida',
      status: 'running',
    })
    tasks.create({
      title: 'Mi proyecto',
      provider: 'claude_code',
      projectPath: 'C:/proyecto',
      status: 'running',
    })

    expect(linker.resolve('C:/proyecto', 'sesion-conocida').id).toBe(porSesion.id)
  })

  it('crea una tarea si no hay nada que encaje', () => {
    const nueva = linker.resolve('C:/algo/nuevo', 'sesion-1')
    expect(nueva.title).toBe('Claude Code · nuevo')
    expect(nueva.provider).toBe('claude_code')
    expect(nueva.status).toBe('running')
  })

  it('guarda el identificador de sesión la primera vez', () => {
    const existente = tasks.create({
      title: 'Mi proyecto',
      provider: 'claude_code',
      projectPath: 'C:/proyecto',
      status: 'running',
    })

    linker.resolve('C:/proyecto', 'sesion-nueva')
    expect(tasks.getById(existente.id)?.externalSessionId).toBe('sesion-nueva')
  })
})

describe('tareas cerradas a mano', () => {
  it('una tarea terminada a mano vuelve a trabajar si la sesión revive', () => {
    const tarea = tasks.create({
      title: 'Mi proyecto',
      provider: 'claude_code',
      projectPath: 'C:/proyecto',
      status: 'running',
    })
    // La cierras tú.
    tasks.changeStatus({ id: tarea.id, status: 'completed', source: 'manual' })

    // Vuelves a trabajar en esa carpeta: Claude Code avisa de que hay marcha.
    const encontrada = linker.resolve('C:/proyecto', 'sesion-2')
    expect(encontrada.id).toBe(tarea.id)

    const revivida = tasks.changeStatus({
      id: tarea.id,
      status: 'running',
      source: 'claude_hook',
      confidence: 'high',
    })
    expect(revivida.status).toBe('running')
    expect(tasks.list()).toHaveLength(1)
  })

  it('pero una señal automática NO puede darla por terminada tras cerrarla tú', () => {
    const tarea = tasks.create({
      title: 'Mi proyecto',
      provider: 'claude_code',
      projectPath: 'C:/proyecto',
      status: 'running',
    })
    tasks.changeStatus({ id: tarea.id, status: 'failed', source: 'manual' })

    expect(() =>
      tasks.changeStatus({ id: tarea.id, status: 'completed', source: 'claude_hook' }),
    ).toThrow()
  })

  it('las archivadas no se reutilizan: se crea una nueva', () => {
    const tarea = tasks.create({
      title: 'Mi proyecto',
      provider: 'claude_code',
      projectPath: 'C:/proyecto',
      status: 'running',
    })
    tasks.changeStatus({ id: tarea.id, status: 'archived', source: 'manual' })

    const nueva = linker.resolve('C:/proyecto', 'sesion-2')
    expect(nueva.id).not.toBe(tarea.id)
  })
})
