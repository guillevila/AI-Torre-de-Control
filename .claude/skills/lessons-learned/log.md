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
