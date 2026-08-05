# Changelog — Historial de cambios

> Registro de todos los cambios significativos del proyecto.
> El más reciente siempre arriba.
> Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)

---

## [Sin publicar]

> Los cambios en desarrollo van aquí hasta que se publican.

### Añadido — la tarjeta se lee como el chat del editor (D26-quater)

**A petición del dueño**: «¿se puede copiar la pantalla de VSCode con las
opciones que tiene en el chat para que el pop-up se vea igual?». La apariencia
sí; las opciones no — y conviene saber por qué, está más abajo.

- **El turno alterna lo dicho con lo hecho.** Cada herramienta es un renglón:
  qué (`Edit`, `Bash`, `Read`), sobre qué (el **nombre** del fichero, con la
  ruta entera al pasar el ratón) y cuánto cambia (`+12 −3`).
- **Los cambios se despliegan en diff con color**, plegados por omisión: la
  tarjeta se lee de un vistazo y el detalle se pide. Añadido y quitado se
  distinguen por color **y** por el signo, para quien no distinga bien los
  colores.
- **Sin dependencias nuevas.** El diff lo calcula el propio enlace quitando lo
  que ambos lados tienen igual al principio y al final. No es un algoritmo de
  comparación completo, y para lo que hace una edición —sustituir un trozo
  concreto— da exactamente lo que se ve en el editor.
- **Un turno grande no manda un envío gigante.** Hay un presupuesto para los
  diffs: al agotarse, la herramienta **sigue apareciendo con sus cuentas** pero
  sin detalle. Saber qué se tocó importa más que ver cada línea. El receptor
  admite ahora 128 KB en la ruta de turnos (antes 16 KB), como red de seguridad.
- **Amplía D5-ter**: además de la prosa del asistente, la tarjeta contiene ahora
  **rutas, comandos y trozos de código**. Sigue todo en memoria y muere al
  decidir o al cerrar la Torre.
- **Compatible hacia atrás**: con el enlace sin actualizar no llegan pasos y la
  tarjeta enseña el texto de siempre.
- **Lo que NO se puede replicar, y por qué:** los botones de aceptar o descartar
  un cambio. No es dificultad — cuando la tarjeta aparece, el turno **ya
  terminó** y los cambios están hechos. Esto es lo ocurrido, no una propuesta
  pendiente. Tenerlos exigiría que la Torre alojase la conversación (O12).
- **393 tests** unitarios (7 nuevos: el diff y sus cuentas, el comando, el
  fichero nuevo, la edición que no cambia nada, el presupuesto y el tope de
  pasos) y **15 de interfaz** (1 nuevo, que despliega el diff en la ventana real).

### Corregido — la tarjeta enseñaba trozos sueltos del turno (D26-ter)

**Lo detectó el dueño preguntando**: «el output no se debería mandar hasta que
no se terminara de procesar la info; VSCode muchas veces manda mensajes
intermedios». Tenía razón, y el fallo era peor de lo que parecía.

- **Un turno no es un mensaje, son varios.** El asistente narra lo que va a
  hacer, usa una herramienta, cuenta lo que encontró, usa otra, y concluye. Se
  leía **solo la última entrada**, así que un turno acabado en «Listo» enseñaba
  eso y nada más — sin la explicación, que es justo lo que hace falta para poder
  contestar. Y si el turno terminaba tras una frase intermedia, esa frase se
  enseñaba **como si fuera la respuesta final**.
- **Ahora se recoge el turno entero**, desde tu último mensaje: lo mismo que
  verías en la ventana de VSCode. Los resultados de las herramientas también
  viajan como mensajes de «user» y **no** cortan el turno; el razonamiento
  interno no se enseña; y si no cabe en 4000 caracteres se conserva el **final**,
  que es la conclusión.
- **Lo que no cambia, y responde a la pregunta de fondo:** esto se lee solo
  cuando Claude Code emite `Stop`, o sea cuando ya ha terminado de responder y
  se queda esperando. La tarjeta **nunca** aparece mientras el asistente trabaja.
- **386 tests** unitarios (5 nuevos: el turno entero, el resultado de herramienta
  que no debe cortarlo, el corte en tu mensaje anterior, el razonamiento
  excluido y el recorte que conserva el final).

### Añadido — la respuesta se lee como en VSCode (D26-bis)

**A petición del dueño**: «un recuadro que no ocupe la pantalla entera pero que
se vea el texto entero en un formato igual que el que se vería en VS Code».

- **Bloques de código en su recuadro**, con el lenguaje y un botón de copiar.
  No se parten las líneas: se desplazan, como en el editor — una línea de
  comandos partida por la mitad es la forma más fácil de copiar algo que no
  funciona. También títulos, listas, citas, negritas y código en línea.
- **Un bloque de código sin cerrar sigue siendo código.** Pasa de verdad: la
  respuesta puede llegar recortada a 4000 caracteres, y desmaquetar todo el
  final sería lo peor posible.
- **Nada de lo que llega se interpreta como marcado.** El analizador devuelve
  datos, no HTML, y el componente los pinta con React uno a uno: un mensaje con
  `<script>` se ve **como texto**. No es teórico — el texto viene de una
  conversación, que puede incluir lo que otra persona metió en un fichero del
  proyecto. Hay un test unitario y uno de interfaz que lo vigilan.
- **La ventanita crece** (560×640) y se puede estirar; dentro de ella el alto
  del texto lo pone la ventana, así que agrandarla enseña más respuesta.
- **381 tests** unitarios (13 nuevos del analizador) y **14 de interfaz** (1
  nuevo, que comprueba en la ventana real que el código se ve entero y que el
  HTML no se ejecuta).

### Añadido — el aviso sale junto al ratón (D26)

**A petición del dueño**, que además explicó la forma de trabajar que lo
justifica: sigue abriendo sus conversaciones en cada repositorio, como siempre,
y quiere que los avisos le salten al paso mientras desarrolla. Eso deja claro
qué es la Torre: **no el sitio desde donde se lanzan las conversaciones, sino el
camino de vuelta.**

- **La tarjeta sale en una ventana propia, junto al puntero**, encima de todo
  —incluso de una aplicación a pantalla completa— y en el monitor donde esté el
  ratón. La Torre puede estar minimizada.
- **Cuatro cautelas, porque una ventana que aparece sola puede hacer daño:** no
  roba el teclado (no se traga lo que escribes en otro sitio), sale *al lado*
  del puntero y no debajo (un clic que ya ibas a dar no cae dentro), nunca se
  sale de la pantalla, y no se recoloca si ya estaba abierta.
- **Su aspa no descarta nada.** Cerrarla es «ahora no»: la tarjeta sigue viva en
  la Torre. Lo que descarta de verdad sigue siendo «Dar por vista».
- **Es la misma interfaz, no una copia**: reutiliza la tarjeta y el enganche de
  turnos de la Torre, así que responder desde una ventana o desde la otra
  recorre el mismo camino.
- **Un fallo real encontrado por la prueba de interfaz:** Electron ralentiza el
  refresco de las ventanas sin foco, y esta nace sin foco a propósito; la cuenta
  atrás se congelaba y la ventanita parecía muerta hasta pincharla. Corregido
  (`backgroundThrottling: false`): el test pasó de agotar 30 s a **540 ms**.
- Interruptor en Ajustes → «Responder desde la Torre». Nace encendido, pero solo
  puede aparecer si esa función está activa, y esa sí nace apagada.
- **368 tests** unitarios (12 nuevos de geometría: cuatro esquinas, barra de
  tareas, monitor secundario con coordenadas negativas, pantalla más pequeña que
  la ventana) y **13 de interfaz** (3 nuevos, con la segunda ventana real).

### Cambiado — la tarjeta de turno ya no caduca (D25-bis)

**A petición del dueño**, y con razón: una tarjeta con cronómetro convertía
«estar a otras cosas» en una carrera. Ahora la tarjeta **se queda hasta que
actúes**.

- **Dos vidas en la misma tarjeta.** Mientras la sesión está *sostenida* (los
  segundos de Ajustes), tu respuesta entra por ella. Pasado ese rato el turno
  termina como siempre —aviso y entrega— pero **la tarjeta sigue ahí**, marcada
  con ⏸, y responder entonces **relanza la conversación** donde estaba.
- **«Dar por vista»** manda la tarea a **revisada**, y en su ficha aparece un
  cuadro para **retomar la conversación cuando quieras**. Ese es el «estado
  pausado» pedido: ya existía (D22), solo le faltaba la puerta.
- **La Torre pasa a lanzar procesos** para poder contestar un turno ya cerrado
  (`claude -p --resume`). Ampliación real de D18-ter, con cuatro cautelas: el
  texto va por **entrada estándar** (nunca en la línea de comandos), el
  identificador se valida como UUID, se lanza **sin intérprete de comandos**, y
  si falla **la tarjeta no desaparece** — una respuesta escrita no se pierde en
  silencio. Invocación comprobada en vivo.
- **Límites declarados**: la continuación es otra sesión (la tarea libera su
  identificador para que la adopte, D23-bis), y en un proyecto cuyo diálogo de
  confianza no se haya aceptado nunca, la conversación se retoma con los
  permisos del proyecto ignorados.
- **356 tests** unitarios y 10 de interfaz, en verde.

### Añadido — responder a Claude desde la Torre (D25)

**La petición fundacional del producto, construida:** termina un turno, la Torre
te enseña **lo que Claude ha respondido** en una tarjeta, escribes tu respuesta
ahí mismo, y la conversación **continúa en su sesión de siempre** — sin buscar
ninguna ventana. Se activa en Ajustes → «Responder desde la Torre» eligiendo
cuánto espera (30 s / 1 min / 2 min; apagado por omisión).

- **El mecanismo es el oficial de Claude Code**: el hook de Stop devuelve
  `decision: block` con tu texto como siguiente instrucción. No hay procesos
  nuevos ni conversaciones duplicadas.
- **Nada se guarda (D5-ter).** La respuesta que se enseña se lee de la cola de
  la transcripción —la única lectura de contenido del enlace, autorizada
  expresamente por el dueño—, vive en memoria como los permisos (D20) y hay un
  test que vigila que no entre ni en la ventana de actividad.
- **Nunca cuello de botella**: Torre cerrada, función apagada o tiempo agotado →
  el turno termina como siempre. «Cerrar» no descarta la entrega.
- **Coste declarado**: mientras la tarjeta espera, esa sesión no da su turno por
  cerrado (el tiempo del hook de Stop sube de 10 a 330 s).
- **Arreglado de paso un fallo real**: dos peticiones de red seguidas +
  `process.exit` inmediato tumbaban Node en Windows (aserción de libuv). El
  enlace ahora cierra la conexión por petición y drena antes de salir —
  reproducido, corregido y comprobado 10/10.
- **15 tests nuevos** (hook, servicio, registro). **352 tests** unitarios y 10
  de interfaz, en verde.

### Cambiado — limpieza de la mesa de entregas

- Las **5 entregas de sesiones ya cerradas** que se acumulaban en la oficina se
  archivaron por la puerta delantera (el receptor local, con historial). La
  causa raíz de la acumulación —cada cierre de sesión deja su entrega y nadie la
  revisa— es justo lo que la tarjeta de turno resuelve: atender la entrega en el
  momento.

### Añadido — la ventana de la conversación te salta delante (resuelve O10)

**Interruptor en Ajustes → Notificaciones: «Traer la ventana del proyecto al
avisar».** Encendido, en el momento exacto en que se entrega un aviso
—terminada, te espera o fallida— la ventana cuyo título lleva el nombre del
proyecto (la de VSCode, si hay varias) pasa al primer plano.

- **Hereda toda la contención de los avisos**: la espera anti-lluvia y la
  deduplicación. La ventana no salta mientras estás contestando en la propia
  sesión; salta cuando saltaría el aviso.
- **Comprobado en vivo en este equipo**: Windows bloquea el robo de foco desde
  segundo plano (la ventana solo parpadeaba en la barra); con el desbloqueo
  estándar de Alt sintético, la ventana pasa al frente de verdad. Si Windows lo
  bloquease igualmente, queda el parpadeo naranja — un aviso digno.
- **El nombre del proyecto viaja en variable de entorno**, nunca interpolado en
  el script: una carpeta con comillas o `$` no puede ejecutar nada.
- **Límite honesto:** se enfoca la ventana del proyecto, **no la pestaña exacta**
  de la conversación — VSCode no ofrece esa puerta. Con dos conversaciones en el
  mismo proyecto, la pestaña la eliges tú. Solo Windows, que es el sistema del
  MVP (O1).
- Nace **apagado**: robar el foco es intrusivo y debe pedirse.

### Añadido — el muñeco dice qué conversación es (D5-bis, resuelve O9)

**Etiqueta en dos líneas**: el proyecto arriba, en pequeño, y el **nombre de la
conversación** debajo — el automático («mi-app-a3») o el que pongas con
`/rename`, que se convierte en la forma natural de etiquetar el trabajo. Un
`/rename` a mitad de sesión se ve bajo el muñeco en la señal siguiente. Sin
nombre (tarea manual, enlace antiguo), la línea única de siempre.

**De dónde sale el nombre — y de dónde NO.** El dueño autorizó expresamente leer
la conversación entera; no hizo falta y no se hace: el enlace lo lee del
**registro de metadatos de sesiones vivas** de Claude Code, jamás de la
transcripción. D5 queda matizada como **D5-bis**: una línea de nombre sí,
mensajes nunca — y el test «no manda nada del contenido de la conversación»
sigue de guardia. Matiz honesto: el nombre automático puede derivar del tema de
la conversación, y se persiste (migración v4, columna `session_title`).

**10 tests nuevos** (el nombre viaja, el registro ajeno no contamina, un
registro corrupto no tumba el aviso, un /rename actualiza, una señal sin nombre
no borra el que había, y la etiqueta en sus cuatro variantes). **342 tests**
unitarios y 10 de interfaz, en verde.

### Corregido — los muñecos de sesiones cerradas se acumulaban en la oficina

**Apareció el primer día de uso real de D23-bis.** Al reiniciar las sesiones
para instalar el enlace, cada reinicio estrenaba conversación y el muñeco de la
anterior quedaba huérfano en la mesa de entregas. El reciclaje solo actuaba
sobre tareas **revisadas**, y nadie revisa la tarea de un simple reinicio.

- **Cerrar una sesión libera su tarea.** El enlace ahora distingue «terminó un
  turno» (Stop) de «la sesión se ha cerrado» (SessionEnd, que viaja como
  `sessionEnded` en el aviso). La siguiente conversación que se abra en esa
  carpeta **adopta la tarea existente** —historial incluido— en vez de crear
  otra. Reiniciar diez veces deja **un** muñeco, no diez.
- **Reciclar no es descartar.** Lo entregado y sin revisar espera en la mesa
  hasta que alguien lo adopta o lo revisas. Y una conversación **viva** sigue
  siendo intocable: cerrar una no libera a las demás.
- **El título se actualiza al adoptar**: si llevaba el código de la conversación
  anterior, pasa a llevar el de la nueva. Los títulos puestos a mano no se tocan.
- **Las tareas de antes del cambio** se marcan como «sesión terminada» en bloque
  (migración v3 de la base de datos): casi todas venían de sesiones ya muertas,
  y las que no, se corrigen solas con su siguiente señal.
- **Límite honesto:** una sesión que muere sin despedirse (cuelgue, cierre
  forzado) no emite SessionEnd y su muñeco queda ocupando sitio hasta que lo
  revises o archives a mano.
- **9 tests nuevos** (reinicio simple, tres reinicios seguidos, historial
  conservado, la viva no se roba, la entrega no se descarta, título actualizado,
  y la autocorrección de la migración). **332 tests** unitarios y 10 de
  interfaz, en verde.

### Corregido — dos conversaciones en el mismo repo se borraban el estado (D23-bis)

**Era una pérdida de datos, no una carencia de diseño.** Una tarea guardaba un
solo identificador de sesión y cada señal **sobrescribía** el de la otra, así que
el estado acababa siendo el de la última señal recibida, de cualquiera de las
conversaciones. Con dos abiertas en el mismo repositorio, si una te esperaba y la
otra terminaba su turno, **el «te espera» desaparecía y no te enterabas** — que es
exactamente lo que este producto existe para evitar.

- **La identidad de una tarea pasa a ser la conversación, no la carpeta.** Cada
  conversación tiene su icono y su estado.
- **La misma conversación sigue siendo un solo icono** aunque salte de subcarpeta.
  Ese era el motivo por el que se escribió D23, y se conserva intacto.
- **No se acumulan iconos.** Una tarea **revisada** vuelve a estar libre y la
  adopta la conversación siguiente. Sin esto, cada sesión que abrieras dejaría un
  muñeco permanente y en una semana la oficina sería un cementerio.
- **Se distinguen en pantalla.** La segunda conversación de un proyecto lleva el
  código de sesión en el título (`Claude Code · mi-app · a8439a`), y la etiqueta
  de la oficina lo añade **solo cuando hay ambigüedad**: con una conversación por
  proyecto la etiqueta sigue limpia. Es un código y no un nombre porque Claude
  Code no manda el título de la conversación, y D5 prohibiría recibirlo.
- **Sin identificador de sesión se sigue emparejando por carpeta**: perder una
  señal es peor que compartir una tarea.
- **7 tests nuevos**, incluido el caso que fallaba. **323 tests** unitarios y 10
  de interfaz, en verde.

### Cambiado — D23 reabierta

- **Decisión D23 reabierta** y sustituida por **D23-bis**. Se le ofreció al dueño
  del proyecto un icono por proyecto que mostrara el estado más urgente con
  desglose en la ficha —arreglaba la pérdida igual, sin llenar la planta— y
  eligió un icono por conversación, con la consecuencia expuesta delante.
  Razonado en [ADR-009](decisiones/ADR-009-un-icono-por-conversacion.md).

### Añadido — modo desatendido: la Torre aprueba sola (D24)

**Un interruptor en Ajustes → Permisos del asistente.** Encendido, la Torre
contesta «sí» al momento a todo lo que pida Claude Code —editar ficheros,
ejecutar comandos— sin interrumpirte. Nace apagado.

- **Se ve mientras está activo.** Aviso permanente en ámbar desde cualquier
  pantalla, **que no se puede cerrar**, con un botón de apagado a un clic.
  Enterarse de que la Torre decide por ti no puede depender de entrar en Ajustes.
- **No llueven avisos.** Con el modo encendido la tarea **no pasa** por «te
  espera»: si nadie espera, nadie avisa. Sin esto habría una notificación de
  Windows por permiso —decenas por minuto— y acabarías apagando los avisos, que
  son la función original del producto.
- **Queda rastro de lo aprobado**, con el comando entero, en «Señales recibidas
  del enlace», marcado como `aprobado solo`. El tope del registro sube de 40 a
  200 entradas: con este modo, 40 se agotan en un minuto.
  > ⚠️ **La trazabilidad es volátil.** Ese registro vive en memoria y se pierde al
  > cerrar la Torre. No puede ser de otra manera sin romper D20 (los permisos
  > nunca se escriben en disco). Un registro permanente sería otro ADR.
- **Sigue sin aprobar lo que no entiende.** Una petición que no cumple el
  contrato devuelve `timeout`, no un «sí»: el modo desatendido no es un «sí» a
  cualquier cosa que llegue al puerto.
- **Es opt-in de verdad.** Un servicio de permisos construido sin el parámetro se
  comporta como antes de D24. Hay un test que lo fija.
- **9 tests nuevos** del servicio de permisos: aprueba al momento, no deja
  petición pendiente, no pasa por «te espera» *ni en el historial*, registra el
  comando, respeta el apagado en la petición siguiente sin reiniciar, y rechaza
  lo mal formado. Total: **313 tests** unitarios y **10** de interfaz, en verde.

### Cambiado

- **Decisión D18-bis reabierta** el mismo día que se aprobó, a petición del dueño
  del proyecto, y sustituida por **D18-ter**: la Torre ya no solo transmite un
  clic humano — puede decidir sola si el usuario lo enciende. Se le ofrecieron dos
  alternativas más conservadoras (auto-aprobar solo lo inofensivo; usar el modo de
  permisos de Claude Code sin tocar el producto) y las descartó. Riesgo,
  alternativas y quién decidió qué, en
  [ADR-008](decisiones/ADR-008-modo-desatendido.md).

### Añadido — Sprint 004: ChatGPT entra en la Torre (etapa 1)

**Extensión de Chrome** que registra de un clic la conversación que tienes
abierta. En `apps/extension`, con su propio [README](../apps/extension/README.md).

- **No puede leer tus conversaciones, y no por promesa sino por construcción.**
  No pide permiso sobre `chatgpt.com` ni sobre ningún otro sitio, no inyecta
  nada dentro de las páginas y no tiene proceso de fondo. Lee el título y la
  dirección de la pestaña, y solo cuando pulsas su icono (`activeTab`). El único
  sitio al que puede escribir es `127.0.0.1`.
- **Doble barrera.** Aunque el navegador fallara, el contrato de alta de la
  Torre solo admite dos campos —título y enlace— y **rechaza la petición entera**
  si llega uno de más. Hay tests que intentan colar prompts, respuestas y
  transcripciones, y comprueban que se rechazan.
- **Ruta nueva `POST /tasks`** en el receptor local, con las mismas siete
  barreras que el resto: bucle local, clave en tiempo constante, tipo de
  contenido, tamaño, contrato estricto. Sin atendedor devuelve 404 en lugar de
  fingir que acepta.
- **No duplica.** Registrar dos veces la misma conversación devuelve la que ya
  había. Se comparan las direcciones ignorando la barra final y el fragmento,
  porque el navegador los añade y quita él solo.
- **La tarea nace «en cola» y con confianza baja**, no «trabajando». Registrarla
  no significa que ChatGPT esté haciendo nada: lo único que sabemos es que
  existe. Su fuente queda como `browser_extension` en el historial.
- Los iconos se generan con un script sin dependencias, para que no sean tres
  binarios llegados de ningún sitio.

### Cambiado

- **Una tarea puede nacer declarando quién la crea** (`statusSource` y
  `statusConfidence` al crearla, D8). Antes toda tarea nacía como «manual, alta
  confianza», incluidas las que crea el enlace de Claude Code: la primera línea
  de su historial decía algo que no era verdad. Ahora el enlace declara
  `claude_hook` y la extensión `browser_extension`.

### Corregido — una comprobación de más se tragaba tu decisión

- **El enlace descartaba decisiones humanas en silencio.** Claude Code puede
  indicar qué decisiones admite cada petición; el enlace hacía caso de ese campo
  sin comprobar su forma, así que en cuanto llegaba distinto de lo esperado —una
  lista vacía, una lista de objetos— tu clic en «Aceptar» se perdía sin dar
  ningún error. Ahora ese campo solo se tiene en cuenta si viene como lista de
  textos: **ante un campo que no se entiende, tu decisión siempre gana**.
- **Cuaderno de bitácora del enlace.** Cada petición deja apuntado qué llegó,
  con qué forma, y qué se contestó, en
  `diagnostico-permisos.log` dentro de la carpeta de datos. Este canal ya había
  fallado dos veces sin dar un solo error; ahora un fallo mudo se ve en dos
  minutos en lugar de en una tarde.
- **El cuaderno no guarda contenido de conversación**, solo la forma de los
  datos. Lo comprueba un test: una primera versión sí filtraba el contenido de
  los ficheros al apuntar la respuesta entera, y el test lo cazó antes de salir.

### Corregido — el botón «Aceptar» no llegaba a Claude Code

- **El enlace contestaba a las peticiones de permiso en el formato equivocado.**
  El evento `PermissionRequest` espera `decision.behavior`; se le estaba
  enviando `permissionDecision`, que pertenece a otro evento. Claude Code no
  avisa de un campo que no conoce: descartaba la decisión en silencio y
  preguntaba en la terminal. Desde fuera parecía que la Torre no recibía nada,
  cuando lo único mal era el nombre de un campo.
- **Prueba nueva que ejecuta el script de verdad** —proceso real, entrada real,
  salida real— y comprueba el sobre exacto de cada evento. El test de interfaz
  que existía daba por bueno el formato incorrecto; ahora comprueba el correcto.
- **El enlace ya no contesta decisiones que la petición no admite.** Claude Code
  indica qué opciones caben en cada caso; si la tuya no está, se aparta y deja
  que pregunte él.
- **Ajustes avisa de que hay que reiniciar Claude Code** tras instalar o
  actualizar el enlace. Los avisos se leen al abrir la sesión, así que las que ya
  estuvieran abiertas seguían calladas mientras la pantalla decía «instalado» —
  y eso costó buscar un fallo donde no lo había.

### Añadido — Sprint 003: Claude Code conectado

**La primera integración real.** Claude Code ya avisa solo a la Torre.

- **Permisos resueltos desde la Torre.** Cuando Claude Code pide permiso, salta
  una notificación y aparece una tarjeta con **el comando entero**; tu clic
  viaja de vuelta y Claude Code continúa o se detiene.
- **Tres salvaguardas** que hacen eso aceptable: las peticiones no se guardan en
  disco (D20), si no decides en 90 segundos Claude Code pregunta en su terminal
  como siempre (D21), y el comando se enseña íntegro, sin resumir.
- **Avisos automáticos** de cuándo te reclama, cuándo termina un turno y cuándo
  acaba la sesión.
- **Las tareas se crean solas** a partir de la carpeta del proyecto: no hace
  falta registrar a mano lo que delegas a Claude Code.
- **Instalador que enseña el cambio antes de tocarlo** (D13): el fichero antes,
  después y dónde queda la copia. El botón de instalar no aparece hasta que lo
  has visto. Conserva los automatismos que ya tuvieras y tiene desinstalación
  limpia.

### Cambiado

- **Decisión D18 reabierta** a petición del dueño del proyecto y sustituida por
  **D18-bis**: la Torre puede transmitir una decisión humana, nunca decidir
  sola. Riesgo expuesto, alternativas ofrecidas y descartadas, y todo razonado
  en [ADR-007](decisiones/ADR-007-permisos-remotos.md).
- **Decisión abierta O3 resuelta**: Claude Code primero, ChatGPT después.
- El receptor local suma dos rutas: `/permissions` —que espera tu decisión— y
  `/sessions`, para avisos que no conocen el identificador de la tarea.

### Corregido

- **La aplicación no declaraba su identidad ante Windows.** Las notificaciones
  se atribuían a «electron.app.Electron»: nombre e icono genéricos, mezcladas
  con las de cualquier otra aplicación Electron y sin poder configurarlas por
  separado. Ahora se identifica como `net.alsari.torre-de-control`, y está
  comprobado contra el propio Windows que el aviso se entrega.
- **Los cinco hooks del proyecto llevaban rotos desde el principio.** Estaban
  escritos en Bash y Python, que no están disponibles en el equipo; se
  declaraban con un formato que el esquema de Claude Code no reconoce; y el de
  seguridad salía con un código que **no bloquea**. Reescritos en Node, en forma
  de ejecución directa sin shell, y con el código de salida correcto. 15 pruebas
  confirman que bloquea lo que debe y deja pasar lo que debe.
- **La rama principal se llamaba `master` pero los protocolos decían `main`.**
  Documentación alineada con la realidad.
- Los cronómetros y los «hace 3 min» estaban congelados hasta que cambiaba
  alguna tarea. Ahora avanzan solos, como pide el diseño.

### Añadido

- Permisos de `pnpm` en `.claude/settings.json`, para no preguntar por comandos
  del día a día del proyecto.

---

## [0.2.0] — 2026-08-03 — El diseño, construido

> Se adopta íntegro el sistema de diseño «Oficina de papel». La aplicación pasa
> de dos vistas a seis pantallas y gana identidad propia.
> Estado: sigue siendo 🛠️ **Prototipo funcional**.
> Detalle en [sprints/sprint-002.md](sprints/sprint-002.md) y
> [ADR-006](decisiones/ADR-006-sistema-de-diseno.md).

### Añadido

**Identidad visual**
- Paleta «Oficina de papel» completa, con los nombres de token del documento de
  diseño.
- Instrument Serif, Instrument Sans y JetBrains Mono **empaquetadas dentro de la
  aplicación** (190 KB, licencia SIL OFL). No se pide nada a internet.
- Glifo geométrico propio por estado, de modo que el color nunca vaya solo.

**Pantallas nuevas**
- **Torre de control**: cinco contadores, panel de atención, tareas en marcha y
  actividad reciente.
- **Centro de atención**: la cola de decisión, ordenada por lo que cuesta más
  caro ignorar.
- **Tareas**: secciones colapsables por urgencia y filtro por confianza.
- **Historial**: lo archivado, con su duración.
- **Ajustes**: avisos, pérdida de contacto, arranque, integraciones y datos.
- **Oficina por zonas**: despacho, mesa de entregas, zona de trabajo,
  incidencias y recepción. La posición de cada trabajador **es** su estado.

**Funcionalidad**
- **Historial de estados por tarea** (decisión D19), con migración v2 de la base
  de datos. Visible en la ficha y en la actividad reciente.
- **Alta rápida con `⌘N`** y detección de la plataforma desde el dominio del
  enlace.
- **Ajustes que funcionan de verdad**: silenciar cada tipo de aviso, elegir
  sección y vista de arranque, y fijar cuándo una tarea pasa a «sin confirmar».
- **Barrido automático a «sin confirmar»** para las tareas automáticas que
  llevan demasiado tiempo sin señal. Nunca toca lo que fijaste tú a mano.
- **Exportar a CSV** y **abrir la carpeta de datos** desde Ajustes.
- **Eliminar una tarea**, con confirmación en dos pasos.
- Plataforma **Cowork** añadida al modelo.

### Cambiado

- La ficha pasa de ventana modal a **panel lateral de 480 px**, con el historial
  en el centro.
- Los estados se renombran a un lenguaje más directo: «Sin confirmar» en lugar
  de «Sin contacto», «Con error» en lugar de «Ha fallado».
- 147 tests unitarios (eran 105) y 3 pruebas de interfaz (eran 2).

### Corregido

- La planta de oficina sacaba una barra de desplazamiento horizontal por la
  proyección del plano inclinado.

### Deliberadamente NO construido

Del diseño quedaron fuera el campo «rol» (decisión abierta O7), el estado
«revisada» (O8) y los ajustes de sonido, contador en el icono, tamaño de texto,
ventana interna y caducidad del historial. **No se dibujan interruptores que no
hagan nada.**

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
