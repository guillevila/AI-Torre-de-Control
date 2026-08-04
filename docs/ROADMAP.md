# Roadmap — Hoja de ruta

> Qué está planeado construir y en qué orden.
> El dueño del proyecto define las prioridades. Claude ayuda a estimar el esfuerzo.

**Última actualización:** 2026-08-03

---

## Estado actual

| Fase | Descripción | Estado | Fecha objetivo |
|------|-------------|--------|----------------|
| Fase 0 | Definición: visión, arquitectura, modelo de estados | ✅ Completado | 2026-08-03 |
| Fase 1 | Vertical local: escritorio, SQLite, estados, avisos, enlaces | 🔄 En progreso | — |
| Fase 2 | Claude Code: recibir eventos por hooks y resolver permisos | ✅ Completado | 2026-08-04 |
| Fase 3 | Navegador: extensión para plataformas web | ⬜ Pendiente | — |
| Fase 4 | Oficina visual avanzada | ⬜ Pendiente | Bloqueada por O4 |
| Fase 5 | Más herramientas: Codex, otras CLIs | ⬜ Pendiente | — |
| Fase 6 | Opcional: sincronización, equipos, integraciones | ⬜ Pendiente | Bloqueada por O5 y O6 |

**Leyenda:** ✅ Completado · 🔄 En progreso · ⬜ Pendiente · ⏸️ En pausa · ❌ Cancelado

**Por qué la Fase 1 no está completa.** La aplicación funciona, pero para cerrar
la fase falta que se pueda instalar como un programa normal en lugar de
arrancarla con comandos. Eso depende de la decisión abierta O1.

---

## Próximos sprints

### Sprint 001 — Primera vertical funcional ✅

Terminado el 3 de agosto de 2026. Detalle en
[sprints/sprint-001.md](sprints/sprint-001.md).

Aplicación de escritorio funcionando: crear tareas, cambiar estados, guardar en
disco, recibir eventos locales, notificar, abrir conversaciones, y dos vistas
conectadas al mismo estado.

### Sprint actual — 002: El diseño, construido ✅

Terminado el 3 de agosto de 2026. Detalle en
[sprints/sprint-002.md](sprints/sprint-002.md).

Se adopta íntegro el sistema de diseño «Oficina de papel»: identidad visual
propia, cinco destinos, planta de oficina por zonas, historial de estados,
alta rápida con `⌘N`, ajustes reales y exportación a CSV.

### Sprint 002 — Primera integración real ⛔ bloqueado

**Bloquea:** decisión abierta **O3** — ¿Claude Code, Codex CLI o una plataforma web?

*Recomendación técnica: **Claude Code**. Sus hooks son un mecanismo oficial y
documentado, mientras que las plataformas web obligan a leer su interfaz, lo que
se rompe en cuanto cambian el diseño.*

Si se elige Claude Code, el trabajo sería:

- Un script que se instale como hook y envíe eventos al receptor local.
- Un asistente en la aplicación que enseñe el cambio ANTES de tocar nada, haga
  copia de seguridad y pida confirmación explícita (decisión D13).
- Asociación entre sesiones de Claude Code y tareas, usando `externalSessionId`
  y `projectPath`, que ya existen en el modelo.
- Desinstalación limpia del hook.

### Sprint 003 — Poder instalarla ⛔ bloqueado

**Bloquea:** decisión abierta **O1** — ¿qué sistema operativo primero?

- Empaquetado con instalador.
- Arranque automático opcional al encender el ordenador.
- Icono en la bandeja del sistema, para que siga vigilando con la ventana cerrada.
- Exportación de los datos, que hoy no existe.

---

## Backlog (ordenado por prioridad)

- [x] ~~Exportar los datos~~ — hecho en el Sprint 002: **Exportar en CSV** desde
      Ajustes.
- [x] ~~Detectar tareas abandonadas~~ — hecho en el Sprint 002: barrido
      automático a «sin confirmar», configurable.
- [x] ~~Historial de cambios de estado por tarea~~ — hecho en el Sprint 002
      (decisión D19).
- [x] ~~Atajos de teclado~~ — hecho en el Sprint 002: `⌘N` para registrar,
      `⌘K` para buscar, `Esc` para cerrar capas.
- [ ] **Importar datos** desde un CSV exportado, para poder restaurar.
- [ ] **Copia de seguridad automática** del fichero de base de datos.
- [ ] **Registro de errores en fichero** — imprescindible para depurar
      integraciones reales cuando fallen.
- [ ] **Agrupar por carpeta de proyecto**, útil cuando varias tareas pertenecen
      al mismo trabajo.
- [ ] **Resolver O7 y O8** (campo «rol» y estado «revisada») con uso real detrás.

---

## Ideas para el futuro (sin comprometer)

- Vista de línea temporal: qué se delegó cada día y cuánto tardó.
- Estadísticas propias: qué herramienta te deja esperando más, cuánto tarda cada
  tipo de encargo.
- Plantillas de tareas para encargos que repites.
- Recordatorio si una tarea lleva demasiado tiempo esperándote.
- Modo claro, además del oscuro actual.

---

## Lo que NO vamos a hacer (y por qué)

- **Ejecutar prompts o consumir APIs de modelos** — decisión D2. El producto
  aprovecha tus suscripciones actuales; meter APIs añadiría costes variables y
  cambiaría lo que es el producto.
- **Guardar el contenido de las conversaciones** — decisión D5. El resultado
  vive en la plataforma original; copiarlo multiplicaría el riesgo de privacidad
  sin aportar nada.
- **Automatización de pantalla** (leer píxeles, mover el ratón) — decisión D14.
  Frágil, invasiva y difícil de mantener. Se usarán eventos, hooks y procesos.
- **Aceptar permisos o enviar mensajes en tu nombre** — decisión D18. La
  aplicación observa y registra; no actúa.
- **Multiusuario o sincronización en la nube** — decisión D12, al menos hasta
  validar el uso personal.
- **Motor de videojuego para la oficina** — decisión D11. La oficina debe
  aportar comprensión, no espectáculo.
