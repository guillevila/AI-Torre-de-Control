import { describe, expect, it } from 'vitest'
import { folderName, isWithinPath, normalizeProjectPath, pathDepth, samePath } from './paths.js'

describe('normalizar rutas', () => {
  it('iguala barras, mayúsculas y barra final', () => {
    expect(normalizeProjectPath('C:\\Proyectos\\Torre\\')).toBe('c:/proyectos/torre')
    expect(normalizeProjectPath('  c:/Proyectos/Torre  ')).toBe('c:/proyectos/torre')
  })

  it('casa la misma carpeta escrita de formas distintas', () => {
    expect(samePath('C:\\Proyectos\\Torre', 'c:/proyectos/torre/')).toBe(true)
  })

  it('no casa carpetas distintas', () => {
    expect(samePath('C:/a', 'C:/b')).toBe(false)
    expect(samePath(null, 'C:/a')).toBe(false)
  })
})

describe('sesiones lanzadas desde una subcarpeta', () => {
  it('reconoce que la subcarpeta está dentro del proyecto', () => {
    expect(isWithinPath('C:/proyecto', 'C:/proyecto/apps/web')).toBe(true)
    expect(isWithinPath('C:\\proyecto', 'c:/PROYECTO/apps')).toBe(true)
  })

  it('la misma carpeta cuenta como dentro', () => {
    expect(isWithinPath('C:/proyecto', 'C:/proyecto')).toBe(true)
  })

  it('no confunde carpetas que solo comparten el principio del nombre', () => {
    // Este es el caso que se escapa si se compara con startsWith a secas.
    expect(isWithinPath('C:/proyecto', 'C:/proyecto-viejo')).toBe(false)
    expect(isWithinPath('C:/proyecto', 'C:/proyectos')).toBe(false)
  })

  it('no considera al padre dentro del hijo', () => {
    expect(isWithinPath('C:/proyecto/apps', 'C:/proyecto')).toBe(false)
  })

  it('la profundidad permite elegir la coincidencia más específica', () => {
    expect(pathDepth('C:/proyecto')).toBe(2)
    expect(pathDepth('C:/proyecto/apps/web')).toBe(4)
  })
})

describe('nombre para una tarea creada sola', () => {
  it('usa el nombre de la carpeta', () => {
    expect(folderName('C:\\Users\\x\\Desktop\\Mi Proyecto')).toBe('mi proyecto')
    expect(folderName('/home/x/proyecto/')).toBe('proyecto')
  })
})
