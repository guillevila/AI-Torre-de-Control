# ADR-011 — Responder desde la Torre

**Fecha:** 2026-08-05
**Estado:** Aceptada
**Matiza:** **D5-bis** → **D5-ter** (la respuesta del turno se enseña, sin guardarse)
**Extiende:** **D18-ter** (la Torre transmite ahora también tu mensaje escrito)
**Introduce:** **D25** (el canal de respuesta a fin de turno)

---

## Contexto

Con varias conversaciones a la vez, el dueño pierde tiempo buscando **qué
ventana** era la que terminó. Su petición, literal:

> «Me envía un output Claude, la app me pone un pop-up para que responda,
> respondo y se cierra. Sería lo mismo que si usara VS Code, pero puedo estar a
> otras cosas y no tengo que abrir las ventanas activamente.»

## Decisión (D25)

**Al terminar un turno, la Torre puede enseñar la respuesta del asistente y
esperar la del dueño.** Si contesta a tiempo, su texto viaja de vuelta y la
conversación **continúa en su sesión de siempre** — el mecanismo es el oficial
de Claude Code: un hook de `Stop` que devuelve `decision: block` con el texto
como instrucción siguiente. Si no contesta, el turno termina exactamente como
siempre.

Condiciones inseparables:

1. **Apagado por omisión** (ventana = 0). Se enciende en Ajustes eligiendo
   cuánto esperar (30 s / 1 min / 2 min).
2. **Nada toca el disco (D5-ter).** La respuesta del asistente que se enseña en
   la tarjeta vive solo en memoria, igual que los permisos (D20), y hay un test
   que vigila que no entre ni en la ventana de actividad. Se lee de la cola de
   la transcripción — la única lectura de contenido de todo el enlace,
   expresamente autorizada por el dueño («si tiene que leer la conversación
   entera, que lo haga») y limitada a la última respuesta, recortada a 4000
   caracteres.
3. **La Torre no redacta nada (D18).** Transmite el texto que el dueño tecleó, o
   no transmite nada. «Cerrar» no descarta la entrega: queda en la mesa.
4. **Nunca cuello de botella.** Torre cerrada, función apagada, respuesta rara o
   tiempo agotado → el turno termina como siempre. Todo con test.

## El coste que hay que conocer

**Mientras la tarjeta espera, esa sesión no da su turno por cerrado.** El hook
de `Stop` sostiene la conversación (su tiempo máximo sube de 10 a 330 s). Si el
dueño trabaja activamente EN esa sesión de VSCode, notará que el turno tarda en
cerrarse hasta que la tarjeta caduque o se cierre. La función está pensada para
cuando se está *a otras cosas*; por eso nace apagada y con ventanas cortas.

Se descubrió además al construirla que dos peticiones de red seguidas más
`process.exit` inmediato tumban Node en Windows con una aserción de libuv; el
enlace ahora cierra la conexión en cada petición y drena antes de salir
(comprobado 10/10 tras reproducir el fallo).

## Alternativas consideradas

- **Traer la ventana al frente (O10, ya construida).** Resuelve encontrar la
  ventana, no responder sin cambiar de contexto. Se mantienen ambas: son
  complementarias.
- **Inyectar la respuesta con `claude --resume` en un proceso aparte.**
  Descartada: duplicaría la conversación fuera de su ventana.
- **Remote Control (móvil).** Cubre el caso fuera del ordenador; no el de estar
  en el ordenador a otra cosa. Complementaria también.

## Qué haría reconsiderarlo

Que el sostener turnos moleste en el uso activo real (se baja la ventana o se
apaga), o que el volumen de tarjetas resulte otra lluvia. La tarjeta por turno
hereda la contención de ser una por conversación, pero el uso real manda.
