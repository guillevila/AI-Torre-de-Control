# ADR-012 — La ventanita junto al puntero

**Fecha:** 2026-08-05
**Estado:** Aceptada
**Extiende:** **D25/D25-bis** (la tarjeta de turno) y **O10** (traer la ventana al frente)
**Introduce:** **D26** (el aviso sale donde estás mirando)

---

## Contexto

D25 puso la respuesta del asistente y un cuadro para contestar **dentro de la
Torre**. Eso quita el trabajo de buscar la ventana de VSCode, pero deja otro:
hay que ir a la Torre. El dueño lo dijo sin rodeos:

> «Yo quiero un pop-up en mi pantalla, más en concreto donde esté mi ratón.»

Y luego explicó la forma de trabajar entera, que es lo que de verdad decide el
diseño:

> «Yo tengo mis conversaciones en mis diferentes repos y accedo desde ahí, y
> conforme voy desarrollando que me vayan saltando los pop-ups y yo actuando.»

Esto **cierra una pregunta de producto** que llevaba abierta: la Torre no es el
sitio desde donde se lanzan las conversaciones. Se lanzan donde siempre, en cada
repositorio. La Torre es **el camino de vuelta**: enterarse y contestar. Todo lo
que empuje hacia «gestiona tus conversaciones desde aquí» va en contra del uso
real.

## Decisión (D26)

Cuando una conversación termina un turno, la tarjeta sale en **una ventana
propia, junto al puntero**, encima de todo lo demás.

Es la misma interfaz, no una copia: la ventanita reutiliza `useTurns` y
`TurnCard`, así que responder desde ella y responder desde la Torre recorren
exactamente el mismo camino. No hay una segunda fuente de verdad.

### Las cuatro cautelas, y por qué

Una ventana que aparece sola encima de todo es intrusiva y puede hacer daño. Las
cuatro reglas existen para que no lo haga:

1. **No roba el teclado** (`showInactive`). Nace visible pero inactiva: no se
   traga lo que estuvieras escribiendo en otro sitio. Un clic y ya escribes.
2. **Aparece al lado del puntero, no debajo** (18 px abajo-derecha), para que un
   clic que ya ibas a dar no caiga dentro sin querer. Si no cabe por ese lado se
   pasa al contrario, y nunca se sale del área útil de la pantalla **en la que
   está el ratón** — con dos monitores, sale en el que estás mirando.
3. **Su aspa no descarta nada.** Cerrarla es «ahora no»: la tarjeta sigue viva en
   la Torre. Lo que descarta de verdad sigue siendo «Dar por vista», que es
   explícito y manda la tarea a *revisada* (D22).
4. **Si ya está abierta, no se recoloca.** Moverla bajo el ratón mientras
   escribes en ella sería lo contrario de ayudar.

Enseña **una** tarjeta —la última— y dice cuántas quedan. Una ventana emergente
con una lista dejaría de ser un aviso para convertirse en otro panel que
gestionar; el resto espera en la Torre.

Nace **encendida**, al revés que el resto de funciones intrusivas del proyecto.
No es una excepción caprichosa: solo puede aparecer si «Responder desde la
Torre» está encendido, que sí nace apagado. Sin turnos no hay ventanita.

## Lo que se descubrió al construirlo

**Electron ralentiza el refresco de las ventanas sin foco**, y esta nace sin
foco a propósito. Con el estrangulamiento puesto la cuenta atrás se congelaba y
la ventanita parecía muerta hasta pincharla — justo lo contrario de lo que tiene
que hacer un aviso. Se apaga con `backgroundThrottling: false`.

Lo encontró la prueba de interfaz, no una revisión a ojo: el test que responde
desde la ventanita agotaba 30 segundos esperando a que el botón se estabilizara.
Con el arreglo, 540 ms. Es el argumento para haber escrito esa prueba: una
segunda ventana de Electron no se puede verificar con tests unitarios.

Segundo detalle, menos vistoso pero capaz de dejar la aplicación colgada: la
ventanita **se esconde en vez de cerrarse** (así reaparecer es instantáneo y no
se pierde lo escrito a medias). Eso significa que sigue contando como ventana
abierta, así que hay que **destruirla** al cerrar la Torre y antes de salir; si
no, la aplicación se quedaría corriendo sin nada en pantalla.

## Alternativas consideradas

- **Notificación del sistema con campo de respuesta.** Windows lo permite, pero
  no cabe la respuesta del asistente —que es lo que hay que leer para decidir—
  y desaparece sola. Se quedan las notificaciones para avisar, no para contestar.
- **Traer la Torre entera al frente.** Tapa la pantalla y obliga a volver atrás.
  La ventanita ocupa 440×520 y se retira sola.
- **Traer la ventana del proyecto al frente (O10, ya construida).** Resuelve
  *encontrar* la conversación, no contestarla sin cambiar de contexto. Siguen
  siendo complementarias y cada una tiene su interruptor.

## Qué haría reconsiderarlo

Que aparezca en mal momento con la suficiente frecuencia como para que el dueño
la apague. La señal a vigilar no es que la cierre —cerrarla es barato y no
pierde nada— sino que apague el ajuste.
