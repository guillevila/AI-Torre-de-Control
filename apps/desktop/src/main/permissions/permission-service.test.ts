import { beforeEach, describe, expect, it } from 'vitest'
import { InMemoryTaskRepository } from '../db/task-repository.js'
import { HookActivityLog } from '../hooks/hook-activity-log.js'
import { SessionLinker } from '../hooks/session-linker.js'
import { TaskService } from '../services/task-service.js'
import { PermissionRegistry } from './permission-registry.js'
import { PermissionService } from './permission-service.js'

/**
 * El modo desatendido (D24) es el único punto de la aplicación donde la Torre
 * decide en lugar del usuario. Estos tests fijan las cuatro cosas que tienen que
 * cumplirse para que eso sea aceptable:
 *
 *  1. Apagado, se comporta exactamente como antes: espera tu clic.
 *  2. Encendido, contesta «sí» sin esperar a nadie.
 *  3. Encendido, la tarea NO pasa por «te espera» — si nadie espera, nadie avisa.
 *     Sin esto llovería una notificación de Windows por cada permiso.
 *  4. Encendido, queda registrado QUÉ se aprobó. Si la Torre decide por ti, como
 *     mínimo tienes que poder verlo.
 */

let clock = 0
const now = () => new Date(Date.UTC(2026, 7, 4, 10, 0, clock++)).toISOString()
let ids = 0

let repository: InMemoryTaskRepository
let tasks: TaskService
let linker: SessionLinker
let registry: PermissionRegistry
let activity: HookActivityLog
/** Interruptor del modo desatendido, cambiable dentro de cada test. */
let desatendido: boolean

function crearServicio(): PermissionService {
  return new PermissionService({
    registry,
    linker,
    taskService: tasks,
    activity,
    now,
    autoApprove: () => desatendido,
  })
}

/** Una petición válida, con la forma exacta que exige el contrato. */
function peticion(overrides: Record<string, unknown> = {}) {
  return {
    requestId: 'peticion-0001',
    sessionId: 'sesion-1',
    cwd: 'C:/proyecto',
    toolName: 'Edit',
    detail: 'Escribir en src/index.ts',
    timestamp: now(),
    ...overrides,
  }
}

beforeEach(() => {
  clock = 0
  ids = 0
  desatendido = false
  repository = new InMemoryTaskRepository()
  tasks = new TaskService({ repository, now, newId: () => `task-${++ids}` })
  linker = new SessionLinker(tasks)
  registry = new PermissionRegistry({})
  activity = new HookActivityLog()
})

describe('modo desatendido apagado (comportamiento por defecto)', () => {
  it('no resuelve sola: la petición se queda esperando una decisión', async () => {
    const servicio = crearServicio()

    let resuelta = false
    void servicio.request(peticion()).then(() => {
      resuelta = true
    })

    // Se cede el turno al bucle de eventos: si el servicio fuera a resolver sola,
    // ya lo habría hecho aquí.
    await Promise.resolve()
    await Promise.resolve()

    expect(resuelta).toBe(false)
    expect(registry.list()).toHaveLength(1)
  })

  it('deja la tarea en «te espera», que es lo que dispara el aviso', async () => {
    const servicio = crearServicio()
    void servicio.request(peticion())
    await Promise.resolve()
    await Promise.resolve()

    const tarea = tasks.list()[0]
    expect(tarea?.status).toBe('waiting_user')
  })

  it('un servicio construido sin el parámetro tampoco aprueba solo', async () => {
    // Importa porque es la garantía de que D24 es opt-in: si alguien construye el
    // servicio sin pensar en el modo desatendido, no lo activa por descuido.
    const servicio = new PermissionService({ registry, linker, taskService: tasks, activity, now })

    let resuelta = false
    void servicio.request(peticion()).then(() => {
      resuelta = true
    })
    await Promise.resolve()
    await Promise.resolve()

    expect(resuelta).toBe(false)
  })
})

describe('modo desatendido encendido (D24)', () => {
  beforeEach(() => {
    desatendido = true
  })

  it('aprueba al momento, sin esperar a nadie', async () => {
    const servicio = crearServicio()

    const resolucion = await servicio.request(peticion())

    expect(resolucion.outcome).toBe('allow')
    expect(resolucion.reason).toContain('automáticamente')
  })

  it('no deja ninguna petición pendiente en pantalla', async () => {
    const servicio = crearServicio()
    await servicio.request(peticion())

    expect(registry.list()).toHaveLength(0)
  })

  it('la tarea NUNCA pasa por «te espera»: nadie espera, así que nadie avisa', async () => {
    const servicio = crearServicio()
    await servicio.request(peticion())

    const tarea = tasks.list()[0]
    expect(tarea?.status).toBe('running')

    // Y no basta con acabar en «running»: el historial no debe contener ni un
    // paso por «te espera», porque ese paso es el que notifica a Windows.
    const historial = tasks.history(tarea!.id)
    expect(historial.map((entrada) => entrada.toStatus)).not.toContain('waiting_user')
  })

  it('registra qué aprobó, con el comando entero', async () => {
    const servicio = crearServicio()
    await servicio.request(peticion({ detail: 'rm -rf build' }))

    const registrado = activity.list().find((entrada) => entrada.detail.includes('rm -rf build'))
    expect(registrado).toBeDefined()
    expect(registrado?.detail).toContain('aprobado solo')
    expect(registrado?.accepted).toBe(true)
  })

  it('apagar el interruptor surte efecto en la petición siguiente, sin reiniciar', async () => {
    const servicio = crearServicio()
    await servicio.request(peticion())
    expect(registry.list()).toHaveLength(0)

    desatendido = false

    let resuelta = false
    void servicio.request(peticion({ requestId: 'peticion-0002' })).then(() => {
      resuelta = true
    })
    await Promise.resolve()
    await Promise.resolve()

    expect(resuelta).toBe(false)
    expect(registry.list()).toHaveLength(1)
  })

  it('una petición mal formada sigue devolviendo timeout, no un «sí» automático', async () => {
    // El modo desatendido no debe convertirse en un «sí» a cualquier cosa que
    // llegue al puerto: lo que no cumple el contrato se sigue rechazando.
    const servicio = crearServicio()

    const resolucion = await servicio.request({ requestId: 'x', cwd: 42 })

    expect(resolucion.outcome).toBe('timeout')
  })
})
