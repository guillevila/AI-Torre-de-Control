# ADR-002 — Arquitectura local-first con SQLite en fichero

**Fecha:** 2026-08-03
**Estado:** Aceptada
**Relacionada con:** decisiones D1, D5, D12 de [SYSTEM_VISION.md](../../SYSTEM_VISION.md)

## Contexto

El producto gestiona información sobre el trabajo real de una empresa: en qué
está trabajando, qué ha delegado, dónde están sus conversaciones. Aunque no
guarde el contenido de esas conversaciones, la lista de tareas ya es sensible.

Además, el proyecto lo mantiene una sola persona y no quiere costes recurrentes
ni infraestructura que administrar.

## Decisión

**Todo se guarda en el ordenador del usuario, en un único fichero SQLite.**
Sin servidor, sin cuenta, sin sincronización, sin nube.

El acceso a la base de datos queda detrás de una interfaz (`TaskRepository`), de
modo que el motor concreto sea reemplazable sin tocar nada más.

**Motor elegido: `node-sqlite3-wasm`** — SQLite compilado a WebAssembly. Escribe
un fichero `.db` estándar, abrible con cualquier herramienta de SQLite.

## Alternativas consideradas

### Sobre dónde guardar

- **Base de datos en la nube** (Supabase, Postgres gestionado) — descartada:
  saca los datos del ordenador, añade coste mensual, exige autenticación y
  convierte un problema simple en uno de infraestructura. Contradice D1 y D12.
- **Ficheros JSON en disco** — descartada: sin transacciones ni consultas, y con
  riesgo real de corromper el fichero si la aplicación se cierra a medias.

### Sobre el motor de SQLite

- **`better-sqlite3`** — era la opción por defecto, la más usada del ecosistema.
  **Se probó y falló.** Es un módulo nativo: cuando no hay binario precompilado
  para la versión de Node instalada (aquí, Node 24) intenta compilarse desde el
  código fuente, lo que exige Python y las herramientas de compilación de Visual
  Studio. Ninguna de las dos estaba en el equipo, y pedirle a un usuario no
  técnico que instale medio gigabyte de herramientas para que `pnpm install`
  funcione es inaceptable.
- **`node:sqlite`** (integrado en Node) — descartada: en la versión de Node que
  incluye Electron 33 todavía es experimental y requiere un flag.
- **`sql.js`** — descartada: mantiene la base en memoria y obliga a volcarla a
  mano, con riesgo de perder datos.

## Consecuencias

**A favor**

- `pnpm install` no compila absolutamente nada. Tarda segundos y funciona igual
  en Windows, macOS y Linux, con o sin herramientas de desarrollo instaladas.
- El CI puede ejecutar los tests de base de datos sin preparar nada.
- El fichero resultante es SQLite estándar: se puede inspeccionar, copiar como
  copia de seguridad o migrar a otro motor cuando haga falta.
- Los datos no salen del ordenador. La privacidad no depende de configurar nada
  bien.

**En contra**

- WebAssembly es algo más lento que un binario nativo. Irrelevante para el
  volumen previsto (decenas o cientos de tareas, no millones).
- Es un paquete con menos comunidad que `better-sqlite3`. Mitigado por tenerlo
  detrás de una interfaz: cambiarlo son unas pocas decenas de líneas en un solo
  archivo.
- No hay copia de seguridad automática. Si el usuario pierde el ordenador,
  pierde el histórico. Queda anotado como riesgo en
  [PROJECT_STATUS.md](../../PROJECT_STATUS.md).

**Lección que deja este cambio**

Está registrada en
[`.claude/skills/lessons-learned/log.md`](../../.claude/skills/lessons-learned/log.md):
una dependencia con módulos nativos no se da por buena hasta haber ejecutado la
instalación de verdad en el equipo objetivo.

**Revisión**

Se reabriría si se decidiera sincronizar entre ordenadores (decisión abierta O5)
o si apareciera un problema de rendimiento medido, no supuesto.
