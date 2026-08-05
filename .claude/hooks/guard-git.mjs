/**
 * guard-git.mjs — Guardia de comandos de Git peligrosos.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ ESTÁ EN NODE Y NO EN BASH
 *
 * El encargo original pedía un `scripts/guard-git-command.sh`. En este equipo
 * eso no funcionaría: los cinco hooks del proyecto estuvieron rotos en silencio
 * durante semanas por estar escritos en bash y python, que no están disponibles
 * de forma fiable en Windows. Está documentado en la lección del 3/8/2026.
 *
 * Node sí está garantizado —la aplicación entera corre sobre él— así que la
 * guardia vive donde se puede confiar en que se ejecute. Un guardián que no
 * arranca es peor que no tener guardián: da una sensación de protección falsa.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Este módulo NO decide por su cuenta: exporta una función pura que dice si un
 * comando debe bloquearse y por qué. Quien la usa es `pre-tool-use.mjs`, y así
 * la lógica se puede probar sin lanzar un hook.
 */

/**
 * Nombres que tratamos como rama principal.
 *
 * En este repositorio es `master`. Se incluye `main` porque es lo habitual en
 * otros sitios y porque nadie debería tener que acordarse de actualizar esto si
 * algún día se renombra.
 */
const RAMAS_PRINCIPALES = ['main', 'master']

const PATRON_PRINCIPALES = RAMAS_PRINCIPALES.join('|')

/**
 * Reconoce una rama que ES la principal, no una que la contiene.
 *
 * `\bmaster\b` no vale: `fix/main-menu` tiene «main» como palabra completa —el
 * guion cuenta como frontera— y bloquearía una rama de trabajo perfectamente
 * legítima. Lo encontró la propia prueba.
 *
 * Aquí se exige que el nombre sea un argumento entero: antes va un espacio o
 * dos puntos (`HEAD:master`), y detrás se acaba el argumento. Así
 * `integration/loquesea-into-master` y `feature/mastermind` pasan sin ruido.
 */
const REF_PRINCIPAL = `(?<=[\\s:])(?:${PATRON_PRINCIPALES})(?=\\s|$)`

/**
 * Reglas de bloqueo, en orden. Cada una explica QUÉ pasa y QUÉ hacer.
 *
 * El mensaje importa tanto como el bloqueo: un guardián que solo dice «no»
 * acaba desactivado. Cada motivo termina diciendo la alternativa buena.
 */
const REGLAS = [
  {
    nombre: 'push directo a la rama principal',
    // `git push origin master`, `git push origin HEAD:master`, `git push -u origin main`…
    patron: new RegExp(`\\bgit\\s+push\\b[^\\n]*${REF_PRINCIPAL}`, 'i'),
    motivo:
      'Esto empuja directamente a la rama principal, y esa rama solo se toca por Pull Request.',
    alternativa:
      'Sube tu rama de trabajo (`git push -u origin mi-rama`) y abre una Pull Request hacia master.',
  },
  {
    nombre: 'force push',
    patron: /\bgit\s+push\b[^\n]*?(--force(?!-with-lease)|--force-with-lease|\s-f\b)/i,
    motivo:
      'Un force push reescribe la historia del repositorio. Si otra persona ya se había traído esos commits, los pierde sin aviso.',
    alternativa:
      'Haz un commit nuevo encima. Si de verdad hace falta reescribir, pídelo de forma explícita y hazlo tú a mano.',
  },
  {
    nombre: 'reset --hard',
    patron: /\bgit\s+reset\s+(?:[^\n]*\s)?--hard\b/i,
    motivo: 'Un `reset --hard` tira a la basura cambios sin guardar, sin preguntar y sin vuelta atrás.',
    alternativa:
      'Usa `git stash` para apartarlos, o `git restore <fichero>` para revertir solo lo que quieras.',
  },
  {
    nombre: 'borrar la rama principal',
    patron: new RegExp(
      `\\bgit\\s+(?:branch\\s+[^\\n]*(?:-D|-d|--delete)|push\\s+[^\\n]*--delete)[^\\n]*${REF_PRINCIPAL}`,
      'i',
    ),
    motivo: 'Se está intentando borrar la rama principal del proyecto.',
    alternativa: 'No hay ninguna alternativa: eso no se hace.',
  },
  {
    nombre: 'resolver TODOS los conflictos de golpe',
    // `git checkout --ours .`, `git checkout --theirs -- .`, y la variante con `restore`.
    patron: /\bgit\s+(?:checkout|restore)\s+[^\n]*--(?:ours|theirs)\b[^\n]*(?:\s\.|\s--\s\.|\s\*)\s*$/i,
    motivo:
      'Esto resuelve TODOS los conflictos escogiendo un lado en bloque, sin mirar ninguno. Es la forma más rápida de borrar el trabajo de otra persona sin enterarse.',
    alternativa:
      'Resuelve fichero a fichero. Si un conflicto concreto se resuelve así, dilo con su ruta: `git checkout --ours ruta/al/fichero`.',
  },
]

/**
 * Reglas que solo se aplican si estamos EN la rama principal.
 *
 * Fusionar o reasentar es perfectamente normal en una rama de trabajo; hacerlo
 * estando en master es escribir en la rama principal sin pasar por una PR.
 */
const REGLAS_EN_PRINCIPAL = [
  {
    nombre: 'merge o rebase estando en la rama principal',
    patron: /\bgit\s+(?:merge|rebase)\b/i,
    motivo:
      'Estás EN la rama principal. Fusionar aquí escribe en master directamente, saltándose la revisión.',
    alternativa:
      'Cámbiate a una rama de integración (`git checkout -b integration/...`), fusiona ahí y abre una Pull Request.',
  },
]

/** Comandos de solo lectura que nunca se bloquean, pase lo que pase. */
const SIEMPRE_PERMITIDO =
  /^\s*git\s+(status|log|diff|show|branch\s*(-a|-r|-v|--list)?\s*$|remote|fetch|ls-files|rev-parse|describe|blame|shortlog|config\s+--get)/i

/**
 * ¿Hay que bloquear este comando?
 *
 * @param {string} comando El comando tal cual se va a ejecutar.
 * @param {string|null} ramaActual En qué rama estamos, si se sabe.
 * @returns {{bloquear: boolean, nombre?: string, motivo?: string, alternativa?: string}}
 */
export function revisarComandoGit(comando, ramaActual = null) {
  const texto = String(comando ?? '')
  if (!texto.trim()) return { bloquear: false }

  // Consultar el estado del repositorio jamás es peligroso.
  if (SIEMPRE_PERMITIDO.test(texto)) return { bloquear: false }

  for (const regla of REGLAS) {
    if (regla.patron.test(texto)) {
      return { bloquear: true, nombre: regla.nombre, motivo: regla.motivo, alternativa: regla.alternativa }
    }
  }

  if (ramaActual && RAMAS_PRINCIPALES.includes(ramaActual)) {
    for (const regla of REGLAS_EN_PRINCIPAL) {
      if (regla.patron.test(texto)) {
        return {
          bloquear: true,
          nombre: regla.nombre,
          motivo: `${regla.motivo} (rama actual: ${ramaActual})`,
          alternativa: regla.alternativa,
        }
      }
    }
  }

  return { bloquear: false }
}

/** Texto que se le enseña a quien intentó ejecutarlo. */
export function explicar(resultado) {
  return [
    `🛑 BLOQUEADO: ${resultado.nombre}.`,
    '',
    resultado.motivo,
    '',
    `Qué hacer en su lugar: ${resultado.alternativa}`,
    '',
    'Si de verdad hace falta, pídeselo al dueño del proyecto y que lo ejecute él a mano.',
  ].join('\n')
}

export const RAMAS_PRINCIPALES_CONOCIDAS = RAMAS_PRINCIPALES
