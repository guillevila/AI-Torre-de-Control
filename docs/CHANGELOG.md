# Changelog — Historial de cambios

> Registro de todos los cambios significativos del proyecto.
> El más reciente siempre arriba.
> Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)

---

## [Sin publicar]

> Los cambios en desarrollo van aquí hasta que se publican.

### Corregido — la detección de abandono del receptor no funcionaba

El receptor local tenía desde hacía semanas una protección para cuando quien
pregunta se marcha a media espera. **No se disparó ni un solo día.**

`req` emite «close» en cuanto termina de llegar el cuerpo —no cuando el cliente
se va—, y encima el escuchador se registraba *después* de leerlo, así que el
aviso ya había pasado. El evento correcto es el de la **respuesta**: `res` emite
«close» en los dos casos y se distinguen por `writableEnded`. Comprobado a mano
contra un servidor real antes de tocar nada.

No se notaba porque su único efecto era intentar escribir en una conexión
muerta, que no da error visible. Con el fin de turno pasa a importar: un aviso
que se queda en pantalla te invita a **escribir** una respuesta que ya no puede
llegar a ningún sitio, y la Torre te diría que la ha mandado.

Y no es un caso rebuscado: ocurre siempre que una sesión de Claude Code se abrió
**antes** de actualizar el enlace. Conserva el tope viejo de 10 segundos y mata
el proceso mientras el aviso cuenta hasta 60.

La ruta de permisos tiene el mismo hueco, pero sus tiempos están ordenados y lo
que se pierde es un clic, no un texto. Se deja como está a propósito: es un
canal en producción y tocarlo pide su propia tanda de pruebas.

### Añadido — contestarle a Claude Code sin abrir la terminal (D24)

Cuando Claude Code termina un turno, la Torre te enseña **lo que te ha dicho**,
entero, y una caja para seguir hablándole. Si escribes, el turno no termina:
sigue con lo que le hayas dicho. Sin tocar la terminal.

Las dos mitades existían y no las estábamos usando:

- El evento de fin de turno trae un campo con **el texto final del turno ya
  montado**. No hay que rebuscar en la transcripción — que además se escribe con
  retraso y a menudo aún no tiene el último mensaje.
- Ese mismo evento admite que el enlace **impida que el turno termine** y le pase
  a Claude un motivo. Es el mismo patrón de retener-y-esperar que ya usaba el
  canal de permisos.

**Se enseña, no se guarda.** Es D20 aplicada a un segundo canal, y no reabre D5:
esa decisión dice «no se **almacenarán**», y lo que vive en memoria y desaparece
al cerrar el aviso no se almacena. Igual que ya pasa con el comando completo de
un permiso. Ni la respuesta de Claude ni lo que tú escribes entran en la base de
datos, ni en el historial, ni en el CSV, ni en el cuaderno de diagnóstico — hay
una prueba que comprueba que el cuaderno recibe **cuántos** caracteres, nunca
cuáles.

**Apagado de fábrica, y no por prudencia genérica.** Mientras el aviso está en
pantalla, Claude Code está *parado*. Es la única opción de toda la aplicación
que le cuesta tiempo a una herramienta, así que Ajustes lo dice dos veces y el
aviso enseña la cuenta atrás mientras corre.

**Dos fallos reales encontrados construyéndolo:**

- El evento de fin de turno estaba enganchado con **10 segundos** de tope. Claude
  Code habría matado el enlace mucho antes de que diera tiempo a leer nada.
  Ahora son tres relojes ordenados a propósito —Torre ≤180 s, enlace 190 s,
  Claude Code 210 s— para que el que se rinda primero sea siempre el más interno.
  Si se invirtieran, la respuesta se perdería justo después de escribirla.
- Al hacer dos peticiones seguidas, el enlace **se estrellaba al salir** con un
  fallo de libuv (`Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`),
  porque `fetch` dejaba una conexión viva en el pozo. Un enlace que revienta
  viola su única regla innegociable. Ahora usa `node:http` sin reutilizar
  conexiones. De paso, las pruebas capturan la salida de error del enlace: con
  el código de salida a secas se veía un número enorme y ninguna pista.

Lo que **no** cubre: «te espera». Ese evento no admite respuesta de vuelta según
la documentación de Claude Code, y además ya está resuelto con la tarjeta de
permisos. Esto es para cuando te ha entregado algo.

### Cambiado — Ajustes es una ventana, no una pantalla

Pulsar Ajustes te sacaba de donde estabas. Desde la fábrica eso era
especialmente malo: la nave ocupa la pantalla entera, así que tocar un
interruptor obligaba a abandonarla y volver. Y el panel dejaba fuera el
**receptor local de eventos**, que colgaba aparte en una esquina: había que
saber que existía.

- **Se abre encima de lo que estés mirando** y se cierra dejándote justo ahí.
  Da igual si vienes de la rueda de la fábrica o de la barra lateral: es la
  misma ventana, y ya no hay ninguna forma de ver Ajustes a pantalla completa.
- **Dentro está todo**, receptor local incluido. Y al cerrar el receptor se
  vuelve a Ajustes, no a la pantalla de fondo.
- **En el estilo de la sala de control**, oscuro, igual que la fábrica.

Lo interesante es cómo: no se ha reestilizado componente por componente, se han
**reescrito los tokens de color dentro de la ventana**. Todo lo que hay dentro
—tarjetas, interruptores, desplegables, el instalador de Claude Code— estaba
escrito con `var(--surface)`, `var(--ink)`… así que cambió solo, y un ajuste que
se añada mañana nacerá ya oscuro sin tocar nada.

Eso dejó a la vista los dos únicos sitios que no seguían esa disciplina: el
carril del selector segmentado, con un color escrito a mano, y el panel del
receptor, que heredaba la tinta en lugar de declararla —y se quedaba negro
sobre negro—. Los dos corregidos.

### Cambiado — la fábrica ocupa la pantalla entera

La nave ya no comparte pantalla con la barra lateral ni con la cabecera. Una
sala de control se mira de lejos, y los menús alrededor competían con lo único
que hay que ver: quién trabaja y quién te espera. Además chocaban de lleno con
el tema oscuro.

- **Dos salidas, y están dentro de la propia fábrica**: la **rueda** de arriba a
  la derecha lleva a Ajustes, y la **consola de mando** de abajo al detalle de
  todo. Fuera de la fábrica la barra lateral vuelve, así que no hay forma de
  quedarse encerrado — y hay una prueba de interfaz que recorre ambas puertas
  precisamente porque, sin menús, romper una dejaría al usuario atrapado.
- **Los permisos siguen apareciendo por encima**, en la fábrica igual que en el
  resto de la aplicación. Comprobado con una petición real: la tarjeta manda
  sobre la nave y la rueda sigue accesible.

Nota honesta: con un permiso esperando, la nave se estrecha y hay que hacer
scroll para ver la leyenda del pie. No se pierde nada, pero se aprieta.

### Cambiado — la Oficina pasa a ser una fábrica

Implementa el documento de diseño **«Oficina Fábrica»**. La planta de papel
inclinada se sustituye por una nave oscura de sala de control, con un robot por
tarea.

- **Tres naves en vez de seis zonas**: zona de trabajo (lo que sigue vivo),
  entregas (terminadas) y backlog (revisadas, durmiendo en cápsulas). El reparto
  lo decide `factoryFloor` en el dominio, así que la lista y la oficina no
  pueden discrepar (D10, D11).
- **El robot comunica por tres canales independientes**: el color del cuerpo es
  la herramienta, el de los ojos avisa de que algo va mal, y el movimiento dice
  si trabaja de verdad. Quitando el color se sigue leyendo.
- **Solo se mueve quien trabaja.** Nada de animación decorativa; y quien pide
  menos movimiento en su sistema operativo no ve ninguno.
- **Lo que no cabe se cuenta**, con un «+N fuera de vista» en cada nave.
  Recortar en silencio haría creer que la fábrica está más vacía de lo que está.
- Toda la figura se dibuja con degradados: **ni una imagen**, así que escala sin
  pixelarse y no mete binarios en un repositorio público.

**Dos cosas del diseño se dicen distinto, a propósito:**

- Bajo cada robot iba una frase del tipo «Analizando requisitos». Eso exigiría
  saber qué hace la herramienta por dentro, y esta aplicación no lee
  conversaciones. En su lugar va el **nombre del proyecto**, que sí sabemos y
  además distingue un robot de otro.
- La consola traía un medidor de «PRODUCTIVIDAD 80%», que era un número
  inventado. Se sustituye por dos datos que se calculan de verdad: la
  **actividad real de las últimas 6 horas** —sacada del historial— y el
  **porcentaje del trabajo que no te reclama nada**.

Un dato inventado en una pantalla de control es peor que un hueco vacío: se cree.

### Añadido — varias cuentas de ChatGPT a la vez

Nace de un uso real: tres chats de una cuenta y dos de otra, abiertos al mismo
tiempo. **Los cinco ya cabían en la Torre** —cada conversación es su propia
tarea y se mueve por su cuenta, y hay una prueba que lo comprueba—, pero se
veían todos iguales y no había forma de saber cuál era de cuál.

- **Etiqueta de cuenta por perfil de navegador.** La escribes una vez en los
  Ajustes de la extensión y todas las conversaciones que registres desde ese
  perfil la llevan. Como cada perfil de Chrome guarda lo suyo, un perfil por
  cuenta y listo.
- **La aplicación NUNCA la deduce.** No sabe con qué cuenta de ChatGPT estás:
  tendría que leer la página para averiguarlo, y no lo hace. La etiqueta la
  escribe una persona o no existe.
- **Se ve bajo el muñeco**, en pequeño y en su propia línea. Sin cuenta no se
  dibuja nada, para no dejar un hueco a quien no la use.
- **Campo nuevo en las tareas** (`account`), con migración de base de datos. Las
  tareas que ya existían se quedan sin cuenta, que es la verdad: nadie dijo a
  cuál pertenecían.
- **Etiquetar el perfil más tarde** actualiza la conversación al volver a
  registrarla. Y un perfil sin etiquetar **no borra** la cuenta de una que ya la
  tenía: «no lo sé» no es lo mismo que «no tiene».

### Corregido — registrar una conversación archivada la recupera

Encontrado en uso real. Al pulsar «Registrar» sobre una conversación archivada,
la extensión contestaba «ya está añadida» y no aparecía nada: la tarea existía,
pero archivada, o sea invisible. Una respuesta cierta y a la vez inservible.

Peor todavía, el comentario de ese código decía que las archivadas se revivían.
No se revivían: estaba escrita la intención, no el comportamiento.

Ahora se desarchiva, y la extensión distingue «ya estaba» de «estaba archivada y
la he traído de vuelta». La recuperación consta como **manual**: el vigilante
infiere estados mirando una página, pero esto es un clic tuyo en un botón, y por
eso puede levantar el candado que protege lo que archivaste a mano.

### Cambiado — la ropa de los muñecos vuelve a ser la herramienta

Con Claude Code y ChatGPT funcionando de verdad, el color por fin separa algo
que importa: de un vistazo se ve quién lleva cada trabajo.

- **Naranja de Claude** (`#D97757`) y **verde de ChatGPT** (`#10A37F`), sus
  colores de marca. Las tres herramientas de Anthropic comparten tono porque
  comparten marca; cuál de las tres lo dicen la etiqueta y la ficha. Codex va en
  la familia de ChatGPT pero más oscuro: se hermanan sin confundirse.
- Deshace el «todos azules» de hace un día. Entonces era razonable —había una
  sola herramienta y el color no distinguía nada—; ahora ya no.
- **El estado sigue por otro camino**: glifo, globo de texto y sitio en la
  planta. Los dos datos conviven sin pisarse y, quitando el color, la pantalla
  se sigue leyendo entera.

### Añadido — Sprint 004, etapa 2: ChatGPT se mueve solo

Registras la conversación una vez y, a partir de ahí, la tarea pasa sola a
**trabajando** cuando ChatGPT empieza a responder y a **terminada** cuando acaba.

- **El permiso lo concedes tú, y puedes retirarlo.** La extensión se instala
  **sin** permiso sobre ChatGPT: recién puesta no puede ni mirar la página. En
  su ventana aparece «Activar en este sitio», Chrome te pregunta, y el mismo
  botón sirve para desactivarlo. Es la diferencia entre *no puede* y *puede y no
  lo hace*, y se deja en manos del dueño del proyecto.
- **El vigilante mira una sola cosa**: si existe el botón de detener la
  respuesta. Nunca lee texto. Lo único que sale del navegador son tres datos
  —dirección, una de dos palabras y la hora—, y un test contra un servidor real
  lo comprueba.
- **Solo caben dos estados**: `running` y `completed`. El contrato no admite
  `failed` ni `waiting_user`, porque mirar una página no permite saber si algo
  ha fallado ni si te están esperando.
- **Ruta nueva `POST /web-activity`**, con las mismas barreras que el resto. **No
  crea tareas**: una conversación sin registrar se ignora sin ruido. Registrar
  sigue siendo una decisión tuya.
- **Confianza media, no alta** (D8). Lo que se ha visto es una página dejando de
  generar texto: es una inferencia buena, pero es una inferencia.
- **Lo que decidiste tú manda.** Si marcaste una tarea como revisada, el
  vigilante no se la lleva de vuelta.
- **Está escrito para fallar callando.** ChatGPT cambia su interfaz cada pocas
  semanas; cuando lo haga, el vigilante dejará de reconocer el botón y **no
  mandará nada**, en lugar de inventarse un estado.
- La regla de «¿es la misma conversación?» pasa al dominio
  (`packages/domain/src/urls.ts`), compartida por el alta y la detección: si
  cada una decidiera por su cuenta, se registraría una tarea y se movería otra.

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
