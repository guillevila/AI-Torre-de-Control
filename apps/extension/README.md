# Extensión de navegador — AI Torre de Control

Registra en tu Torre, de un clic, la conversación que tienes abierta en el
navegador. Pensada para ChatGPT, aunque funciona con cualquier página.

---

## Lo primero: qué NO puede hacer

Esto va antes que las instrucciones porque es lo que importa.

**Esta extensión no puede leer tus conversaciones.** No es una promesa ni una
buena intención: es que Chrome no le deja.

| | Por qué |
|---|---|
| **No puede leer ChatGPT** | No pide permiso sobre `chatgpt.com` ni sobre ningún otro sitio. Sin ese permiso, Chrome le niega el contenido de la página |
| **No se mete en las páginas** | No tiene *content scripts*: no inyecta nada dentro de las webs que visitas |
| **No funciona sola** | No hay ningún proceso de fondo. Solo hace algo cuando pulsas su icono |
| **No sale a internet** | El único sitio al que puede escribir es `127.0.0.1`, o sea tu propio ordenador |

Lo único que lee es **el título y la dirección de la pestaña**, y solo en el
momento en que pulsas el icono (permiso `activeTab`, que Chrome concede para esa
pestaña y se acaba al cerrar la ventanita).

Puedes comprobarlo tú: todo esto está en [`manifest.json`](manifest.json), que
son 25 líneas. Los permisos que pide son estos y no hay más:

```json
"permissions": ["activeTab", "storage"],
"host_permissions": ["http://127.0.0.1/*"]
```

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

Cuando quieras, cambias su estado a mano desde la Torre. Que ChatGPT avise solo
de que ha terminado es la **etapa 2**, y todavía no existe.

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
| [`torre.js`](torre.js) | Todo lo que sale del navegador: buscar la Torre y registrar |
| [`popup.js`](popup.js) / [`popup.html`](popup.html) | La ventanita del icono |
| [`opciones.js`](opciones.js) / [`opciones.html`](opciones.html) | La clave local |
| [`scripts/generar-iconos.mjs`](scripts/generar-iconos.mjs) | Genera los iconos, para que no sean binarios sin origen |

La Torre la busca probando `/health` en los puertos 4319 a 4323, los mismos que
intenta abrir la aplicación. El que responde se recuerda para no barrerlos todos
la próxima vez.

No hay compilación ni dependencias: es JavaScript de navegador tal cual. Las
funciones puras se prueban con `pnpm test`.
