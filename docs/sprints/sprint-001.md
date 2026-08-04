# Sprint 001 — Primera vertical funcional

**Fecha:** 3 de agosto de 2026
**Rama:** `feat/bootstrap-control-tower`
**Fase del proyecto:** Fase 1 — Vertical local
**Estado al terminar:** 🛠️ Prototipo funcional

---

## Objetivo

Construir la primera vertical funcional completa de AI Torre de Control: una
aplicación de escritorio que permita registrar y supervisar tareas delegadas a
herramientas de IA, sin consumir APIs de modelos y sin guardar el contenido de
las conversaciones.

Punto de partida: un repositorio con documentación y protocolos de trabajo, y
**cero líneas de código de producto**.

---

## Qué se ha construido

### Cimientos

- Monorepo con pnpm workspaces y tres paquetes: `contracts`, `domain`,
  `apps/desktop`.
- TypeScript en modo estricto, con comprobaciones adicionales
  (`noUncheckedIndexedAccess`, `noUnusedLocals`, `exactOptionalPropertyTypes`).
- Compilación de los tres procesos de Electron con `electron-vite`.

### El dominio (`packages/domain`)

Reglas puras, sin dependencias de Electron, React ni base de datos:

- **Máquina de estados** con grafo explícito de transiciones. Único punto del
  sistema donde una tarea cambia de estado.
- **Regla de decisión manual**: lo que el usuario cierra a mano no lo deshace una
  señal automática.
- **Marcas de tiempo derivadas** (`startedAt`, `finishedAt`, `lastActivityAt`).
- **Decisión de aviso**: solo al entrar de verdad en `waiting_user`, `completed`
  o `failed`.
- **Agrupaciones y filtros** compartidos por las dos vistas.

### Los contratos (`packages/contracts`)

- Modelo de tarea completo con los 15 campos del sprint.
- Ocho estados normalizados, cinco fuentes, tres niveles de confianza.
- Contrato de eventos **estricto**: un campo de más rechaza el evento entero.
- Validación de URLs: solo `http` y `https`.

### La aplicación (`apps/desktop`)

- **Persistencia** en fichero SQLite con migraciones versionadas, tras una
  interfaz que permite cambiar de motor sin tocar el resto.
- **Servicio de tareas** que orquesta validación, dominio, guardado, avisos y
  publicación del estado a la interfaz.
- **Receptor local de eventos** en `127.0.0.1` con siete barreras de seguridad.
- **Notificaciones** con doble anti-duplicados.
- **Puente IPC** de exactamente siete operaciones, con la interfaz aislada del
  sistema.
- **Vista operativa**: tareas agrupadas por lo que reclaman, con fuente y
  confianza siempre visibles.
- **Vista oficina**: despacho del CEO y un puesto por tarea, con representación
  diferenciada de seis estados y ficha al pulsar.
- **Script de simulación** de eventos y panel de desarrollo.

---

## Criterios de aceptación

| # | Criterio | Estado | Cómo se comprobó |
|---|---|---|---|
| 1 | `pnpm install` funciona | ✅ | Ejecutado. 7,7 s, sin compilar nada nativo |
| 2 | `pnpm dev` abre la aplicación | ✅ | Ejecutado. Servidor de Vite, ventana y receptor arrancados sin errores |
| 3 | Se puede crear una tarea manual | ✅ | Prueba de interfaz |
| 4 | Se puede cambiar su estado | ✅ | Prueba de interfaz + 17 tests unitarios |
| 5 | La tarea persiste tras reiniciar | ✅ | Prueba de interfaz que cierra y reabre la aplicación |
| 6 | Se puede abrir una URL externa | ✅ | Prueba de interfaz: se verifica la dirección exacta solicitada |
| 7 | Un evento local simulado actualiza el estado | ✅ | Prueba de interfaz con HTTP real a `127.0.0.1` |
| 8 | Los tres estados producen notificación | ✅ | Prueba de interfaz (interceptada) + 10 tests unitarios |
| 9 | Vista operativa y oficina muestran lo mismo | ✅ | Prueba de interfaz + 14 tests de las agrupaciones compartidas |
| 10 | Los tests pasan | ✅ | 105 unitarios + 2 de interfaz, todos en verde |
| 11 | El build de producción termina | ✅ | `pnpm build` correcto |
| 12 | El CI ejecuta tests reales | ⚠️ | Configurado (tipos, tests, build y prueba de interfaz con xvfb). **Sin ejecutar todavía en GitHub**: la rama no se ha subido |
| 13 | No hay integración con APIs de modelos | ✅ | No existe ninguna dependencia de proveedor de IA en el proyecto |
| 14 | No se almacena contenido de conversaciones | ✅ | Test que falla si aparece una columna prohibida + contratos estrictos |
| 15 | PROJECT_STATUS distingue comprobado de pendiente | ✅ | [PROJECT_STATUS.md](../../PROJECT_STATUS.md) |

**14 de 15 completos.** El único abierto es el nº 12, y solo porque el CI no se
puede verificar sin subir la rama a GitHub.

---

## Decisiones registradas

| ADR | Decisión |
|---|---|
| [001](../decisiones/ADR-001-electron.md) | Electron como base de escritorio |
| [002](../decisiones/ADR-002-local-first.md) | Local-first con SQLite en fichero, sin módulos nativos |
| [003](../decisiones/ADR-003-modelo-de-estados.md) | Estados normalizados con fuente y confianza |
| [004](../decisiones/ADR-004-monorepo.md) | Monorepo con dominio aislado |
| [005](../decisiones/ADR-005-clave-receptor-local.md) | Clave local en el receptor de eventos |

Ninguna decisión cerrada de `SYSTEM_VISION.md` (D1–D18) se ha modificado.

---

## Lo que se torció por el camino

**`better-sqlite3` no se pudo instalar.** Era la opción por defecto del
ecosistema. Al ejecutar `pnpm install` intentó compilarse desde el código fuente
—no había binario listo para Node 24— y pidió Python y las herramientas de
compilación de Visual Studio, que no estaban en el equipo.

Se cambió a `node-sqlite3-wasm`, que no compila nada. **El cambio no tocó ni el
dominio ni la interfaz**, porque la base de datos estaba detrás de una interfaz
desde el primer momento. Fue la primera vez que esa decisión de arquitectura se
pagó sola.

La lección quedó registrada en
[`.claude/skills/lessons-learned/log.md`](../../.claude/skills/lessons-learned/log.md).

**El preload no cargaba.** El puente entre el sistema y la interfaz arrastraba
la librería de validación, y en modo aislado un preload no puede cargar módulos
de Node. Se resolvió dando a los contratos una entrada específica para IPC, sin
dependencias: el preload pasó de 4,6 kB a 1,5 kB y dejó de fallar.

**Electron no abría ventana.** Los terminales integrados de editores construidos
sobre Electron heredan la variable `ELECTRON_RUN_AS_NODE=1`, que hace que
Electron arranque como Node a secas: sin ventana y sin error visible. Se añadió
un arrancador que la limpia, para que nadie vuelva a perder una tarde con esto.

---

## Qué NO se hizo, y por qué

- **Empaquetado instalable** — depende de la decisión abierta O1 (qué sistema
  operativo primero). Sin esa respuesta, empaquetar sería trabajo tirado.
- **Integraciones reales** — fuera de alcance por decisión del sprint. El canal
  por el que llegarán está construido y probado.
- **Oficina visual avanzada** — decisión D11: el valor está en no perder
  trabajos, no en las animaciones.
- **Un cuarto paquete para componentes de interfaz** — solo hay una aplicación
  que los use. Se separará cuando haya una segunda.

No se ha creado ningún botón ni pantalla que aparente estar conectado a algo que
no existe.

---

## Números

| | |
|---|---|
| Tests unitarios | 105 |
| Pruebas de interfaz | 2 |
| ADRs escritos | 5 |
| Dependencias de producción | 4 (`react`, `react-dom`, `zod`, `node-sqlite3-wasm`) |
| Operaciones expuestas a la interfaz | 7 |
| Tiempo de `pnpm install` | ~8 s |
| Tiempo de los tests unitarios | ~2 s |

---

## Siguiente paso

Antes del Sprint 002 hace falta que el dueño del proyecto:

1. **Pruebe la aplicación** siguiendo el apartado 4 de
   [PROJECT_STATUS.md](../../PROJECT_STATUS.md), y confirme que ve la
   notificación de Windows.
2. **Responda la decisión abierta O3**: cuál es la primera integración real.
3. **Responda la decisión abierta O1** si quiere poder instalarla como programa.
