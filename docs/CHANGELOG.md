# Changelog — Historial de cambios

> Registro de todos los cambios significativos del proyecto.
> El más reciente siempre arriba.
> Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)

---

## [Sin publicar]

> Los cambios en desarrollo van aquí hasta que se publican.

---

## [0.1.0] — 2026-08-03 — Primera vertical funcional de AI Torre de Control

> El proyecto deja de ser documentación y pasa a ser una aplicación que funciona.
> Estado alcanzado: 🛠️ **Prototipo funcional**.
> Detalle completo en [sprints/sprint-001.md](sprints/sprint-001.md).

### Añadido

**Aplicación de escritorio**
- Aplicación Electron con dos vistas del mismo estado: **vista operativa**
  (tareas agrupadas por lo que reclaman de ti) y **vista oficina** (una persona
  por tarea, con su estado representado visualmente).
- Alta, edición y archivado de tareas, con filtros por texto, plataforma y grupo.
- Ficha completa de cada tarea, accesible desde las dos vistas.
- Apertura de la conversación externa en el navegador del sistema, con la URL
  validada antes de abrirse.

**Reglas del negocio**
- Máquina de estados con los ocho estados normalizados, grafo explícito de
  transiciones y regla de que una decisión manual no la deshace una señal
  automática.
- Fuente y nivel de confianza en todo estado, visibles siempre en pantalla.
- Agrupaciones y filtros compartidos por ambas vistas, de modo que no puedan
  desincronizarse.

**Persistencia**
- Base de datos SQLite en fichero, en la carpeta de datos del usuario, con
  migraciones versionadas.
- Acceso a datos tras una interfaz, para poder cambiar de motor sin tocar el
  resto del sistema.

**Eventos y avisos**
- Receptor local de eventos en `127.0.0.1` con siete barreras de seguridad:
  bucle local, clave secreta comparada en tiempo constante, tipo de contenido,
  límite de tamaño, contrato estricto, existencia de la tarea y transición válida.
- Notificaciones de escritorio al pasar a *te espera*, *terminada* o *fallida*,
  con doble mecanismo anti-duplicados.
- Script `pnpm evento` para simular eventos por el canal real, y panel de
  desarrollo que muestra dónde escucha el receptor.

**Infraestructura**
- Monorepo con pnpm workspaces: `contracts`, `domain` y `apps/desktop`.
- TypeScript estricto con comprobaciones adicionales.
- 105 tests unitarios y 2 pruebas que arrancan la aplicación real.
- Cinco ADR documentando las decisiones técnicas.

### Cambiado

- `README.md` — reescrito para AI Torre de Control: qué hace, qué no hace, cómo
  probarlo y cómo está montado.
- `PROJECT_STATUS.md` — pasa de 💡 Idea a 🛠️ Prototipo funcional, distinguiendo
  con detalle qué está comprobado automáticamente y qué falta por confirmar.
- `docs/ARQUITECTURA.md`, `docs/ROADMAP.md` — rellenados con el estado real.
- `.github/workflows/ci.yml` — activados los tests reales: tipos, tests
  unitarios, build y prueba de interfaz con pantalla virtual. El job de
  documentación se mantiene.
- `.gitignore` — añadidos resultados de pruebas, ficheros de base de datos y el
  fichero de conexión del receptor local.
- `.env.example` — reescrito: la aplicación no necesita ninguna variable, y no
  habrá claves de API.

### Corregido

- La instalación fallaba en Windows sin herramientas de compilación. Se sustituyó
  `better-sqlite3` por una versión de SQLite que no compila nada
  ([ADR-002](decisiones/ADR-002-local-first.md)).
- El puente hacia la interfaz no cargaba por arrastrar la librería de validación,
  que un preload aislado no puede cargar. Resuelto con una entrada de contratos
  específica y sin dependencias.
- Electron no abría ventana al lanzarse desde terminales que definen
  `ELECTRON_RUN_AS_NODE`. Añadido un arrancador que limpia esa variable.

---

## [0.2.0] — 2026-06-17 — La plantilla como sistema operativo de proyecto

> Mejora de la plantilla para convertirla en un "sistema operativo de proyecto"
> orientado a personas no técnicas, con foco en evitar la falsa sensación de avance.

### Añadido
- `PROJECT_STATUS.md` — estado real del proyecto de un vistazo (etapa, qué funciona
  hoy, qué no, cómo probarlo, decisiones, riesgos, nivel de confianza).
- `docs/ESTADOS_DEL_PROYECTO.md` — definición clara de las 6 etapas (idea, documentación,
  demo, prototipo, MVP, producción) para no confundir "enseñable" con "terminado".
- `docs/ONBOARDING_NO_TECNICO.md` — cómo trabajar con Claude día a día: pedir cambios,
  revisar, evitar romper cosas, pedir auditorías.
- `docs/ANTES_DE_COMPARTIR.md` — checklist obligatorio antes de enseñar el repo a
  socios, clientes, inversores, técnicos o trabajadores.
- `docs/PROMPTS_BASE.md` — prompts reutilizables (arrancar, auditar, documentar, backlog,
  preparar para compartir, revisar seguridad).

### Cambiado
- `README.md` — reescrito: explica qué es la plantilla, para quién, cómo usarla, qué
  archivos rellenar, cuáles no tocar y el flujo de trabajo recomendado.
- `.github/workflows/ci.yml` — CI honesto: verifica archivos obligatorios y avisa si
  README/PROJECT_STATUS siguen genéricos, sin dar falsa seguridad. El job de tests del
  producto queda desactivado y documentado hasta que exista stack técnico.
- `CLAUDE.md` y `.claude/CLAUDE.md` — añadido `PROJECT_STATUS.md` al orden de lectura,
  regla de mantenerlo honesto y obligación de distinguir documentación/demo/producción.

---

<!-- Claude añade entradas aquí siguiendo este formato:

## [1.0.0] — YYYY-MM-DD

### Añadido
- Nueva funcionalidad X que permite Y

### Cambiado
- El flujo de Z ahora funciona así en lugar de asá

### Corregido
- El error que ocurría cuando...

### Eliminado
- Se eliminó la funcionalidad X porque...

-->
