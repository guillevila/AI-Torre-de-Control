# PROJECT_STATUS.md — Estado real del proyecto

> 🟢 **Este es el archivo más honesto del proyecto.**
> Aquí no se vende humo: dice qué funciona DE VERDAD hoy y qué no.
> Pensado para que cualquier persona —tú, un socio, un inversor— entienda
> el estado real en 30 segundos, sin saber nada de tecnología.
>
> **Regla de oro:** si algo no está aquí marcado como "funciona", asume que NO funciona.
> Una demo bonita NO es un producto. Documentación NO es código que funciona.
>
> Claude actualiza este archivo cada vez que cambia algo importante.
> Si ves que está desactualizado, pídele: *"Actualiza el PROJECT_STATUS"*.

---

## 1. Estado actual

> Marca con una **X** la casilla real. Solo una. Si dudas entre dos, elige la MENOR.
> ¿No sabes qué significa cada una? → lee [docs/ESTADOS_DEL_PROYECTO.md](docs/ESTADOS_DEL_PROYECTO.md)

- [ ] 💡 **Idea** — Solo existe la idea en tu cabeza o en notas sueltas.
- [ ] 📄 **Documentación** — Está escrito qué se quiere hacer, pero no hay nada construido.
- [ ] 🎬 **Demo** — Hay algo que se puede *enseñar*, pero NO sirve para usar de verdad.
- [X] 🛠️ **Prototipo funcional** — Funciona en partes, pero no es fiable ni completo.
- [ ] 🚀 **MVP** — Versión mínima usable por usuarios reales, con lo justo para aportar valor.
- [ ] 🏭 **Producción** — En uso real, con datos reales y gente dependiendo de ello.

**Por qué prototipo funcional y no MVP.**
Lo construido funciona de verdad: guarda en disco, sobrevive a reiniciar, avisa y
recibe eventos reales por su canal definitivo. No son datos de pega ni pantallas
falsas. Pero **falta lo que convertiría esto en un MVP**: que reciba avisos
automáticos de al menos una herramienta real (hoy hay que simularlos a mano) y
que se pueda instalar como un programa normal en lugar de arrancarlo con
comandos. Hasta eso, no es una herramienta que puedas usar cómodamente cada día.

---

## 2. ✅ Qué funciona HOY

> Lista SOLO lo que has probado tú mismo y funciona de verdad.

**Comprobado automáticamente** — 147 tests unitarios y 3 pruebas que arrancan
la aplicación de verdad, todos en verde a 3 de agosto de 2026:

- **Instalar y arrancar.** `pnpm install` termina en segundos sin compilar nada.
  `pnpm dev` abre la aplicación.
- **Registrar una tarea en segundos** con `⌘N` desde cualquier pantalla. Al pegar
  el enlace, **la plataforma se deduce sola** del dominio. Los datos incorrectos
  se rechazan con un mensaje en lenguaje normal.
- **Cinco pantallas**: Torre de control, Centro de atención, Tareas, Historial y
  Ajustes, más el conmutador Operativa ⇄ Oficina.
- **Cambiar el estado a mano** desde la ficha. Solo se ofrecen los cambios que
  tienen sentido desde el estado actual.
- **Guardar en disco de verdad.** Cierras la aplicación, la vuelves a abrir y
  todo sigue exactamente igual. Comprobado cerrando y reabriendo la aplicación
  en la prueba automática, no solo en teoría.
- **Historial de estados por tarea.** Cada cambio deja constancia de dónde vino,
  adónde fue, quién lo dijo y cuándo. Se ve en la ficha y sobrevive al reinicio.
- **Recibir un evento local** por su canal definitivo: HTTP a `127.0.0.1` con
  clave local. Un evento válido cambia el estado y **la pantalla se actualiza
  sola**, sin recargar.
- **Rechazar eventos indebidos**: sin clave (401), con clave incorrecta,
  con formato incorrecto (415), con datos que no cumplen el contrato (422),
  demasiado grandes (413) y con campos de más (rechazo completo).
- **Avisar al sistema operativo** cuando una tarea pasa a *te espera*,
  *terminada* o *fallida*, con el texto correcto y **sin repetir** el mismo
  aviso dos veces.
- **Silenciar cada tipo de aviso** desde Ajustes, y que se respete de verdad.
- **Pasar a «sin confirmar»** las tareas automáticas que llevan demasiado tiempo
  sin señal, sin tocar nunca lo que fijaste tú a mano.
- **Abrir la conversación externa** de un clic. Comprobado que la aplicación
  pide abrir exactamente la dirección guardada, y que solo acepta `http` y
  `https`.
- **La lista y la oficina muestran el mismo estado.** Comprobado cambiando el
  estado en la lista y verificando que el trabajador de la oficina se mueve con
  él.
- **Exportar todas las tareas a CSV**, con las fórmulas neutralizadas para que
  abrir el fichero en Excel no ejecute nada.
- **Archivar, editar y eliminar** tareas, y filtrar por texto y por confianza.

**Comprobado mirándolo, con capturas de las ocho pantallas:**

- El aspecto general coincide con el documento de diseño: papel cálido,
  tipografías correctas, contadores, planta de oficina por zonas y ficha lateral.

**El enlace con Claude Code (Sprint 003), comprobado ejecutando el script real:**

- **Claude Code avisa solo.** Cuando pide permiso, cuando te reclama, cuando
  termina un turno y cuando acaba la sesión.
- **Los permisos se resuelven desde la Torre.** Salta una notificación, aparece
  una tarjeta con **el comando entero**, y tu clic viaja de vuelta a Claude Code.
  Comprobado ejecutando el script tal y como lo ejecutará Claude Code —con el
  JSON del evento por la entrada estándar— y verificando la respuesta exacta que
  Claude Code leerá, contrastada con su documentación oficial.
  > ✅ **Comprobado en vivo el 4/8/2026.** Se disparó una petición real contra el
  > enlace instalado, apareció la tarjeta en la Torre, el dueño del proyecto
  > pulsó «Aceptar» y la respuesta volvió en el formato correcto. La tarea pasó a
  > «te espera» y volvió a «trabajando» 23 segundos después, al decidir.
  >
  > Hasta ese día el script contestaba con el campo de **otro** evento
  > (`permissionDecision`, que es de `PreToolUse`, en lugar de
  > `decision.behavior`). Claude Code descarta en silencio un campo que no
  > conoce: el botón «Aceptar» no hacía nada y no había manera de notarlo.
  >
  > ⚠️ **Lo que sigue sin comprobarse:** que Claude Code dispare la petición él
  > solo durante el trabajo normal. Decide por su cuenta casi todo lo que
  > considera inofensivo —leer, escribir, borrar un fichero suelto— y solo
  > pregunta en casos que no se han conseguido provocar a voluntad. Cuando
  > pregunte, la Torre ya está lista para recibirlo; hasta verlo una vez, no se
  > da por cerrado.
- **Después de instalar o actualizar el enlace hay que reiniciar las sesiones de
  Claude Code.** Lee qué avisos debe mandar una sola vez, al abrirse: las
  sesiones que ya estén abiertas seguirán calladas. La pantalla de Ajustes ahora
  lo dice al terminar de instalar.
- **Si la Torre está cerrada o tardas, no pasa nada.** El script sale en
  silencio y Claude Code pregunta en su terminal, como siempre (D21).
- **Las tareas de Claude Code se crean solas** a partir de la carpeta del
  proyecto. No hay que registrarlas a mano.
- **El instalador enseña el cambio antes de tocar tu configuración** (D13),
  guarda copia, conserva los automatismos que ya tuvieras y se niega a escribir
  sobre un fichero que no entienda. Todo ello comprobado con tests.
- **Las peticiones de permiso no se guardan en ningún sitio** (D20): viven en
  memoria y desaparecen al decidirse.

**La extensión de Chrome para ChatGPT (Sprint 004, etapa 1):**

> ⚠️ **Construida y probada, pero TÚ todavía no la has instalado.** Los tests
> pasan y comprueban cosas de verdad —incluido el cuerpo exacto que sale del
> navegador contra un servidor real—, pero hasta que la cargues en tu Chrome y
> registres una conversación, esto no está comprobado *en vivo*. No cuenta como
> «funciona» hasta entonces.

- **Registra de un clic** la conversación que tengas abierta: pulsas su icono y
  la tarea aparece en la Torre.
- **No puede leer tus conversaciones, y no es una promesa.** No pide permiso
  sobre `chatgpt.com` ni sobre ninguna otra página, no mete nada dentro de ellas
  y no tiene nada corriendo de fondo. Lee el título y la dirección de la
  pestaña, y solo cuando pulsas su icono.
- **Aunque el navegador fallara, la Torre no lo aceptaría**: su contrato de alta
  solo admite dos campos y rechaza la petición entera si llega uno más. Hay
  tests que intentan colar prompts, respuestas y transcripciones.
- **No duplica**: registrar dos veces la misma conversación devuelve la que ya
  había.
- **La tarea nace «en cola» y con confianza baja**, no «trabajando». Registrarla
  no significa que ChatGPT esté haciendo nada, y la Torre no debe fingirlo.

**Comprobado contra el propio Windows:**

- **La notificación llega al sistema operativo.** Se disparó una real (sin
  interceptar) y Windows registró la entrega bajo la identidad propia de la
  aplicación, `net.alsari.torre-de-control`. Windows solo crea esa entrada
  cuando **entrega** un aviso de verdad.
- Antes de arreglarlo, la aplicación no declaraba identidad y los avisos salían
  como «electron.app.Electron»: con el nombre y el icono genéricos de Electron,
  mezclados con los de cualquier otra aplicación del mismo tipo y sin poder
  configurarlos por separado.

**Pendiente de que lo veas tú:**

- Que el aviso **te resulte útil** cuando estás a otra cosa: que se vea, que se
  entienda de un vistazo y que no moleste. Eso es criterio tuyo, no técnico.
- Si la aplicación **se entiende en menos de diez segundos** cuando la usas de
  verdad. Eso no lo puede comprobar ningún test.

---

## 3. ❌ Qué NO funciona todavía

> Sé generoso aquí: más vale sobre-listar que dar falsa sensación de avance.

**Lo que falta para llegar a MVP:**

- **ChatGPT no avisa solo de que ha terminado.** La extensión de Chrome del
  Sprint 004 sirve para **registrar** una conversación de un clic, y nada más:
  después el estado lo mueves tú a mano. Detectar el final de una respuesta sin
  leer la conversación es la **etapa 2**, y no está construida.
- **Claude web, Codex y los demás siguen sin avisar solos.** Claude Code sí,
  desde el Sprint 003. Para el resto haría falta ampliar la extensión o un
  monitor de procesos, mecanismos bastante más frágiles.
- **No se puede instalar.** No hay un `.exe` ni un instalador: hay que arrancarla
  con `pnpm dev` desde una terminal. Depende de decidir para qué sistema
  operativo se empaqueta primero (decisión abierta O1).

**Del diseño, deliberadamente sin construir:**

- **Campo «rol»** en las tareas (decisión abierta O7). En la oficina, el color
  del trabajador es su **plataforma**, no su rol.
- **Estado «revisada»** entre terminada y archivada (decisión abierta O8).
- **Ajustes de sonido, contador en el icono de la app, tamaño de texto, ventana
  interna y caducidad del historial.** Aparecían en el diseño; no están
  construidos, así que **no se dibujan**. Un interruptor que no hace nada es
  justo la falsa sensación de avance que este proyecto evita.

**Fuera de alcance de este sprint, por decisión:**

- **Detectar solo que ChatGPT ha terminado** (etapa 2 de la extensión). Hoy
  registras de un clic y el estado lo mueves tú.
- Lectura del contenido de conversaciones (y no se hará: decisión D5).
- Cualquier API de OpenAI, Anthropic u otros (y no se hará: decisión D2).
- Cuentas, autenticación, sincronización entre ordenadores, multiusuario.
- Oficina visual avanzada (pixel art, isométrico, animaciones). La actual es
  deliberadamente sencilla: React, CSS y SVG.
- Modificación de tu `~/.claude/settings.json`. No se ha tocado nada tuyo.

**Limitaciones conocidas de lo que sí funciona:**

- Solo se ha probado en **Windows 11**. Debería funcionar en macOS y Linux, pero
  no está comprobado.
- No hay **copia de seguridad automática**. Ya puedes exportar a CSV desde
  Ajustes o copiar el fichero `torre.db`, pero hay que acordarse de hacerlo.
- No hay **registro de errores en fichero**: si algo falla, el detalle solo
  aparece en la consola.
- **No hay modo oscuro.** El sistema de diseño es de modo claro.
- El rendimiento con **muchísimas tareas** no se ha medido. Sobra para decenas o
  cientos; no sé qué pasa con decenas de miles.

---

## 4. 🧪 Cómo probarlo

> Pasos EXACTOS para que veas el estado actual con tus propios ojos.

Necesitas [Node.js](https://nodejs.org) 20 o superior. Si no tienes `pnpm`:
`npm install -g pnpm`.

> **En Windows, la primera vez.** Si al ejecutar `pnpm` te dice que *«la
> ejecución de scripts está deshabilitada en este sistema»*, es una protección
> de Windows, no un fallo del proyecto. Se arregla de una vez con:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
> ```
> O, si prefieres no tocar nada, escribe `pnpm.cmd` en lugar de `pnpm`.

**1. Instalar y abrir** (desde la carpeta del proyecto):

```bash
pnpm install
pnpm dev
```

Debe abrirse una ventana oscura con el título *AI Torre de Control*.

**2. Crear tres tareas de plataformas distintas.**
Pulsa **⌘N** (o *Nueva tarea*). Escribe el título y **pega un enlace** de
ChatGPT o de Claude: verás que la plataforma se rellena sola. Repítelo con otras
dos. Deja una como *Borrador* para ver la diferencia.

**3. Cambiar un estado a mano.**
Pulsa el **⋯** de una tarea para abrir su ficha, y en *Corregir a mano* elige
**Te espera**.
→ Debe subir a lo alto, el contador *Centro de atención* de la izquierda debe
marcar uno más, y **debe aparecer una notificación de Windows**. Este es el
punto que necesito que confirmes.
→ Mira también el **Historial de estados** al final de la ficha: debe haber
aparecido una línea nueva.

**4. Ver la oficina.**
Pulsa **Oficina** arriba. Quien te espera está **de pie en la puerta de tu
despacho** con la mano levantada; quien trabaja está en su puesto con las barras
latiendo; lo terminado, junto a la mesa de entregas; los errores, abajo a la
izquierda. Pulsa a cualquiera: se abre su ficha.

**5. Recibir un evento automático simulado.**
Abre la ficha de una tarea y copia el comando que aparece abajo del todo (botón
*Copiar*). En **otra terminal**, dentro de la carpeta del proyecto:

```bash
pnpm evento <el-id-que-copiaste> completed
```

→ La tarea debe pasar a *Terminada* **sola, sin tocar nada**, y debe saltar otra
notificación.

**6. Abrir la conversación.**
Pulsa **Abrir conversación** en cualquier tarea con enlace.
→ Debe abrirse tu navegador en esa dirección.

**7. Comprobar que no se pierde nada.**
Cierra la aplicación del todo. Vuelve a ejecutar `pnpm dev`.
→ Las tres tareas deben seguir ahí, con los estados que dejaste.

**8. Probar los ajustes y la exportación.**
Ve a **Ajustes**: silencia *Cuando una tarea termina* y comprueba que ya no
avisa. Pulsa **Exportar en CSV** y ábrelo con Excel.

**Para ver los tests por ti mismo:**

```bash
pnpm test        # 147 tests de las reglas, la base de datos y la seguridad
pnpm test:e2e    # abre la aplicación de verdad y recorre todo el flujo
```

---

## 5. 🔚 Última decisión tomada

- **2026-08-03** — Adoptar **íntegro** el sistema de diseño «Oficina de papel»
  encargado a Claude Designer, y construirlo funcional (Sprint 002). Detalle en
  [docs/sprints/sprint-002.md](docs/sprints/sprint-002.md) y
  [ADR-006](docs/decisiones/ADR-006-sistema-de-diseno.md).
- **2026-08-03** — Aprobar el **historial de estados** como decisión cerrada D19,
  y dejar el campo «rol» (O7) y el estado «revisada» (O8) como abiertas.
- **2026-08-03** — Construir la primera vertical funcional completa (Sprint 001)
  antes de intentar ninguna integración real. Detalle en
  [docs/sprints/sprint-001.md](docs/sprints/sprint-001.md).
- **2026-08-03** — Descartar `better-sqlite3` en favor de una versión de SQLite
  que no necesita compilarse. Motivo: fallaba la instalación en el equipo real.
  Detalle en [ADR-002](docs/decisiones/ADR-002-local-first.md).
- **2026-08-03** — Exigir una clave local al receptor de eventos, además de que
  escuche solo en `127.0.0.1`. Detalle en
  [ADR-005](docs/decisiones/ADR-005-clave-receptor-local.md).

---

## 6. ⏭️ Próxima decisión necesaria

- **O3 — ¿Cuál será la primera integración real: Claude Code, Codex CLI o una
  plataforma web?** Decide: tú. Bloquea el Sprint 002.
  *Recomendación técnica: Claude Code, porque sus hooks son un mecanismo oficial
  y estable, mientras que las plataformas web dependen de leer su interfaz y se
  rompen cuando cambia.*
- **O1 — ¿Qué sistema operativo se empaqueta primero?** Decide: tú. Bloquea que
  la aplicación se pueda instalar como un programa normal.
  *Si solo la vas a usar tú, la respuesta es Windows.*
- **O7 — ¿Las tareas llevarán un campo «rol»?** y **O8 — ¿hará falta un estado
  «revisada»?** Decides: tú, pero **no todavía**. Las dos vienen del diseño y
  quedaron fuera a propósito. Úsala unos días y sabrás si las echas de menos o
  si solo serían un campo más que rellenar.

---

## 7. ⚠️ Riesgos abiertos

| Riesgo | Impacto | Estado |
|---|---|---|
| **Sin copia de seguridad automática.** Si se pierde el ordenador, se pierde el histórico | Bajo | Mitigado: ya se puede exportar a CSV desde Ajustes y abrir la carpeta para copiar el fichero. Falta que sea automático |
| **Solo probado en Windows.** macOS y Linux sin verificar | Bajo | Abierto. Se cierra cuando se decida O1 |
| **Las integraciones web serán frágiles.** ChatGPT o Claude pueden cambiar su interfaz y romper los detectores | Alto (a futuro) | Mitigado por diseño: estado `unknown`, nivel de confianza y corrección manual siempre disponible |
| **Instalar hooks tocará configuración global de Claude Code** | Medio (a futuro) | No se ha tocado nada. Cuando llegue, se pedirá confirmación explícita y se hará copia de seguridad (D13) |
| **El repositorio es público** | Alto si se descuida | Controlado: sin secretos, sin datos reales, clave local fuera del repositorio, y un test que vigila que no aparezcan columnas capaces de guardar conversaciones |
| **Dependencia de un paquete pequeño** (`node-sqlite3-wasm`) | Bajo | Mitigado: está detrás de una interfaz, cambiarlo son unas decenas de líneas en un solo archivo |

---

## 8. 🎯 Nivel de confianza del estado actual

- [ ] 🟢 **Alto** — Lo he probado y estoy seguro de que funciona como digo.
- [X] 🟡 **Medio** — Funciona, pero no lo he probado a fondo o hay zonas grises.
- [ ] 🔴 **Bajo** — Recién empezado / sin probar / mucha incertidumbre todavía.

**Por qué medio y no alto.** Todo lo listado como «funciona» está comprobado con
pruebas automáticas que se ejecutan sobre la aplicación real, y el aspecto se ha
revisado con capturas de las ocho pantallas contra el documento de diseño. Pero
quedan dos zonas grises honestas: **nadie la ha usado todavía en el día a día**,
y **el dueño del proyecto aún no ha visto la notificación aparecer en su
pantalla**. En cuanto confirmes el paso 3 del apartado «Cómo probarlo» y la uses
un par de días, esto pasa a alto.

---

*Última actualización: 3 de agosto de 2026 por Claude (Sprint 002).*
*Mantiene: Claude (con validación del dueño del proyecto).*
