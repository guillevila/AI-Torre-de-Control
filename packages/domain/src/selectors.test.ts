import { describe, expect, it } from 'vitest'
import {
  attentionQueue,
  EMPTY_FILTERS,
  filterTasks,
  groupOf,
  groupTasks,
  groupTasksByStatus,
  PROVIDER_COLORS,
  officeLabel,
  officeWorkers,
  STATUS_GLYPHS,
  summarise,
  zoneOf,
} from './selectors.js'
import { PROVIDERS } from '@torre/contracts'
import { makeTask } from './test-fixtures.js'

const at = (iso: string) => ({ lastActivityAt: iso, createdAt: iso })

describe('agrupación por estado', () => {
  it('manda a atención lo que reclama al usuario', () => {
    expect(groupOf('waiting_user')).toBe('attention')
    expect(groupOf('failed')).toBe('attention')
  })

  it('separa trabajando, desconocido, terminado y archivado', () => {
    expect(groupOf('running')).toBe('active')
    expect(groupOf('queued')).toBe('active')
    expect(groupOf('unknown')).toBe('unknown')
    expect(groupOf('completed')).toBe('completed')
    expect(groupOf('archived')).toBe('archived')
    expect(groupOf('draft')).toBe('draft')
  })

  it('reparte una lista mixta en sus grupos', () => {
    const groups = groupTasks([
      makeTask({ id: '1', status: 'running' }),
      makeTask({ id: '2', status: 'waiting_user' }),
      makeTask({ id: '3', status: 'completed' }),
      makeTask({ id: '4', status: 'unknown' }),
      makeTask({ id: '5', status: 'failed' }),
      makeTask({ id: '6', status: 'archived' }),
    ])

    expect(groups.active.map((t) => t.id)).toEqual(['1'])
    expect(groups.attention.map((t) => t.id).sort()).toEqual(['2', '5'])
    expect(groups.completed.map((t) => t.id)).toEqual(['3'])
    expect(groups.unknown.map((t) => t.id)).toEqual(['4'])
    expect(groups.archived.map((t) => t.id)).toEqual(['6'])
  })

  it('en atención pone primero la que lleva más tiempo esperando', () => {
    const groups = groupTasks([
      makeTask({ id: 'reciente', status: 'waiting_user', ...at('2026-05-01T10:00:00.000Z') }),
      makeTask({ id: 'olvidada', status: 'waiting_user', ...at('2026-01-01T10:00:00.000Z') }),
    ])
    expect(groups.attention.map((t) => t.id)).toEqual(['olvidada', 'reciente'])
  })
})

describe('secciones de la lista de tareas', () => {
  const tasks = [
    makeTask({ id: 'r', status: 'running' }),
    makeTask({ id: 'w', status: 'waiting_user' }),
    makeTask({ id: 'u', status: 'unknown' }),
    makeTask({ id: 'f', status: 'failed' }),
    makeTask({ id: 'c', status: 'completed' }),
    makeTask({ id: 'd', status: 'draft' }),
  ]

  it('ordena las secciones por urgencia', () => {
    expect(groupTasksByStatus(tasks).map((s) => s.status)).toEqual([
      'waiting_user',
      'unknown',
      'failed',
      'completed',
      'running',
      'draft',
    ])
  })

  it('no dibuja secciones vacías', () => {
    const solo = groupTasksByStatus([makeTask({ status: 'running' })])
    expect(solo).toHaveLength(1)
    expect(solo[0]?.status).toBe('running')
  })

  it('deja fuera lo archivado: eso vive en el Historial', () => {
    const secciones = groupTasksByStatus([makeTask({ id: 'a', status: 'archived' })])
    expect(secciones).toHaveLength(0)
  })
})

describe('cola del centro de atención', () => {
  it('ordena por lo que cuesta más caro ignorar', () => {
    const cola = attentionQueue([
      makeTask({ id: 'terminada', status: 'completed' }),
      makeTask({ id: 'error', status: 'failed' }),
      makeTask({ id: 'sinconfirmar', status: 'unknown' }),
      makeTask({ id: 'teespera', status: 'waiting_user' }),
    ])
    expect(cola.map((t) => t.id)).toEqual(['teespera', 'sinconfirmar', 'error', 'terminada'])
  })

  it('deja fuera lo que no reclama nada', () => {
    const cola = attentionQueue([
      makeTask({ id: 'r', status: 'running' }),
      makeTask({ id: 'q', status: 'queued' }),
      makeTask({ id: 'd', status: 'draft' }),
      makeTask({ id: 'a', status: 'archived' }),
    ])
    expect(cola).toHaveLength(0)
  })

  it('dentro del mismo estado, primero lo que lleva más tiempo parado', () => {
    const cola = attentionQueue([
      makeTask({ id: 'nueva', status: 'waiting_user', ...at('2026-05-01T10:00:00.000Z') }),
      makeTask({ id: 'vieja', status: 'waiting_user', ...at('2026-01-01T10:00:00.000Z') }),
    ])
    expect(cola.map((t) => t.id)).toEqual(['vieja', 'nueva'])
  })
})

describe('la oficina refleja el mismo estado que la lista (D10)', () => {
  const tasks = [
    makeTask({ id: 'a', status: 'running' }),
    makeTask({ id: 'b', status: 'waiting_user' }),
    makeTask({ id: 'c', status: 'completed' }),
    makeTask({ id: 'd', status: 'failed' }),
    makeTask({ id: 'e', status: 'unknown' }),
    makeTask({ id: 'f', status: 'archived' }),
    makeTask({ id: 'g', status: 'draft' }),
  ]

  it('coloca a cada uno en la zona que corresponde a su estado', () => {
    expect(zoneOf('waiting_user')).toBe('office')
    expect(zoneOf('completed')).toBe('delivery')
    expect(zoneOf('running')).toBe('work')
    expect(zoneOf('unknown')).toBe('work')
    expect(zoneOf('failed')).toBe('incidents')
    expect(zoneOf('queued')).toBe('reception')
    expect(zoneOf('draft')).toBe('reception')
  })

  it('lo archivado sale de la planta', () => {
    expect(zoneOf('archived')).toBeNull()
    expect(officeWorkers(tasks).map((w) => w.task.id)).not.toContain('f')
  })

  it('pone a alguien por cada tarea viva, borradores incluidos', () => {
    expect(officeWorkers(tasks).map((w) => w.task.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'g'])
  })

  it('cada estado visible tiene su propio glifo', () => {
    const glifos = Object.values(STATUS_GLYPHS)
    expect(new Set(glifos).size).toBe(glifos.length)
  })
})

describe('filtros', () => {
  const tasks = [
    makeTask({ id: '1', title: 'Informe de mercado', provider: 'chatgpt', status: 'running' }),
    makeTask({
      id: '2',
      title: 'Refactor del panel',
      provider: 'claude_code',
      status: 'completed',
      statusConfidence: 'low',
    }),
    makeTask({ id: '3', title: 'Tarea vieja', provider: 'chatgpt', status: 'archived' }),
  ]

  it('oculta las archivadas por defecto', () => {
    expect(filterTasks(tasks, EMPTY_FILTERS).map((t) => t.id)).toEqual(['1', '2'])
  })

  it('las muestra si se piden', () => {
    const result = filterTasks(tasks, { ...EMPTY_FILTERS, showArchived: true })
    expect(result.map((t) => t.id)).toEqual(['1', '2', '3'])
  })

  it('filtra por plataforma', () => {
    const result = filterTasks(tasks, { ...EMPTY_FILTERS, provider: 'claude_code' })
    expect(result.map((t) => t.id)).toEqual(['2'])
  })

  it('filtra por confianza: es la auditoría de lo que la app cree sin poder probarlo', () => {
    const result = filterTasks(tasks, { ...EMPTY_FILTERS, confidence: 'low' })
    expect(result.map((t) => t.id)).toEqual(['2'])
  })

  it('busca por texto sin distinguir mayúsculas', () => {
    expect(filterTasks(tasks, { ...EMPTY_FILTERS, search: 'REFACTOR' }).map((t) => t.id)).toEqual([
      '2',
    ])
  })

  it('la búsqueda también encuentra por nombre de plataforma', () => {
    expect(filterTasks(tasks, { ...EMPTY_FILTERS, search: 'claude' }).map((t) => t.id)).toEqual([
      '2',
    ])
  })
})

describe('resumen de cabecera', () => {
  it('cuenta cada estado por separado', () => {
    const resumen = summarise([
      makeTask({ id: '1', status: 'running' }),
      makeTask({ id: '2', status: 'waiting_user' }),
      makeTask({ id: '3', status: 'completed' }),
      makeTask({ id: '4', status: 'unknown' }),
      makeTask({ id: '5', status: 'failed' }),
      makeTask({ id: '6', status: 'archived' }),
    ])

    expect(resumen.running).toBe(1)
    expect(resumen.waiting).toBe(1)
    expect(resumen.completed).toBe(1)
    expect(resumen.unknown).toBe(1)
    expect(resumen.failed).toBe(1)
  })

  it('el contador de atención suma todo lo que espera una decisión tuya', () => {
    const resumen = summarise([
      makeTask({ id: '1', status: 'waiting_user' }),
      makeTask({ id: '2', status: 'unknown' }),
      makeTask({ id: '3', status: 'failed' }),
      makeTask({ id: '4', status: 'completed' }),
      makeTask({ id: '5', status: 'running' }),
    ])
    expect(resumen.attention).toBe(4)
  })

  it('excluye las archivadas del total', () => {
    const resumen = summarise([
      makeTask({ id: '1', status: 'running' }),
      makeTask({ id: '2', status: 'archived' }),
    ])
    expect(resumen.total).toBe(1)
  })
})

/**
 * La etiqueta que se lee bajo cada muñeco en la planta.
 *
 * El enlace titula sus tareas «Claude Code · nombre-del-proyecto». Como la
 * etiqueta mide 96 px, al recortarse solo se leía «Claude Code ·…» en todos los
 * muñecos: ocupaba sitio sin distinguir a ninguno del resto.
 */
describe('etiqueta del muñeco en la oficina', () => {
  it('enseña el proyecto, no la herramienta', () => {
    const task = makeTask({
      title: 'Claude Code · ai-torre-de-control',
      projectPath: 'c:/Users/x/Desarrollo/ai-torre-de-control',
    })
    expect(officeLabel(task)).toBe('ai-torre-de-control')
  })

  it('distingue dos proyectos que la herramienta titulaba igual', () => {
    const uno = makeTask({ title: 'Claude Code · tienda', projectPath: 'c:/dev/tienda' })
    const dos = makeTask({ title: 'Claude Code · facturas', projectPath: 'c:/dev/facturas' })
    expect(officeLabel(uno)).not.toBe(officeLabel(dos))
  })

  it('no se deja engañar por una barra final', () => {
    const task = makeTask({ title: 'x', projectPath: 'c:/dev/tienda/' })
    expect(officeLabel(task)).toBe('tienda')
  })

  it('se entiende con las barras de Windows', () => {
    const task = makeTask({ title: 'x', projectPath: String.raw`C:\Users\x\dev\tienda` })
    expect(officeLabel(task)).toBe('tienda')
  })

  it('una tarea registrada a mano conserva SU título', () => {
    const task = makeTask({ title: 'Informe trimestral', projectPath: null })
    expect(officeLabel(task)).toBe('Informe trimestral')
  })

  it('ante una ruta que no da nombre, se queda con el título', () => {
    const task = makeTask({ title: 'Informe trimestral', projectPath: '/' })
    expect(officeLabel(task)).toBe('Informe trimestral')
  })
})

/**
 * El color de la ropa en la oficina es LA HERRAMIENTA.
 *
 * Lo pidió el dueño del proyecto cuando ya tenía dos funcionando de verdad:
 * naranja para Claude, verde para ChatGPT. Antes fueron todos azules, y tenía
 * sentido mientras solo había una herramienta — el color no separaba nada.
 */
describe('color de cada herramienta', () => {
  it('Claude lleva su naranja', () => {
    expect(PROVIDER_COLORS.claude_code).toBe('#D97757')
  })

  it('ChatGPT lleva su verde, oscurecido para el papel', () => {
    // El verde de marca desentonaba: era el único color vivo de una paleta
    // deliberadamente apagada. Mismo tono, menos luz.
    expect(PROVIDER_COLORS.chatgpt).toBe('#0B7A62')
  })

  it('las tres herramientas de Anthropic comparten color', () => {
    // Comparten marca: lo que quieres saber de un vistazo es «esto es Claude».
    expect(PROVIDER_COLORS.claude_web).toBe(PROVIDER_COLORS.claude_code)
    expect(PROVIDER_COLORS.cowork).toBe(PROVIDER_COLORS.claude_code)
  })

  it('las dos casas NO se confunden entre sí', () => {
    expect(PROVIDER_COLORS.chatgpt).not.toBe(PROVIDER_COLORS.claude_code)
    expect(PROVIDER_COLORS.codex).not.toBe(PROVIDER_COLORS.claude_code)
  })

  it('Codex se hermana con ChatGPT sin ser el mismo', () => {
    expect(PROVIDER_COLORS.codex).not.toBe(PROVIDER_COLORS.chatgpt)
  })

  it('toda plataforma tiene color, para que ninguna salga sin ropa', () => {
    for (const provider of PROVIDERS) {
      expect(PROVIDER_COLORS[provider]).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })
})
