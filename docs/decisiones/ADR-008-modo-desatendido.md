# ADR-008 — La Torre aprueba sola: modo desatendido

**Fecha:** 2026-08-04
**Estado:** Aceptada
**Revisa:** **D18-bis** («la Torre nunca decide sola») → sustituida por **D18-ter**
**Introduce:** **D24** (modo desatendido, apagado por omisión)

---

## Contexto

[ADR-007](ADR-007-permisos-remotos.md) abrió la puerta a resolver permisos desde
la Torre, pero cerró expresamente esta otra:

> **Sigue sin haber decisiones automáticas.** No hay reglas, ni listas de
> comandos permitidos, ni «recordar mi elección». Cada permiso es un clic humano.
> **Si un día se quisiera automatizar algo, sería otra decisión y otro ADR.**

Este es ese otro ADR.

El uso real trajo información nueva. Con Claude Code trabajando de verdad en
VSCode, **el volumen de permisos es mucho mayor de lo previsto**: un turno normal
pide editar varios ficheros y ejecutar varios comandos. Un clic por cada uno no
es un atajo, es la misma interrupción que se quería quitar, solo que en otra
ventana. Y hay un caso que D18-bis no contemplaba: **que el dueño no esté
delante**. Un clic humano exige un humano.

## La objeción que se planteó, y su respuesta

Antes de construir nada se le expuso al dueño del proyecto que esto contradice
D18-bis y el ADR-007, y se le ofrecieron dos alternativas más conservadoras:

1. **Auto-aprobar solo lo inofensivo** (editar ficheros, leer, buscar) y seguir
   preguntando por los comandos. Es la opción que ADR-007 dejó «sobre la mesa
   como punto intermedio».
2. **Dejarlo fuera de la Torre**: usar el modo de permisos de Claude Code, que ya
   permite no preguntar nada. Cuesta cero líneas de código.

**El dueño del proyecto reafirmó que quiere que la Torre apruebe todo**, con
estas palabras: *«la torre sí va a decidir sola, tiene que aceptar las preguntas
de edit y todo eso que haga claude en vscode solo»*. Es su producto y su riesgo;
queda registrado aquí quién decidió qué.

Conviene anotar el argumento que **juega a favor** de su decisión, porque existe:
la alternativa 2 —el modo de permisos de Claude Code— no deja rastro de nada. La
Torre aprobando sí lo deja. Entre dos formas de no ser interrumpido, la que
registra lo que aprobó es mejor que la que no registra nada.

## Decisión

**La Torre puede aprobar permisos sola cuando el usuario lo ha pedido
explícitamente encendiendo un interruptor.**

Cuatro condiciones que forman parte inseparable de la decisión:

### 1. Apagado por omisión, y opt-in explícito

El ajuste `autoApprovePermissions` nace en `false`. Un `PermissionService`
construido sin ese parámetro se comporta exactamente como antes de este ADR —hay
un test que lo fija—, de modo que nadie activa esto por descuido.

### 2. Visible mientras está activo, desde cualquier pantalla

Un aviso permanente en ámbar, **que no se puede cerrar**, con un botón de apagado
a un clic. Enterarse de que la Torre está decidiendo por ti no puede depender de
que entres en Ajustes. Es la contrapartida de quitar la barrera.

### 3. No pasa por «te espera», y por tanto no avisa

Si la Torre va a decir «sí» al momento, nadie está esperando. Pasar por ese
estado dispararía una notificación de Windows por cada permiso —decenas por
minuto con un asistente trabajando— y el dueño acabaría apagando los avisos, que
son la función original del producto. La tarea se queda en «trabajando», que es
la verdad. Hay un test que comprueba que **el historial no contiene ni un paso**
por «te espera».

### 4. Queda registrado qué se aprobó, con el comando entero

Todo lo auto-aprobado entra en «Señales recibidas del enlace» con el comando
íntegro, marcado como `aprobado solo`. El tope del registro sube de 40 a 200
entradas, porque con este modo 40 se agotan en un minuto.

**Limitación honesta:** ese registro vive en memoria y se pierde al cerrar la
Torre. No puede ser de otra manera sin romper **D20** (las peticiones de permiso
nunca se escriben en disco), que existe para poder enseñar el comando completo
sin violar D5. Es decir: **la trazabilidad de este modo es volátil**. Quien
quiera un registro permanente de lo aprobado tendrá que reabrir D20, y eso es
otro ADR.

## Lo que este modo NO cambia

- **No amplía lo que el asistente puede hacer.** Los hooks de protección del
  proyecto actúan *antes* de que la petición salga hacia la Torre. Lo que ellos
  bloquean nunca llega aquí.
- **No aprueba lo que no entiende.** Una petición que no cumple el contrato sigue
  devolviendo `timeout`, no un «sí». Hay un test que lo fija: el modo desatendido
  no puede convertirse en un «sí» a cualquier cosa que llegue al puerto.
- **D21 sigue en pie** para el modo normal: sin auto-aprobación, si no decides en
  90 segundos Claude Code pregunta en su terminal.

## Alternativas consideradas

- **Auto-aprobar solo lo inofensivo** y escalar los comandos a un clic humano.
  Habría quitado la mayoría de las interrupciones conservando la barrera donde
  importa. **Descartada por el dueño del proyecto.**
- **Usar el modo de permisos de Claude Code** en lugar de tocar el producto.
  Cero código, cero riesgo nuevo en la Torre, cero trazabilidad. **Descartada por
  el dueño del proyecto**, y con razón: no deja rastro.
- **Auto-aprobar con lista de comandos permitidos** configurable. Descartada por
  Claude como primera versión: una lista mal escrita da una falsa sensación de
  control peor que no tener ninguna. Si se quiere granularidad, el sitio natural
  es la alternativa 1.
- **Mantener D18-bis intacta.** Descartada: la decisión es del dueño y se reabrió
  con información nueva —el volumen real de permisos y el caso de no estar
  delante.

## Consecuencias

**A favor**

- Desaparece la interrupción por completo, que es lo que se buscaba.
- A diferencia de desactivar los permisos en Claude Code, **queda rastro** de
  cada cosa aprobada, con el comando entero.
- Se puede apagar desde el propio aviso, sin buscar en Ajustes y sin reiniciar:
  el interruptor se lee en cada petición.

**En contra, asumido conscientemente**

- **Desaparece la última barrera humana.** Un comando equivocado se ejecuta sin
  que nadie lo lea. La red de seguridad que queda son los hooks del proyecto, que
  cubren una lista concreta de patrones, no todo lo imaginable — y que **solo
  existen en los repositorios que los tengan instalados**.
- **La Torre pasa de transmitir decisiones a tomarlas.** Es el segundo cambio de
  naturaleza del producto en dos días. Un fallo en la Torre ahora puede aprobar
  algo que nadie quería.
- **La trazabilidad es volátil** (ver condición 4). Si la Torre se cierra, no
  queda constancia de lo aprobado.

**Qué haría reconsiderarlo**

Una sola aprobación automática de la que el dueño se arrepienta. La alternativa
«solo lo inofensivo» sigue sobre la mesa, y ahora con más motivo: el interruptor
ya existe, y hacerlo granular es cambiar una condición, no rehacer nada.
