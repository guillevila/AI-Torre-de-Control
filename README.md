# AI Torre de Control

> Una aplicación de escritorio para no perder de vista las tareas que dejas
> trabajando en herramientas de inteligencia artificial.

Delegas un informe a ChatGPT, un refactor a Claude Code y un análisis a Codex.
Media hora después no recuerdas cuál terminó, cuál se quedó esperando una
respuesta tuya y cuál falló hace rato. **AI Torre de Control es el único sitio
donde ves las tres a la vez**, con un enlace para volver a cada conversación.

📊 **¿Quieres saber qué funciona hoy de verdad?** → [PROJECT_STATUS.md](PROJECT_STATUS.md)
🧭 **¿Qué es y hacia dónde va?** → [SYSTEM_VISION.md](SYSTEM_VISION.md)

---

## Lo que hace y lo que no

| Sí hace | No hace |
|---|---|
| Registra tareas y su estado | Ejecutar prompts por ti |
| Avisa cuando algo termina o te necesita | Guardar tus conversaciones |
| Te devuelve a la conversación original de un clic | Consumir APIs de pago de OpenAI, Anthropic ni nadie |
| Recibe avisos automáticos de herramientas locales | Enviar tus datos a ningún servidor |
| Funciona aunque falle toda la automatización | Tocar la configuración de tus otras herramientas |

**Todo ocurre en tu ordenador.** No hay cuenta, ni nube, ni coste por uso.
El producto solo guarda *metadatos*: título, plataforma, estado, enlace y fechas.
Nunca el contenido de lo que hablas con la IA.

---

## Probarlo

Necesitas [Node.js](https://nodejs.org) 20 o superior y `pnpm`
(si no lo tienes: `npm install -g pnpm`).

```bash
pnpm install     # instalar (no compila nada nativo: es rápido y no falla)
pnpm dev         # abrir la aplicación
```

Se abre una ventana. A partir de ahí:

1. **Nueva tarea** → ponle un título, elige dónde se está ejecutando y pega el
   enlace de la conversación.
2. La tarea aparece en la pantalla, agrupada según lo que reclame tu atención.
3. Cambia su estado con el desplegable de la tarjeta.
4. Pulsa **Oficina** en la barra superior: las mismas tareas, ahora como
   personas trabajando en sus puestos. Pulsa a cualquiera para ver su ficha.

### Simular un aviso automático

Así es como te avisará mañana Claude Code cuando termine algo. Con la
aplicación abierta, copia el identificador de una tarea desde su ficha y:

```bash
pnpm evento <id-de-la-tarea> completed
```

La pantalla se actualiza sola y salta una notificación de escritorio.

---

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm install` | Instala las dependencias |
| `pnpm dev` | Abre la aplicación en modo desarrollo |
| `pnpm build` | Construye la versión de producción |
| `pnpm test` | Ejecuta los tests unitarios |
| `pnpm test:e2e` | Abre la aplicación de verdad y recorre el flujo completo |
| `pnpm typecheck` | Comprueba que los tipos son correctos |
| `pnpm evento <id> <estado>` | Envía un evento de prueba al receptor local |

---

## Cómo está montado

```
apps/desktop        La aplicación Electron
  src/main            Proceso con acceso al sistema: base de datos, eventos, avisos
  src/preload         Puente seguro y mínimo hacia la interfaz
  src/renderer        La interfaz (React): vista operativa y vista oficina
packages/contracts  Tipos y validaciones compartidas
packages/domain     Las reglas: máquina de estados, agrupaciones, decisiones de aviso
scripts             Utilidades de desarrollo
```

La idea de fondo: **las reglas del negocio no saben nada de Electron, ni de
SQLite, ni de React**. Viven en `packages/domain`, se prueban en milisegundos y
se podrán reutilizar tal cual en la futura extensión de navegador.

Detalle técnico completo en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).
Por qué se eligió cada cosa, en [docs/decisiones/](docs/decisiones/).

---

## Seguridad

Este repositorio es **público**, así que conviene decirlo claro:

- **No contiene secretos** de ningún tipo, ni los contendrá.
- El receptor de eventos escucha **solo en `127.0.0.1`**: ningún otro equipo de
  tu red puede alcanzarlo.
- Además exige una **clave local** que la aplicación genera sola y guarda fuera
  del repositorio, para que ningún otro programa de tu ordenador pueda falsear
  el estado de tus tareas.
- Los eventos se validan enteros: si traen un solo campo de más, se rechazan.
  Es la barrera que impide que una integración cuele contenido de conversaciones.
- Un evento **no puede ejecutar nada**. Solo mover una tarea entre estados
  conocidos.
- Los enlaces se validan antes de abrirse: solo `http://` y `https://`.
- La interfaz no tiene acceso al disco, ni a la red, ni a Node.

---

## Si algo no arranca

**La ventana no aparece al hacer `pnpm dev`.**
Suele pasar al lanzarlo desde la terminal integrada de un editor construido
sobre Electron (VS Code, Cursor), que define la variable `ELECTRON_RUN_AS_NODE`.
El proyecto ya la neutraliza; si aun así falla, prueba desde una terminal normal
del sistema.

**`pnpm evento` dice que no encuentra los datos de conexión.**
La aplicación tiene que estar abierta: es ella quien publica la dirección y la
clave al arrancar.

---

## Para el dueño del proyecto

Documentación pensada para leerse sin saber programar:

- [docs/ONBOARDING_NO_TECNICO.md](docs/ONBOARDING_NO_TECNICO.md) — cómo trabajar con Claude
- [docs/ESTADOS_DEL_PROYECTO.md](docs/ESTADOS_DEL_PROYECTO.md) — qué significa idea, demo, MVP, producción
- [docs/DICCIONARIO.md](docs/DICCIONARIO.md) — términos técnicos en lenguaje normal
- [docs/ANTES_DE_COMPARTIR.md](docs/ANTES_DE_COMPARTIR.md) — revisión antes de enseñar el repo
- [docs/ROADMAP.md](docs/ROADMAP.md) — qué viene después

---

*Proyecto personal en desarrollo. Consulta siempre
[PROJECT_STATUS.md](PROJECT_STATUS.md) antes de dar nada por hecho.*
