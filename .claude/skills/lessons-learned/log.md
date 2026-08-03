# Lessons Learned — Log de lecciones aprendidas

> Este archivo es la memoria persistente del proyecto.
> Claude lo lee al inicio de cada sesión para no repetir errores.
> **No borrar entradas antiguas** — son el historial de aprendizaje.

---

## Cómo añadir una lección

Di a Claude: `/nueva-leccion`
O directamente: *"Anota esto como lección aprendida: [descripción]"*

## Formato estándar

```markdown
## YYYY-MM-DD HH:MM — [Título corto]

**Error o aprendizaje:** [Qué pasó]
**Causa raíz:** [Por qué ocurrió]
**Lección:** [Qué hacer diferente en el futuro]
**Contexto:** [Dónde aplica — siempre, en ciertos módulos, etc.]
```

---

<!-- Las lecciones se añaden debajo de esta línea -->

## 2026-08-03 13:50 — Una dependencia nativa no está elegida hasta que se instala

**Error o aprendizaje:** Se planificó el sprint con `better-sqlite3` como motor de
base de datos, por ser el estándar del ecosistema. Al ejecutar `pnpm install`
falló: no había binario precompilado para Node 24, intentó compilarse desde el
código fuente y pidió Python y las herramientas de compilación de Visual Studio,
que no estaban en el equipo.

**Causa raíz:** Se dio por buena una dependencia con módulos nativos basándose en
su popularidad, sin haber ejecutado la instalación en el equipo objetivo. La
popularidad no dice nada sobre si compilará en TU máquina con TU versión de Node.

**Lección:**
1. Cualquier dependencia que compile código nativo se **prueba instalándola**
   antes de escribir una línea que dependa de ella, y se prueba pronto.
2. En proyectos de un dueño no técnico, una dependencia que exige herramientas de
   compilación es un problema de producto, no solo técnico: convierte
   «instalarlo» en una tarde de configuración. Preferir siempre la alternativa
   que no compile nada, aunque sea menos popular.
3. Lo que salvó el sprint fue tener la base de datos detrás de una interfaz
   (`TaskRepository`). El cambio de motor no tocó ni el dominio ni la interfaz.
   **Mantener esa frontera en toda dependencia externa importante.**

**Contexto:** Siempre, al elegir dependencias. Especialmente las que tocan disco,
red o sistema operativo. Decisión completa en `docs/decisiones/ADR-002-local-first.md`.

---

## 2026-08-03 14:20 — Verificar pronto y con el mecanismo real, no con un atajo

**Error o aprendizaje:** Tres fallos de este sprint (el módulo nativo, el preload
que no cargaba por arrastrar `zod`, y Electron sin abrir ventana por
`ELECTRON_RUN_AS_NODE`) tienen algo en común: **ninguno se podía detectar leyendo
el código**. Solo aparecieron al ejecutar de verdad.

**Causa raíz:** Es tentador escribir mucho código correcto sobre el papel y
dejar la ejecución para el final. Los tres fallos habrían costado mucho más caros
si aparecen con toda la aplicación escrita encima.

**Lección:**
1. **Ejecutar en cuanto haya algo ejecutable**, aunque sea trivial. La instalación
   se probó nada más definir las dependencias; el arranque, nada más tener el
   proceso principal.
2. Cuando el dueño no puede comprobar algo con sus propios ojos (una notificación
   del sistema, la apertura de un enlace), **interceptar el mecanismo real** en la
   prueba automática en vez de darlo por bueno. Se hizo con `Notification` y con
   `shell.openExternal`: se comprueba que la aplicación pide exactamente lo
   correcto, sin efectos molestos.
3. El panel de desarrollo **no** envía eventos por un atajo interno: enseña el
   comando para enviarlos por HTTP como lo hará la integración real. Un atajo
   interno habría dado una falsa sensación de que el canal funciona.

**Contexto:** Siempre. Especialmente antes de escribir en `PROJECT_STATUS.md` que
algo «funciona».
