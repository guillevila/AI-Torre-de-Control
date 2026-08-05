import { describe, expect, it } from 'vitest'
import { revisarComandoGit } from './guard-git.mjs'

/**
 * Pruebas de la guardia de Git.
 *
 * Un guardián sin probar es peor que no tener guardián: da sensación de
 * protección sin darla. Y este proyecto ya sabe lo que cuesta —los cinco hooks
 * estuvieron rotos en silencio durante semanas.
 *
 * Se prueban las dos mitades por igual: lo que TIENE que bloquear, y lo que
 * NUNCA debe bloquear. La segunda importa más de lo que parece: un guardián que
 * estorba en el trabajo normal acaba desactivado, y entonces no protege nada.
 */

const bloquea = (comando, rama = 'feature/algo') =>
  revisarComandoGit(comando, rama).bloquear

describe('protege la rama principal', () => {
  it('bloquea el push directo a master', () => {
    expect(bloquea('git push origin master')).toBe(true)
    expect(bloquea('git push origin main')).toBe(true)
    expect(bloquea('git push -u origin master')).toBe(true)
  })

  it('bloquea empujar a master desde otro nombre', () => {
    expect(bloquea('git push origin HEAD:master')).toBe(true)
  })

  it('bloquea borrar la rama principal', () => {
    expect(bloquea('git branch -D master')).toBe(true)
    expect(bloquea('git branch --delete main')).toBe(true)
    expect(bloquea('git push origin --delete master')).toBe(true)
  })
})

describe('protege la historia del repositorio', () => {
  it('bloquea el force push en todas sus formas', () => {
    expect(bloquea('git push --force origin mi-rama')).toBe(true)
    expect(bloquea('git push -f origin mi-rama')).toBe(true)
    // También `--force-with-lease`: es más educado, pero sigue reescribiendo.
    expect(bloquea('git push --force-with-lease origin mi-rama')).toBe(true)
  })

  it('bloquea reset --hard', () => {
    expect(bloquea('git reset --hard')).toBe(true)
    expect(bloquea('git reset --hard HEAD~3')).toBe(true)
    expect(bloquea('git reset --hard origin/master')).toBe(true)
  })
})

describe('protege el trabajo de la otra persona', () => {
  it('bloquea resolver TODOS los conflictos escogiendo un lado', () => {
    expect(bloquea('git checkout --ours .')).toBe(true)
    expect(bloquea('git checkout --theirs .')).toBe(true)
    expect(bloquea('git checkout --ours -- .')).toBe(true)
    expect(bloquea('git restore --theirs .')).toBe(true)
  })

  it('pero SÍ deja resolver un fichero concreto', () => {
    // Resolver con criterio, fichero a fichero, es exactamente lo que se quiere.
    expect(bloquea('git checkout --ours packages/domain/src/selectors.ts')).toBe(false)
    expect(bloquea('git checkout --theirs apps/desktop/src/main/index.ts')).toBe(false)
  })
})

describe('fusionar depende de dónde estés', () => {
  it('estando en master, bloquea merge y rebase', () => {
    expect(bloquea('git merge feature/algo', 'master')).toBe(true)
    expect(bloquea('git rebase origin/master', 'main')).toBe(true)
  })

  it('en una rama de trabajo es lo normal y se permite', () => {
    expect(bloquea('git merge origin/master', 'feature/algo')).toBe(false)
    expect(bloquea('git rebase origin/master', 'integration/a-into-master')).toBe(false)
  })

  it('si no se sabe en qué rama estamos, no se bloquea', () => {
    // Bloquear por no saber sería peor que dejar pasar: rompería el trabajo
    // normal cada vez que git no conteste.
    expect(revisarComandoGit('git merge algo', null).bloquear).toBe(false)
  })
})

describe('NO estorba en el trabajo normal', () => {
  const permitidos = [
    'git status',
    'git log --oneline -10',
    'git diff master',
    'git fetch origin',
    'git branch -a',
    'git checkout -b feature/nueva-cosa',
    'git add -A',
    'git commit -m "feat: algo"',
    'git push -u origin feature/nueva-cosa',
    'git push origin fix/un-fallo',
    'git push origin chore/limpieza',
    'git push origin integration/rama-into-master',
    'git stash push -m "apartado"',
    'git restore packages/domain/src/urls.ts',
    'git rev-parse --abbrev-ref HEAD',
  ]

  for (const comando of permitidos) {
    it(`permite: ${comando}`, () => {
      expect(bloquea(comando)).toBe(false)
    })
  }

  it('no se confunde con ramas que solo CONTIENEN el nombre', () => {
    // `feature/mastermind` no es `master`.
    expect(bloquea('git push origin feature/mastermind')).toBe(false)
    expect(bloquea('git push origin fix/main-menu')).toBe(false)
  })

  it('no bloquea comandos que no son de git', () => {
    expect(bloquea('pnpm test')).toBe(false)
    expect(bloquea('node scripts/send-test-event.mjs')).toBe(false)
  })
})

describe('el mensaje explica qué hacer, no solo que no', () => {
  it('dice el motivo y la alternativa', () => {
    const resultado = revisarComandoGit('git push origin master', 'master')
    expect(resultado.motivo).toBeTruthy()
    expect(resultado.alternativa).toContain('Pull Request')
  })
})
