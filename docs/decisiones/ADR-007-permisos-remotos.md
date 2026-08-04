# ADR-007 — Aceptar permisos de Claude Code desde la Torre

**Fecha:** 2026-08-04
**Estado:** Aceptada
**Revisa:** decisión cerrada **D18** → sustituida por **D18-bis**
**Introduce:** **D20** (nada en disco) y **D21** (tiempo de espera con salida)

---

## Contexto

Claude Code se para a pedir permiso antes de ejecutar acciones sensibles. Ese
alto es útil, pero tiene un coste que el dueño del proyecto sufre a diario:
**una sesión puede quedarse cuarenta minutos esperando sin que nadie se entere**,
porque el aviso vive en una terminal que no está en pantalla.

La aplicación ya resolvía la mitad del problema —avisar de que algo te espera—
pero obligaba a cambiar de ventana para resolverlo.

La decisión **D18** prohibía expresamente esto:

> *Ninguna integración debe enviar mensajes, aceptar permisos ni ejecutar
> acciones sensibles en nombre del usuario durante el MVP.*

## La objeción que se planteó, y su respuesta

Antes de decidir se le expuso al dueño del proyecto el riesgo concreto:

> Cuando Claude Code pide permiso, te enseña el comando completo. En una tarjeta
> de la Torre verías menos contexto. La diferencia entre aprobar leyendo y
> aprobar por reflejo es cómo se borra una carpeta que no tocaba.

Se le ofreció una alternativa que no reabría nada: que la Torre solo te llevara
a la sesión de un clic. **El dueño la descartó y reafirmó que quiere el botón.**
Es su producto y su riesgo; queda registrado aquí quién decidió qué.

## Decisión

**La Torre puede transmitir una decisión que el usuario tome explícitamente.**
Nunca decide por su cuenta.

Tres salvaguardas que forman parte inseparable de la decisión:

### 1. El comando completo, no un resumen (D20)

La tarjeta enseña **exactamente** qué se va a ejecutar. Aprobar un resumen sería
peor que no aprobar nada.

Para que eso no rompa D5 —no almacenar contenido—, las peticiones de permiso
**viven solo en memoria**. No entran en la base de datos, no van al historial y
desaparecen en cuanto se deciden. Si la aplicación se cierra, se pierden, que es
justo lo que debe pasar.

### 2. Tiempo de espera con salida digna (D21)

El hook espera tu clic **90 segundos como máximo**. Pasado ese tiempo —o si la
Torre está cerrada, o si el receptor no responde— devuelve `ask` y Claude Code
te pregunta en la terminal **como siempre**.

Esto es lo que convierte la función en un atajo en lugar de un cuello de
botella: **ninguna sesión puede quedarse colgada esperando a la Torre.** Sin
esta salvaguarda, la decisión no se habría aceptado.

### 3. Sigue sin haber decisiones automáticas

No hay reglas, ni listas de comandos permitidos, ni «recordar mi elección». Cada
permiso es un clic humano. Si un día se quisiera automatizar algo, sería otra
decisión y otro ADR.

## Alternativas consideradas

- **Solo llevar a la sesión** (recomendada por Claude). La Torre avisa y abre la
  sesión; apruebas allí viendo todo el contexto. Coste: dos segundos. Riesgo:
  cero. **Descartada por el dueño del proyecto.**
- **Aceptar solo lo inofensivo** (leer ficheros, buscar) y escalar lo demás a la
  sesión. Habría quitado la mayoría de las interrupciones conservando el
  contexto donde importa. **Descartada por el dueño del proyecto.**
- **Mantener D18 intacta.** Descartada: la decisión es del dueño, y se reabrió
  con información nueva —el uso real reveló que las esperas se pierden.

## Consecuencias

**A favor**

- Se resuelve el problema real: enterarte y resolver sin cambiar de ventana.
- El aviso llega por notificación del sistema, así que funciona con la Torre
  cerrada o en un segundo monitor.

**En contra, asumido conscientemente**

- **Aprobar con menos contexto.** La tarjeta enseña el comando, pero no la
  conversación que llevó hasta él. Mitigado enseñando el comando íntegro, sin
  recortar.
- **La Torre deja de ser solo un observador.** Es un cambio de naturaleza del
  producto, no una función más. A partir de aquí, un fallo en la Torre puede
  tener consecuencias fuera de la Torre.
- **Superficie nueva en el receptor local.** El canal de permisos exige la misma
  clave local y las mismas barreras que los eventos, más una: una decisión solo
  puede responderse una vez, y solo para una petición que exista y no haya
  caducado.

**Qué haría reconsiderarlo**

Si en el uso real aparece una sola aprobación por reflejo de la que el dueño se
arrepienta, se revisa. La opción «aceptar solo lo inofensivo» sigue sobre la
mesa como punto intermedio.
