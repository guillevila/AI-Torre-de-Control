# ADR-001 — Electron como base de la aplicación de escritorio

**Fecha:** 2026-08-03
**Estado:** Aceptada
**Relacionada con:** decisiones D16 y D1 de [SYSTEM_VISION.md](../../SYSTEM_VISION.md)

## Contexto

El producto tiene que ser una aplicación que se abre en el ordenador, no una web.
Los motivos son de producto, no técnicos:

- Debe poder **avisar al usuario** aunque no tenga la aplicación delante.
  Una pestaña de navegador cerrada no notifica nada.
- Debe **escuchar eventos de herramientas locales** (hooks de Claude Code,
  procesos, futuros adaptadores). Una web no puede abrir un puerto local.
- Debe **funcionar sin conexión y sin servidor**, porque el dato es privado y no
  queremos ni costes ni infraestructura (D1).
- Debe **abrir enlaces externos** en el navegador del sistema.

## Decisión

Usar **Electron** como contenedor de la aplicación de escritorio.

## Alternativas consideradas

- **Tauri** — más ligero y con binarios mucho más pequeños. Descartada porque el
  proceso de sistema se escribe en Rust: sería un segundo lenguaje que mantener
  para el mismo problema, y el proyecto lo lleva una sola persona con ayuda de
  IA. La ventaja de tamaño no compensa esa fractura.
- **Aplicación web con un pequeño servidor local** — descartada porque obliga al
  usuario a mantener un proceso arrancado a mano y no da notificaciones nativas
  fiables.
- **Nativo por sistema operativo** (WinUI, SwiftUI…) — descartada: multiplicaría
  el trabajo por cada sistema y no aporta nada al problema real.
- **CLI en terminal** — descartada: la metáfora de la oficina y el «entenderlo de
  un vistazo» son requisitos de producto, no adornos.

## Consecuencias

**A favor**

- Un solo lenguaje (TypeScript) para interfaz, lógica de sistema y la futura
  extensión de navegador. Todo el conocimiento se reutiliza.
- Notificaciones, apertura de enlaces y bandeja del sistema resueltos de serie.
- Ecosistema enorme y muy documentado, lo que importa cuando quien programa es
  mayoritariamente una IA.

**En contra**

- La aplicación empaquetada pesará bastante (~150 MB). Aceptable para una
  herramienta personal de escritorio.
- Consumo de memoria mayor que una aplicación nativa.
- Electron obliga a ser disciplinado en seguridad: la interfaz debe ir aislada
  (`contextIsolation`, `sandbox`, sin integración con Node) y la superficie de
  comunicación debe ser mínima y explícita. Ya está implementado así.

**Revisión**

Se reabriría si el peso del instalable resultara un obstáculo real para
distribuirlo, o si apareciera un problema de rendimiento medible. No antes.
