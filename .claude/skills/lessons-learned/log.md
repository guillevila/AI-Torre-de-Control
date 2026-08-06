# Lessons Learned — Log de lecciones aprendidas

> Este archivo es la memoria persistente del proyecto.
> Claude lo lee al inicio de cada sesión para no repetir errores.
> **No borrar entradas antiguas** — son el historial de aprendizaje.

---

## Cómo añadir una lección

Di a Claude: `/nueva-leccion`
O directamente: *"Anota esto como lección aprendida: [descripción]"*

## Formato estándar

```markdown
## YYYY-MM-DD HH:MM — [Título corto]

**Error o aprendizaje:** [Qué pasó]
**Causa raíz:** [Por qué ocurrió]
**Lección:** [Qué hacer diferente en el futuro]
**Contexto:** [Dónde aplica — siempre, en ciertos módulos, etc.]
```

---

<!-- Las lecciones se añaden debajo de esta línea -->

## 2026-08-03 13:50 — Una dependencia nativa no está elegida hasta que se instala

**Error o aprendizaje:** Se planificó el sprint con `better-sqlite3` como motor de
base de datos, por ser el estándar del ecosistema. Al ejecutar `pnpm install`
falló: no había binario precompilado para Node 24, intentó compilarse desde el
código fuente y pidió Python y las herramientas de compilación de Visual Studio,
que no estaban en el equipo.

**Causa raíz:** Se dio por buena una dependencia con módulos nativos basándose en
su popularidad, sin haber ejecutado la instalación en el equipo objetivo. La
popularidad no dice nada sobre si compilará en TU máquina con TU versión de Node.

**Lección:**
1. Cualquier dependencia que compile código nativo se **prueba instalándola**
   antes de escribir una línea que dependa de ella, y se prueba pronto.
2. En proyectos de un dueño no técnico, una dependencia que exige herramientas de
   compilación es un problema de producto, no solo técnico: convierte
   «instalarlo» en una tarde de configuración. Preferir siempre la alternativa
   que no compile nada, aunque sea menos popular.
3. Lo que salvó el sprint fue tener la base de datos detrás de una interfaz
   (`TaskRepository`). El cambio de motor no tocó ni el dominio ni la interfaz.
   **Mantener esa frontera en toda dependencia externa importante.**

**Contexto:** Siempre, al elegir dependencias. Especialmente las que tocan disco,
red o sistema operativo. Decisión completa en `docs/decisiones/ADR-002-local-first.md`.

---

## 2026-08-03 14:20 — Verificar pronto y con el mecanismo real, no con un atajo

**Error o aprendizaje:** Tres fallos de este sprint (el módulo nativo, el preload
que no cargaba por arrastrar `zod`, y Electron sin abrir ventana por
`ELECTRON_RUN_AS_NODE`) tienen algo en común: **ninguno se podía detectar leyendo
el código**. Solo aparecieron al ejecutar de verdad.

**Causa raíz:** Es tentador escribir mucho código correcto sobre el papel y
dejar la ejecución para el final. Los tres fallos habrían costado mucho más caros
si aparecen con toda la aplicación escrita encima.

**Lección:**
1. **Ejecutar en cuanto haya algo ejecutable**, aunque sea trivial. La instalación
   se probó nada más definir las dependencias; el arranque, nada más tener el
   proceso principal.
2. Cuando el dueño no puede comprobar algo con sus propios ojos (una notificación
   del sistema, la apertura de un enlace), **interceptar el mecanismo real** en la
   prueba automática en vez de darlo por bueno. Se hizo con `Notification` y con
   `shell.openExternal`: se comprueba que la aplicación pide exactamente lo
   correcto, sin efectos molestos.
3. El panel de desarrollo **no** envía eventos por un atajo interno: enseña el
   comando para enviarlos por HTTP como lo hará la integración real. Un atajo
   interno habría dado una falsa sensación de que el canal funciona.

**Contexto:** Siempre. Especialmente antes de escribir en `PROJECT_STATUS.md` que
algo «funciona».

---

## 2026-08-03 22:30 — Un diseño se verifica mirándolo, no compilándolo

**Error o aprendizaje:** Al implementar el sistema de diseño completo, los tests
pasaban en verde y los tipos estaban limpios, pero la pantalla tenía tres
defectos que ninguna prueba automática podía detectar: la planta de oficina
sacaba una barra de desplazamiento horizontal, el nombre de la aplicación se
partía en dos líneas, y dos integraciones distintas se veían con la misma
etiqueta truncada.

**Causa raíz:** Un test comprueba que el dato correcto está en el sitio correcto.
No comprueba que se **vea** bien. Dar por bueno un rediseño porque los tests
pasan es confundir «no está roto» con «está bien hecho».

**Lección:**
1. Al implementar un diseño, **hacer capturas de todas las pantallas y mirarlas
   una a una** contra el documento original. Se puede automatizar con Playwright
   sobre la aplicación real; cuesta un rato y encuentra lo que los tests no ven.
2. Cuando un fallo aparente venga del script de captura y no de la aplicación,
   comprobarlo antes de «arreglar» algo que funcionaba: el conmutador que
   conservaba la vista entre secciones parecía un fallo y era el comportamiento
   que pedía el diseño.

**Contexto:** Siempre que se implemente o modifique interfaz. No sustituye a los
tests: los complementa.

---

## 2026-08-03 22:40 — Un diseño se copia entero, salvo lo que mentiría

**Error o aprendizaje:** El documento de diseño incluía una pantalla de Ajustes
con interruptores de sonido, contador en el icono, tamaño de texto y caducidad
del historial, y una lista de integraciones marcadas como «Hook instalado».
Copiarlo literalmente habría sido copiar bien el diseño y traicionar el producto.

**Causa raíz:** Un documento de diseño describe el destino, no el estado actual.
Sus pantallas están pobladas de datos y capacidades que aún no existen.

**Lección:** Al implementar un diseño, distinguir dos cosas que parecen la misma:
- **Lo que aún no está construido pero se puede construir** → se construye
  (ajustes de avisos, exportar CSV, abrir carpeta).
- **Lo que no está construido y no toca ahora** → **no se dibuja**, y se dice en
  su lugar lo que hay de verdad («Próximamente», «nada se borra solo»).

Un interruptor que no está conectado a nada es exactamente la falsa sensación de
avance que este proyecto existe para evitar. Cuando haya que apartarse del
diseño por este motivo, dejarlo escrito en el ADR y en `PROJECT_STATUS.md`.

**Contexto:** Siempre que se implemente un diseño hecho por otro, o una maqueta.

---

## 2026-08-03 23:10 — Una protección que no se ha disparado nunca no es una protección

**Error o aprendizaje:** El proyecto tenía cinco hooks configurados, uno de ellos
de seguridad (bloquear borrados irreversibles y el acceso a ficheros con
credenciales). **Los cinco llevaban rotos desde el principio** y nadie lo sabía,
por tres motivos acumulados:

1. Cuatro estaban escritos en Bash y uno en Python. **Ninguno de los dos estaba
   disponible** en el equipo.
2. `settings.json` los declaraba en un formato plano, sin el anidamiento `hooks`
   que exige el esquema. Aunque bash hubiera existido, no se habrían cargado.
3. El de seguridad salía con código **1**, que Claude Code trata como error **no
   bloqueante**. Aunque se hubiera ejecutado, no habría bloqueado nada.

**Causa raíz:** Un hook que falla lo hace en silencio, por diseño — para que un
fallo suyo no interrumpa el trabajo. Eso está bien, pero convierte «configurado»
en indistinguible de «funcionando». Nadie comprueba una alarma que nunca ha
sonado.

**Lección:**
1. **Toda protección se prueba disparándola.** Un hook de bloqueo se verifica
   dándole una entrada que DEBE bloquear y comprobando el código de salida, y
   otra que NO debe bloquear para asegurar que no estorba.
2. **No dar por hecho que un intérprete existe.** Bash y Python no están
   garantizados en Windows. Si el proyecto ya exige Node para funcionar, los
   hooks se escriben en Node.
3. **Invocarlos en forma directa** (`"command": "node", "args": [...]`) en lugar
   de a través de un shell: elimina toda una clase de fallos de entorno.
4. Al heredar configuración de una plantilla, **verificar que hace lo que dice**
   antes de confiar en ella. Especialmente si es de seguridad.

**Contexto:** Siempre, con cualquier automatismo o protección: hooks, reglas de
CI, validadores. Vale también para las reglas de permisos.

---

## 2026-08-04 10:20 — Traducir el vocabulario ajeno, no copiarlo

**Error o aprendizaje:** Al conectar Claude Code mapeé su evento `Stop` al estado
«trabajando». El resultado: una sesión que había **terminado su turno y estaba
esperando al usuario** aparecía en el tablero como si siguiera trabajando. El
dueño del proyecto lo detectó en el primer uso real: *«está saltando la
notificación pero no veo que represente el estado en el dashboard»*.

**Causa raíz:** `Stop` describe lo que hace **la herramienta** (el asistente ha
parado de escribir). El estado de la Torre describe **la situación del usuario**
(¿tengo que hacer algo?). Son dos vocabularios distintos, y traduje por parecido
fonético en lugar de por significado. Que el asistente pare significa justo lo
contrario de que siga trabajando: significa que la pelota ha pasado a ti.

Peor aún: el mapeo incorrecto **peleaba** con el correcto. `Notification` ponía
«te espera» y un `Stop` posterior lo devolvía a «trabajando», así que el aviso
saltaba pero el tablero mentía.

**Lección:**
1. Al integrar una herramienta ajena, para cada evento suyo preguntarse **«¿qué
   significa esto para el usuario?»**, no «¿a qué estado se parece el nombre?».
2. Una máquina de estados necesita los eventos que la hacen **avanzar y
   retroceder**. Faltaba `UserPromptSubmit` («vuelve a trabajar»), y sin él no
   había forma de salir de «te espera» de manera natural.
3. Cuando dos eventos escriben el mismo campo, comprobar **en qué orden llegan
   en la vida real**. Dos mapeos que se contradicen producen un fallo
   intermitente, que es el peor de diagnosticar.
4. El primer uso real vale más que cualquier test: ningún test detectó esto
   porque todos usaban el mapeo equivocado como premisa.

**Contexto:** Cualquier integración con eventos de una herramienta externa. Vale
para la futura extensión de navegador: `DOMContentLoaded` no significa «tarea
terminada».

## 2026-08-04 13:20 — Un contrato mal escrito no da error: da silencio

**Error o aprendizaje:** El enlace con Claude Code contestaba a las peticiones de
permiso en el formato equivocado. `PermissionRequest` espera
`hookSpecificOutput.decision.behavior`; se le estaba enviando
`hookSpecificOutput.permissionDecision`, que es el formato de OTRO evento
(`PreToolUse`). Claude Code no se queja de un campo que no conoce: descarta la
decisión sin decir nada y pregunta por su vía normal. Desde fuera parecía que la
Torre no recibía nada, cuando lo único mal era el nombre de un campo.

**Causa raíz:** Se escribió el formato de respuesta **de memoria**, asumiendo que
todos los eventos de Claude Code contestaban igual. No se contrastó con la
documentación oficial. Y no había ninguna prueba que ejecutara el script de
verdad: los tests cubrían la aplicación que RECIBE, no el enlace que CONTESTA.

**Lección:**
1. Cuando se habla con un sistema externo, el formato **se contrasta con su
   documentación oficial antes de escribirlo**, no después de que falle.
2. Todo contrato con un sistema externo necesita una prueba que lo ejecute de
   verdad —proceso real, entrada real, salida real—. Un contrato solo probado
   «por dentro» no está probado.
3. Sospechar siempre de los fallos **mudos**. Que no haya error no significa que
   no haya fallo; en integraciones suele significar justo lo contrario.

**Contexto:** Siempre que este proyecto hable con algo que no controla: hooks de
Claude Code, la futura extensión de Chrome, cualquier integración posterior.

---

## 2026-08-04 13:25 — «Instalado» no es «funcionando»

**Error o aprendizaje:** Tras instalar el enlace, la pantalla de Ajustes decía
«Instalado y al día» y el dueño del proyecto probó a continuación en la sesión de
Claude Code que ya tenía abierta. No pasó nada. Claude Code lee qué avisos debe
mandar **una sola vez, al abrir la sesión**: la que estaba abierta seguía ciega.
Se perdió tiempo buscando el fallo en el código cuando el estado era correcto y
lo que faltaba era reiniciar la sesión.

**Causa raíz:** La pantalla informaba del estado del FICHERO, no del estado
REAL: que el enlace esté escrito no significa que esté activo en las sesiones
vivas. Se dio por hecho un paso que la aplicación no puede dar por el usuario y
no se le dijo.

**Lección:**
1. Cuando una acción de la aplicación **solo surte efecto tras un paso manual**
   (reiniciar, volver a abrir, recargar), ese paso se dice en pantalla, en el
   momento, y con la misma claridad que el éxito. Callarlo convierte un éxito en
   un fallo aparente.
2. Es la misma familia de error que confundir documentación con producto: aquí
   era confundir «configurado» con «funcionando». Ante la duda, describir siempre
   el estado menor.
3. Al diagnosticar, comprobar primero **cuándo se abrió la sesión** frente a
   cuándo se instaló. Un fallo que «empezó a funcionar solo» tras reiniciar casi
   nunca era un fallo de código.

**Contexto:** Todo instalador o integración del proyecto, y toda pantalla que
informe de que algo «está listo».

## 2026-08-04 14:35 — Una defensa que descarta la intención del usuario es peor que no tenerla

**Error o aprendizaje:** Al corregir el formato de las peticiones de permiso se
añadió, «por prudencia», una comprobación extra: si Claude Code indicaba qué
decisiones admitía esa petición y la tomada no estaba en la lista, el enlace se
apartaba sin contestar. La comprobación no miraba la FORMA de ese dato. En
cuanto llegó distinto de lo previsto, el enlace empezó a descartar decisiones
humanas reales en silencio: el dueño del proyecto pulsaba «Aceptar» y no pasaba
absolutamente nada. La corrección introdujo un fallo tan mudo como el que venía
a arreglar.

**Causa raíz:** Se añadió una salvaguarda **no pedida** en el mismo cambio que
arreglaba un fallo, y se le dio poder para anular una decisión ya tomada por una
persona. Al fallar, falló en la dirección más cara: hacia el silencio.

**Lección:**
1. Una comprobación defensiva **nunca** debe poder anular una acción explícita
   del usuario por no entender un dato. Si el dato no se entiende, se ignora el
   dato, no la decisión. **Ante la duda, la intención humana gana.**
2. Toda salvaguarda tiene que declarar en qué dirección falla, y elegir la
   barata. Aquí: contestar de más solo habría hecho que Claude Code descartara
   una respuesta que no esperaba; tragarse un clic dejó el producto roto.
3. No mezclar en un mismo cambio el arreglo de un fallo y una precaución que
   nadie ha pedido. Si la precaución falla, se atribuye el fallo al arreglo y se
   pierde el rastro.
4. Un dato que llega de fuera se valida por su **forma** antes de darle poder de
   decisión. `Array.isArray()` no basta: importa qué hay dentro.

**Contexto:** Todo lo que interpreta datos de sistemas que no controlamos —hooks
de Claude Code, la futura extensión de Chrome— y, en general, cualquier
comprobación colocada entre una persona y lo que acaba de pedir.

## 2026-08-04 20:20 — Lo que se lee al arrancar es el fallo mudo favorito de este proyecto

**Error o aprendizaje:** En una sola jornada, el MISMO fallo tres veces, con tres
disfraces distintos y siempre el mismo síntoma —«lo he activado y no hace nada»—:

1. **Los hooks de Claude Code** se leen al abrir la sesión. Se instalaron con una
   sesión ya abierta y esa sesión nunca se enteró.
2. **El manifiesto de una extensión** lo lee Chrome al cargarla. Se añadió un
   permiso nuevo y Chrome seguía con la lista vieja, así que rechazaba la
   petición sin decir nada.
3. **Un vigilante de página** solo entra en las pestañas que se cargan después de
   darlo de alta. La pestaña que el dueño del proyecto tenía delante se quedó
   fuera.

Las tres veces el estado era correcto, la configuración era correcta, y no había
ni un error a la vista. Las tres veces se buscó el fallo en el código.

**Causa raíz:** Se pensó en el estado («¿está instalado?») en lugar de en el
momento («¿estaba instalado cuando eso arrancó?»). Casi todo lo que se integra
con un programa ajeno lee su configuración **una sola vez, al arrancar**, y desde
fuera «configurado» y «funcionando» se ven exactamente igual.

**Lección:**
1. Al integrar con algo ajeno, la primera pregunta es **cuándo lee su
   configuración**. Si la lee al arrancar, hay dos estados distintos —escrito y
   cargado— y la interfaz tiene que distinguirlos.
2. **Resolverlo, no documentarlo.** Un aviso de «reinicia» es mejor que nada,
   pero mucho peor que hacerlo por el usuario. En el tercer caso se metió el
   vigilante en las pestañas ya abiertas y el problema desapareció; en los dos
   primeros solo se avisó, y aun así hubo que explicarlo cada vez.
3. **Al diagnosticar, comparar relojes antes que código.** Cuándo se instaló
   frente a cuándo arrancó lo otro. Un fallo que «se arregla solo» al reiniciar
   casi nunca estuvo en el código.
4. El cuaderno de bitácora resolvió los tres. Lo que lo hizo no fue lo que
   apuntaba, sino **lo que faltaba**: se veía «vigilante puesto» y no «vigilante
   en marcha», y ahí estaba la respuesta. **Al diseñar un diagnóstico, apuntar
   también los hitos que DEBERÍAN ocurrir**, para que su ausencia signifique algo.

**Contexto:** Toda integración con un programa que no controlamos: hooks,
extensiones de navegador, y lo que venga después.

## 2026-08-05 11:30 — Una prueba que no usa el ratón no prueba que se pueda pulsar

**Error o aprendizaje:** El dueño del proyecto no podía seleccionar los muñecos
de la oficina. Al reproducirlo salió algo peor de lo esperado: **ningún muñeco
se podía pulsar con el ratón**, y llevaba así desde que la planta se inclinó.

La planta va con `rotateX(19deg)` y cada figura lleva la contrarrotación que la
endereza. Eso mueve los botones a donde se VEN, pero el navegador seguía
registrando el clic sobre el contenedor, que no tenía manejador. El clic caía en
un hueco: ni error, ni pista, ni nada.

**Causa raíz:** Ninguna prueba pulsaba un muñeco. Las que tocaban la oficina
comprobaban que la figura **aparecía** en la zona correcta —que es lo que se
había diseñado con cuidado— pero nunca que se pudiera **usar**.

Y hay un agravante: al diagnosticarlo, un `element.click()` de JavaScript
funcionaba perfectamente. El manejador nunca estuvo mal. Una prueba escrita así
—que es lo cómodo— habría pasado en verde durante meses con la aplicación rota.

**Lección:**
1. **Un clic de prueba tiene que ser un clic de ratón.** `element.click()` de
   JavaScript se salta el hit-testing del navegador, que es justo donde vivía
   este fallo. Si la prueba no puede fallar por dónde está el elemento, no está
   probando que se pueda pulsar.
2. **Todo lo que se pueda pulsar necesita una prueba que lo pulse.** Comprobar
   que algo *se ve* no dice nada sobre si *sirve*. Aquí lo visual estaba
   perfecto y lo funcional muerto.
3. **Cuidado con `transform-style: preserve-3d` y las rotaciones.** Separan lo
   que se ve de dónde cae el clic. Si una interfaz usa 3D, el manejador va en un
   elemento que el navegador sí encuentre, y se comprueba con el ratón.
4. Al diagnosticar «pincho y no pasa nada», la pregunta que lo resolvió en un
   minuto fue **`document.elementFromPoint(x, y)`**: qué hay de verdad donde se
   pulsa. Antes de sospechar del manejador, mirar dónde aterriza el clic.

**Contexto:** Toda la vista de oficina, y cualquier interfaz futura con
transformaciones. También la forma de escribir pruebas de interfaz en general.

## 2026-08-05 12:35 — Buscar patrones en un comando no es entenderlo

**Error o aprendizaje:** Se construyó una guardia para bloquear comandos de Git
peligrosos. Tenía 46 pruebas y todas pasaban. Una auditoría adversarial —cuatro
revisores independientes, cada hallazgo verificado por otro agente que intentaba
refutarlo— le encontró **34 agujeros confirmados**.

Todos venían del mismo error: **buscar patrones en el texto crudo del comando**
en lugar de analizarlo. Ejemplos reales de lo que se colaba:

- Un comando de lectura al principio eximía a TODO lo que venía encadenado
  detrás. Anulaba las cinco reglas de golpe.
- La ruta completa de una referencia rompía el reconocimiento de la rama.
- El prefijo `+` de un refspec significa forzar, y nadie lo miraba.
- Unas comillas alrededor del nombre desactivaban la protección entera.
- Los flags cortos agrupados escondían el de forzar.
- Un push en modo espejo borra el remoto entero sin nombrar ninguna rama.
- La extensión `.exe` en el binario rompía el ancla de todas las reglas.

Y lo simétrico, igual de grave: escribir un mensaje de commit que **mencionara**
uno de esos comandos quedaba bloqueado. Este mismo hook llegó a bloquear la
lección que lo contaba, dos veces.

**Causa raíz:** Se confundió «reconocer un texto» con «entender una orden». Una
expresión regular sobre la cadena entera no sabe qué es un comando, qué es un
argumento y qué es una cita. Y la primera versión pasaba sus 46 pruebas porque
las escribió quien tenía el mismo modelo mental equivocado: probaban las formas
que se le habían ocurrido, no las que existen.

**Lección:**
1. **Para decidir sobre un comando, hay que trocearlo.** Separar por los
   encadenadores del shell, partir en argumentos respetando comillas, normalizar
   el binario, y decidir sobre los argumentos. Nunca sobre la cadena.
2. **Una lista blanca se aplica a un comando, nunca a una línea.** «Empieza por
   algo inofensivo» no es lo mismo que «es inofensivo».
3. **Quien escribe el código no puede ser el único que escriba sus pruebas de
   seguridad.** Comparten el punto ciego. Hizo falta un adversario con el
   encargo explícito de romperlo.
4. **Un guardián se mide por sus dos mitades:** lo que deja pasar y lo que
   estorba. La segunda decide si sigue instalado dentro de un mes.
5. Auditar con varias lentes independientes —evasión, falsos positivos,
   coherencia, rotura— y **verificar cada hallazgo con otro agente que intente
   refutarlo** encontró en veinte minutos lo que no habría aparecido en meses.

**Contexto:** Cualquier cosa que decida sobre entrada que no controlamos:
guardias, validadores, detectores. Y la forma de auditar algo antes de que se
convierta en la ley del repositorio.

## 2026-08-05 15:35 — Estar en la página no es verse en la pantalla

**Error o aprendizaje:** El vigilante de la extensión detecta si una herramienta
web está generando una respuesta mirando si existe su botón de parar. Funcionó
al primer intento… y luego la tarea se quedaba en «trabajando» para siempre: no
pasaba a terminada al acabar, y al preguntar de nuevo tampoco volvía a
trabajando, porque para el vigilante nunca había dejado de trabajar.

La causa: **`querySelector` encuentra también los elementos ocultos**. ChatGPT
tiene el botón de parar permanentemente en el HTML y solo lo muestra o lo
esconde, como hacen casi todas las interfaces modernas. El vigilante lo
encontraba siempre.

**Causa raíz:** Se confundió «existe en la página» con «se ve». Son cosas
distintas desde que las interfaces se construyen con componentes: lo normal es
que todo esté siempre en el HTML y lo que cambie sea la visibilidad. Detectar
por presencia es detectar el andamiaje, no el estado.

**Lección:**
1. **Para saber qué está pasando en una interfaz, no basta con que el elemento
   exista: tiene que VERSE.** Comprobar tamaño real, `visibility`, `display`,
   `hidden` y `aria-hidden`.
2. **Recorrer todas las coincidencias, no la primera.** Un elemento oculto
   delante del bueno produce el fallo simétrico: un falso negativo.
3. **Cuidado con los patrones amplios en interfaces con varios botones
   parecidos.** Un «Stop» a secas coincidía también con el dictado por voz y con
   leer en voz alta. Confundirlos deja el estado atascado para siempre, que es
   mucho peor que no detectar nada.
4. **Un estado que no puede salir de sí mismo necesita una alarma.** Se añadió
   que, si lleva más de cinco minutos «generando», lo apunte en el cuaderno con
   el selector que está acertando. No corrige el estado —inventarse un dato sería
   peor— pero deja de callarse, que es lo que costó encontrarlo.
5. Esto **no se puede probar sin un navegador**, y el proyecto no tiene jsdom.
   Se dijo tal cual en la PR en vez de simular una prueba que no comprobaría
   nada. Un test verde que no prueba lo que dice es peor que no tenerlo.

**Contexto:** El vigilante de la extensión y cualquier detección futura sobre
una interfaz que no controlamos.

## 2026-08-06 — Un canal nuevo hereda los relojes del viejo, y no encajan

**Qué pasó.** Al construir el fin de turno con respuesta (D24), el evento `Stop`
ya estaba enganchado desde hacía semanas con un tope de **10 segundos**, que era
de sobra para lo único que hacía entonces: mandar un aviso y salir. La función
nueva necesita retener ese evento hasta tres minutos. Claude Code habría matado
el enlace a los 10 segundos, mucho antes de que diera tiempo a leer nada — y la
respuesta se habría perdido justo después de escribirla.

**Causa raíz.** Se miró el canal nuevo y no la configuración que ya existía. El
número estaba puesto para el uso viejo, y nadie lo revisó al cambiar el uso.

**Lección.** Cuando una función nueva usa una tubería que ya existe, hay que
**listar todos los límites que la gobiernan** —tiempos, tamaños, reintentos— y
comprobarlos uno a uno contra el uso nuevo. Aquí eran tres relojes en tres
sitios distintos (Torre, enlace, Claude Code) y solo funcionan si están
ordenados de dentro afuera. Quedan escritos juntos en el contrato, con el aviso
de que tocar uno obliga a repasar los otros dos.

---

## 2026-08-06 — Lo que revienta no siempre lo dice el código de salida

**Qué pasó.** El enlace empezó a fallar con código `3221226505`. Solo con ese
número no había forma de saber nada: parecía un fallo de la lógica nueva. El
ayudante de pruebas capturaba la salida estándar pero **no la de error**, así
que la causa real estaba escrita en un sitio que nadie leía. Al capturarla,
apareció en una línea: `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`
— Node se estrellaba al salir porque `fetch` dejaba una conexión viva en el pozo
al hacer dos peticiones seguidas.

**Causa raíz.** El ayudante se escribió cuando el enlace solo hacía una llamada y
nunca fallaba de forma rara. La ceguera no molestó hasta que hubo algo que ver.

**Lección.** Un proceso que se lanza desde una prueba tiene que traerse **las dos
salidas**, siempre. Es el mismo error de fondo que ya costó dos fallos mudos en
este canal: no mirar lo que el sistema estaba diciendo. Y para un script que
vive segundos y termina con `process.exit()`, `node:http` con `agent: false` es
más seguro que `fetch`: no reutiliza conexiones, así que no queda nada a medio
cerrar.
