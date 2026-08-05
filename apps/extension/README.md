# Extensión de navegador — AI Torre de Control

Registra en tu Torre, de un clic, la conversación que tienes abierta en el
navegador. Pensada para ChatGPT, aunque funciona con cualquier página.

---

## Lo primero: qué NO puede hacer

Esto va antes que las instrucciones porque es lo que importa.

**Esta extensión no puede leer tus conversaciones**, ni recién instalada ni con
la detección automática activada.

Recién instalada, además, **no puede ni mirar la página**. Los permisos que pide
al instalarse son estos y no hay más:

```json
"permissions": ["activeTab", "storage", "scripting"],
"host_permissions": ["http://127.0.0.1/*"]
```

| | Por qué |
|---|---|
| **No puede ver ChatGPT** | No pide permiso sobre `chatgpt.com` ni sobre ningún otro sitio. Sin ese permiso, Chrome le niega la página entera |
| **No se mete en las páginas** | No inyecta nada dentro de las webs que visitas |
| **No sale a internet** | El único sitio al que puede escribir es `127.0.0.1`, tu propio ordenador |

Lo único que lee es **el título y la dirección de la pestaña**, y solo en el
momento en que pulsas el icono (permiso `activeTab`, que Chrome concede para esa
pestaña y se acaba al cerrar la ventanita).

Todo esto se comprueba en [`manifest.json`](manifest.json), que son 30 líneas.

Y por si el navegador fallara: **la Torre tampoco aceptaría contenido de
conversación aunque se lo mandaran**. Su contrato de alta solo admite dos
campos, y cualquier campo de más provoca el rechazo completo de la petición. Hay
tests que lo vigilan.

---

## Instalarla

Es una extensión sin publicar, así que se instala «en modo desarrollador». Suena
técnico pero son cuatro clics.

1. Abre Chrome y ve a `chrome://extensions`
2. Arriba a la derecha, activa **Modo de desarrollador**
3. Pulsa **Cargar descomprimida**
4. Elige esta carpeta: `apps/extension`

Ya está. Verás su icono en la barra. Convie­ne **anclarlo** (el icono de la
chincheta) para tenerlo siempre a mano.

---

## Configurarla, una sola vez

La Torre solo acepta órdenes de quien conoce su clave local. Hay que dársela:

1. Abre **AI Torre de Control** → **Ajustes** → baja hasta **Privacidad y datos**
2. En **Clave local**, pulsa **Ver** y luego **Copiar**
3. En Chrome, botón derecho sobre el icono de la extensión → **Opciones**
4. Pégala y pulsa **Guardar y comprobar**

Si todo está bien, te dirá en qué puerto ha encontrado la Torre. Si no, te dirá
exactamente qué falla. La clave se guarda solo en tu navegador.

---

## Usarla

1. Ten abierta la conversación en ChatGPT
2. Pulsa el icono de la extensión
3. Comprueba el título que ha leído y pulsa **Registrar en la Torre**

La tarea aparece al momento en la Torre, **en cola**.

### Por qué «en cola» y no «trabajando»

Porque es la verdad. Registrar una conversación no significa que ChatGPT esté
haciendo nada: lo único que sabemos es que existe y que tú la has marcado. La
tarea nace con **confianza baja** y con la fuente «extensión de navegador», para
que en el historial se vea de dónde salió.

Cuando quieras, cambias su estado a mano desde la Torre. O activas la detección
automática, que es lo siguiente.

---

## Detección automática (opcional)

Que la tarea pase sola a **trabajando** cuando ChatGPT empieza a responder, y a
**terminada** cuando acaba. Sin tocar nada.

### Cómo se activa

Abre la extensión estando en ChatGPT y pulsa **Activar en este sitio**. Chrome te
preguntará si le das permiso sobre ese sitio. Puedes **desactivarlo desde el
mismo botón** cuando quieras.

### Qué mira exactamente

**Una sola cosa: si existe en la página el botón de detener la respuesta.**
Mientras está, hay algo generándose; cuando desaparece, ha terminado. Es como
mirar si la luz del despacho está encendida — te dice que hay alguien
trabajando, no lo que está escribiendo.

Lo único que sale del navegador son **tres datos**: la dirección de la pestaña,
una de dos palabras (`running` o `completed`) y la hora. Hay un test que arranca
un servidor de verdad y comprueba que el paquete no lleva nada más.

### Qué cambia, dicho sin adornos

Este es el único punto del proyecto donde una garantía se relaja, y conviene
entenderlo:

- **Antes de activarlo:** la extensión *no puede* leer la página. Chrome se lo
  impide.
- **Después de activarlo:** la extensión *puede* leer la página, y no lo hace.
  Pasa de una garantía del navegador a una garantía del código.

Lo que **no** cambia: la Torre sigue rechazando cualquier contenido de
conversación aunque se lo manden. Su contrato admite tres campos y rechaza la
petición entera si llega uno más.

Por eso el permiso es opcional y reversible: la decisión es tuya y puedes
deshacerla en dos clics.

### Se va a romper, y lo sabemos

ChatGPT cambia su interfaz cada pocas semanas. Cuando cambie el botón de parar,
dejaremos de reconocerlo.

Está escrito para **fallar callando**: si no reconoce nada, no manda nada, y la
tarea se queda donde estaba. Nunca se inventa un estado. Una Torre que no se
entera es un incordio; una que miente es un problema de verdad.

Si notas que ha dejado de detectar, avísame y se ajusta: son cuatro líneas en
[`vigilante.js`](vigilante.js), agrupadas y comentadas justo para eso.

### Varias cuentas a la vez

Si trabajas con varias cuentas de ChatGPT —unos chats de una, otros de otra—,
todos caben en la Torre: cada conversación es su propia tarea y se mueve por su
cuenta. Pero se ven todos iguales, así que conviene etiquetarlos.

En **Opciones → Cuenta de este perfil** escribes cómo llamas a esa cuenta
(«Personal», «Alsari», lo que sea). Todas las conversaciones que registres desde
ese perfil de Chrome llevarán esa etiqueta, y la verás bajo el muñeco.

Como **cada perfil de Chrome guarda lo suyo**, basta con un perfil por cuenta y
escribirlo una vez en cada uno.

> **La escribes tú.** La extensión no sabe con qué cuenta de ChatGPT estás:
> tendría que leer la página para averiguarlo, y no lo hace. Si lo dejas vacío,
> las tareas se registran sin cuenta.

Si etiquetas el perfil *después* de haber registrado una conversación, vuelve a
pulsar «Registrar» sobre ella y se pone al día. Y registrar desde un perfil sin
etiquetar **no le quita** la cuenta a una que ya la tenía.

### Si la registras dos veces

No pasa nada: la extensión te dirá *«ya estaba en la Torre»* y no creará una
tarea repetida. Se comparan las direcciones ignorando la barra final y el trozo
tras la almohadilla, porque el navegador los añade y quita él solo.

---

## Si algo no funciona

| Lo que ves | Qué pasa |
|---|---|
| *«No encuentro la Torre»* | La aplicación no está abierta. Ábrela y vuelve a intentarlo |
| *«La clave local no es correcta»* | Cópiala otra vez desde Ajustes → Privacidad y datos |
| *«Esta pestaña no se puede registrar»* | Estás en una página que no es web (`chrome://…`, un PDF local…) |
| *«La pestaña no tiene título»* | Raro, pero pasa mientras carga. Espera a que cargue del todo |

---

## Para quien lea el código

| Fichero | Qué hace |
|---|---|
| [`manifest.json`](manifest.json) | Los permisos. **Es el fichero que importa** |
| [`torre.js`](torre.js) | Todo lo que sale del navegador: buscar la Torre, registrar y avisar |
| [`popup.js`](popup.js) / [`popup.html`](popup.html) | La ventanita del icono y el interruptor de la detección |
| [`opciones.js`](opciones.js) / [`opciones.html`](opciones.html) | La clave local |
| [`vigilante.js`](vigilante.js) | Mira si hay una respuesta generándose. Solo donde diste permiso |
| [`fondo.js`](fondo.js) | Da de alta y retira el vigilante, y reenvía lo que ve a la Torre |
| [`scripts/generar-iconos.mjs`](scripts/generar-iconos.mjs) | Genera los iconos, para que no sean binarios sin origen |

El vigilante no puede hablar con la Torre directamente: un script dentro de una
página web está sujeto a las reglas de esa página, y ChatGPT no permite llamar a
tu ordenador. Por eso existe `fondo.js`, que sí puede.

La Torre la busca probando `/health` en los puertos 4319 a 4323, los mismos que
intenta abrir la aplicación. El que responde se recuerda para no barrerlos todos
la próxima vez.

No hay compilación ni dependencias: es JavaScript de navegador tal cual. Las
funciones puras se prueban con `pnpm test`.
