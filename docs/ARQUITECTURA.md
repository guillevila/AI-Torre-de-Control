# Arquitectura — Estado técnico del proyecto

> Documento vivo. Claude lo actualiza cuando cambia algo técnico relevante.
> Si quieres saber cómo está construido el proyecto, lee esto.

**Última actualización:** 2026-08-03 — sistema de diseño completo (Sprint 002)
**Mantenedor:** Claude (con validación del dueño del proyecto)

---

## Visión general

AI Torre de Control es una aplicación de escritorio **local-first**: todo ocurre
en el ordenador del usuario, sin servidor, sin cuenta y sin llamadas a APIs de
modelos de IA.

La idea estructural que ordena todo lo demás:

> **Las reglas del negocio no saben nada de Electron, ni de SQLite, ni de React.**

Viven en `packages/domain` como funciones puras. Eso tiene tres consecuencias
prácticas que ya se han cobrado su valor en este primer sprint:

1. Los tests de las reglas tardan **milisegundos** y no necesitan abrir ninguna
   ventana.
2. Cambiar de base de datos fue posible **sin tocar ni una línea** del dominio
   ni de la interfaz (pasó de verdad: ver [ADR-002](decisiones/ADR-002-local-first.md)).
3. La futura extensión de navegador podrá reutilizar los mismos contratos y las
   mismas reglas sin copiar nada.

### El recorrido de un cambio de estado

```
  Herramienta local              Interfaz (React)
  (hook, script…)                       │
        │                               │ pulsar "Cambiar estado"
        │ HTTP POST                     │
        ▼                               ▼
  ┌──────────────────┐          ┌────────────────┐
  │ Receptor local   │          │  Puente IPC    │
  │ 127.0.0.1 +token │          │  (preload)     │
  └────────┬─────────┘          └───────┬────────┘
           │                            │
           └────────────┬───────────────┘
                        ▼
              ┌──────────────────┐
              │   TaskService    │  ← único punto de entrada
              └────────┬─────────┘
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
   Máquina de     Repositorio    Notificador
   estados        (SQLite)       (anti-duplicados)
   (dominio)          │               │
         │            ▼               ▼
         │       fichero .db     aviso del sistema
         │
         └──► ¿aceptado? ──► se publica la lista completa a la interfaz
```

**Los dos caminos convergen en el mismo sitio.** No existe forma de cambiar un
estado sin pasar por la máquina de estados, y por tanto no existe forma de que
un evento automático haga algo que un botón no pueda hacer, ni al revés.

---

## Stack tecnológico

| Capa | Tecnología | Versión | Por qué |
|------|-----------|---------|---------|
| Escritorio | Electron | 33 | Un solo lenguaje para interfaz, lógica de sistema y futura extensión ([ADR-001](decisiones/ADR-001-electron.md)) |
| Interfaz | React + TypeScript estricto | 19 / 5.9 | Estándar, sin librería de componentes para no arrastrar peso |
| Compilación | electron-vite + Vite | 2 / 5 | Compila los tres procesos con una sola configuración |
| Base de datos | SQLite vía `node-sqlite3-wasm` | 0.8 | Fichero SQLite estándar sin compilar nada nativo ([ADR-002](decisiones/ADR-002-local-first.md)) |
| Validación | zod | 3 | Un único contrato sirve de tipo y de validador en ejecución |
| Paquetes | pnpm workspaces | 9 | Monorepo simple, sin Turborepo ni herramientas extra ([ADR-004](decisiones/ADR-004-monorepo.md)) |
| Tests unitarios | Vitest | 2 | Rápido, misma configuración que Vite |
| Test de interfaz | Playwright (`_electron`) | 1.62 | Arranca la aplicación real, no una simulación |

**Ausencias deliberadas:** no hay gestor de estado global (Redux, Zustand), ni
librería de componentes, ni Tailwind, ni ORM, ni cliente HTTP. Nada de eso hace
falta todavía.

---

## Estructura de carpetas

```
ai-torre-de-control/
├─ apps/
│  └─ desktop/                      Aplicación Electron
│     ├─ src/main/                  Proceso principal (Node, acceso al sistema)
│     │  ├─ index.ts                Arranque: monta y conecta las piezas
│     │  ├─ db/
│     │  │  ├─ schema.ts            Migraciones SQL
│     │  │  ├─ task-repository.ts   Puerto de persistencia + versión en memoria
│     │  │  └─ sqlite-task-repository.ts
│     │  ├─ events/
│     │  │  ├─ local-event-server.ts   Receptor HTTP en 127.0.0.1
│     │  │  └─ endpoint.ts             Clave local y fichero de conexión
│     │  ├─ hooks/                  Enlace con Claude Code (instalador y señales)
│     │  ├─ permissions/            Permisos en memoria, nunca en disco (D20)
│     │  ├─ intake/                 Altas que llegan de fuera (extensión)
│     │  ├─ notifications/
│     │  │  ├─ notifier.ts             Lógica de avisos (sin Electron: testeable)
│     │  │  └─ desktop-notifier.ts     Envío real al sistema operativo
│     │  ├─ services/task-service.ts   Orquestador
│     │  ├─ system/open-external.ts    Apertura validada de enlaces
│     │  └─ ipc/handlers.ts            Canales hacia la interfaz
│     │  └─ settings/               Ajustes locales en JSON
│     ├─ src/preload/index.ts       Puente seguro (14 operaciones, ni una más)
│     ├─ src/renderer/              Interfaz React
│     │  ├─ App.tsx                 Sección, capas y composición
│     │  ├─ hooks/useTasks.ts       ÚNICA fuente de datos de la interfaz
│     │  ├─ views/                  Torre · Atención · Tareas · Historial · Ajustes
│     │  ├─ views/office/           La planta de oficina por zonas
│     │  ├─ components/             Barra lateral, cabecera, ficha, alta rápida
│     │  ├─ assets/fonts/           Las tres tipografías, empaquetadas
│     │  └─ styles/                 tokens.css (el sistema de diseño) + app.css
│     ├─ e2e/                       Prueba de interfaz
│     └─ scripts/launch.mjs         Arrancador (neutraliza ELECTRON_RUN_AS_NODE)
│  └─ extension/                    Extensión de Chrome (JS de navegador, sin compilar)
│     ├─ manifest.json              LOS PERMISOS. El fichero que de verdad importa
│     ├─ torre.js                   Todo lo que sale del navegador: buscar y registrar
│     ├─ popup.*                    La ventanita del icono
│     ├─ opciones.*                 La clave local, una sola vez
│     └─ scripts/generar-iconos.mjs Genera los PNG, para que no sean binarios sin origen
├─ packages/
│  ├─ contracts/                    Tipos + esquemas zod (sin lógica)
│  └─ domain/                       Reglas puras (sin dependencias de plataforma)
└─ scripts/send-test-event.mjs      Simulador de eventos
```

---

## Base de datos

Un único fichero SQLite en la carpeta de datos del usuario:

- Windows: `%APPDATA%\ai-torre-de-control\torre.db`
- macOS: `~/Library/Application Support/ai-torre-de-control/torre.db`
- Linux: `~/.config/ai-torre-de-control/torre.db`

### Tabla `tasks`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | TEXT | Clave primaria (UUID) |
| `title` | TEXT | Lo que escribió el usuario |
| `provider` | TEXT | Plataforma, de una lista cerrada |
| `external_url` | TEXT | Enlace a la conversación. Solo http/https |
| `external_session_id` | TEXT | Para futuras integraciones |
| `project_path` | TEXT | Carpeta local de trabajo |
| `status` | TEXT | Uno de los ocho estados normalizados |
| `status_source` | TEXT | De dónde vino el estado |
| `status_confidence` | TEXT | `high` / `medium` / `low` |
| `started_at` | TEXT | ISO-8601. Se fija al arrancar la tarea |
| `finished_at` | TEXT | ISO-8601. Se borra si la tarea se reabre |
| `last_activity_at` | TEXT | Se refresca en cada señal |
| `created_at`, `updated_at` | TEXT | ISO-8601 |
| `notes` | TEXT | Solo lo escribe el usuario |

**No existe ninguna columna capaz de guardar el contenido de una conversación**
(decisión D5). Hay un test automático que falla si alguna vez apareciera una.

### Tabla `task_status_history` (decisión D19)

Una fila por cada cambio de estado. Es la prueba de honestidad del sistema: si
la aplicación afirma algo, aquí se ve de dónde vino.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | INTEGER | Autonumérico |
| `task_id` | TEXT | Clave foránea con borrado en cascada |
| `from_status` | TEXT | `NULL` cuando la línea es la creación de la tarea |
| `to_status` | TEXT | Estado nuevo |
| `source` | TEXT | Quién lo dijo |
| `confidence` | TEXT | Con cuánta certeza |
| `at` | TEXT | ISO-8601 |

Solo se anota lo que **cambia de verdad**: repetir el mismo estado no genera
línea. Las tareas anteriores a la migración v2 no tienen historial retroactivo,
y es correcto: inventarlo sería lo contrario de lo que esta tabla garantiza.

### Fichero `settings.json`

Junto a la base de datos. Contiene solo preferencias que hacen algo: qué avisos
están activos, cuándo una tarea automática pasa a «sin confirmar», y con qué
sección y vista arranca la aplicación. Si está corrupto se vuelve a los valores
por defecto sin molestar.

### Migraciones

Con `PRAGMA user_version`, el número de versión que SQLite guarda dentro del
propio fichero. Al abrir se aplican solo las migraciones que falten. Una
migración publicada no se edita nunca: se añade otra debajo.

---

## Flujos principales

### Crear una tarea

```
Formulario → preload → TaskService.create()
  → valida con el contrato (zod)
  → construye la tarea (nace manual y con confianza alta)
  → guarda
  → publica la lista completa a la interfaz
```

Si la validación falla, el mensaje que llega a la pantalla es el del contrato,
en lenguaje normal: nunca un error técnico genérico.

### Recibir un evento local

```
POST http://127.0.0.1:4319/events
  1. ¿Viene de una dirección de bucle local?     → si no, 403
  2. ¿Trae la clave local correcta?              → si no, 401
  3. ¿Es application/json?                       → si no, 415
  4. ¿Cabe en 16 KB?                             → si no, 413
  5. ¿Cumple el contrato EXACTO (campos de más incluidos)? → si no, 422
  6. ¿Existe la tarea?                           → si no, 422
  7. ¿La máquina de estados acepta la transición?→ si no, 422
  → se guarda, se avisa si procede y se publica
```

El puerto se busca entre 4319 y 4323; se usa el primero libre. La dirección y la
clave quedan publicadas en `event-endpoint.json` dentro de la carpeta de datos,
para que las herramientas locales las lean.

**Si el receptor no arranca, la aplicación sigue funcionando.** El control manual
nunca depende de la automatización (decisión D6).

### Decidir si se notifica

Dos barreras encadenadas:

1. **En la máquina de estados**: solo se avisa si el estado *cambia de verdad* y
   el nuevo es `waiting_user`, `completed` o `failed`.
2. **En el notificador**: recuerda el último aviso por tarea y descarta el
   repetido, por si dos caminos pidieran avisar del mismo cambio a la vez.

Si una tarea se reabre, se olvida el aviso anterior: su próximo cierre volverá a
notificarse.

---

## Reglas del dominio que conviene conocer

**Grafo de transiciones.** Cada estado declara a cuáles puede pasar. Se permite
todo lo que puede ocurrir en la vida real (una tarea terminada puede reabrirse)
y se prohíbe lo que solo puede venir de un error (una archivada no puede pasar a
fallida).

**La decisión manual manda.** Si el usuario marcó a mano una tarea como
`completed`, `failed` o `archived`, ninguna señal automática puede deshacerlo.
Evita el caso real de que un evento retrasado resucite algo que ya diste por
cerrado.

**Marcas de tiempo derivadas.** `startedAt` se fija la primera vez que la tarea
arranca y no se reescribe. `finishedAt` se fija al acabar y se borra si se
reabre.

**Agrupaciones compartidas.** Qué cuenta como «necesita atención», en qué zona
de la oficina va cada estado y en qué orden se apilan las secciones se decide en
un solo sitio (`packages/domain/src/selectors.ts`). Todas las vistas llaman ahí,
así que es imposible que muestren cosas distintas (decisión D10).

**Barrido a «sin confirmar».** Cada minuto se revisa si alguna tarea automática
lleva demasiado tiempo sin señal y, si es así, pasa a `unknown` con confianza
baja (D9). **Nunca toca lo que el usuario fijó a mano**: sin integraciones
instaladas, lo contrario marcaría como dudoso todo lo que registras media hora
después de registrarlo.

**Colores por plataforma, no por rol.** El diseño usaba el «rol» de la tarea
para colorear a cada trabajador de la oficina, pero ese campo quedó como
decisión abierta (O7). Se usa la plataforma, que ya existe y cumple la misma
función.

---

## Seguridad

| Medida | Dónde |
|---|---|
| Interfaz sin acceso a Node, disco ni red | `contextIsolation`, `sandbox`, `nodeIntegration: false` |
| Superficie de IPC mínima y explícita (7 operaciones) | `src/preload/index.ts` |
| Receptor atado a `127.0.0.1` + comprobación de bucle local | `local-event-server.ts` |
| Clave local comparada en tiempo constante | `local-event-server.ts` |
| Contratos `.strict()`: un campo de más rechaza el evento entero | `packages/contracts/src/events.ts` |
| Límite de 16 KB por evento | `local-event-server.ts` |
| Sin cabeceras CORS: ninguna web puede leer las respuestas | `local-event-server.ts` |
| Enlaces validados (solo http/https) antes de abrirse | `system/open-external.ts` |
| La ventana no puede navegar fuera ni abrir ventanas nuevas | `main/index.ts` |
| Política de contenidos estricta en producción | plugin en `electron.vite.config.ts` |
| Una sola instancia de la aplicación | `main/index.ts` |

---

## Deuda técnica conocida

| Item | Impacto | Prioridad | Notas |
|------|---------|-----------|-------|
| Sin empaquetado instalable | No se puede distribuir | Media | Depende de la decisión abierta O1 (qué sistema operativo primero) |
| CSP con `unsafe-eval` en desarrollo | Bajo | Baja | Lo exige la recarga en caliente de Vite. En producción la política es estricta |
| Paquete de la interfaz ~690 KB | Bajo | Baja | Aceptable en escritorio. Se partirá si crece |
| `zod` duplicado en interfaz y proceso principal | Bajo | Baja | Consecuencia de compartir contratos; el coste real es pequeño |
| Sin registro persistente de errores | Medio | Media | Hoy solo consola. Hará falta al depurar integraciones reales |
| Rendimiento sin medir con muchas tareas | Bajo | Baja | Se lee la tabla entera en cada cambio. Sobra para decenas o cientos |
| Acciones del CI avisan de obsolescencia de Node 20 | Nulo hoy | Baja | `actions/checkout@v4` y compañía se ejecutan forzadas en Node 24. Funciona, pero conviene subir de versión antes de que dejen de admitirse |
| Los avisos de escritorio no se pueden probar de extremo a extremo en el CI | Bajo | Baja | Los servidores de integración no tienen servicio de notificaciones. La prueba fuerza `isSupported()` para medir nuestra lógica, no el entorno |

---

## Cómo arrancar en local

```bash
pnpm install     # instalar dependencias
pnpm dev         # abrir la aplicación
pnpm test        # tests unitarios
pnpm test:e2e    # prueba de interfaz (arranca la aplicación real)
pnpm build       # versión de producción
pnpm typecheck   # comprobar tipos
```

---

## Variables de entorno necesarias

**Ninguna.** La aplicación funciona sin configurar nada.

El único ajuste opcional está documentado en [.env.example](../.env.example):

```bash
# Carpeta de datos alternativa. Se usa en las pruebas para no tocar
# los datos reales del usuario.
TORRE_USER_DATA=
```

No hay ni habrá claves de API: el producto no consume servicios de modelos
(decisión D2).

---

## Decisiones técnicas

Ver [docs/decisiones/](decisiones/) para los ADR.
Ver [SYSTEM_VISION.md](../SYSTEM_VISION.md) para las decisiones de negocio (D1–D18).
