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

**Comprobado automáticamente** — 105 tests unitarios y 2 pruebas que arrancan
la aplicación de verdad, todos en verde a 3 de agosto de 2026:

- **Instalar y arrancar.** `pnpm install` termina en segundos sin compilar nada.
  `pnpm dev` abre la aplicación.
- **Crear una tarea** con título, plataforma, enlace, sesión, carpeta y notas.
  Los datos incorrectos se rechazan con un mensaje en lenguaje normal.
- **Cambiar el estado a mano**, tanto desde la tarjeta como desde la ficha.
  Solo se ofrecen los cambios que tienen sentido desde el estado actual.
- **Guardar en disco de verdad.** Cierras la aplicación, la vuelves a abrir y
  todo sigue exactamente igual. Esto está comprobado cerrando y reabriendo la
  aplicación en la prueba automática, no solo en teoría.
- **Recibir un evento local** por su canal definitivo: HTTP a `127.0.0.1` con
  clave local. Un evento válido cambia el estado y **la pantalla se actualiza
  sola**, sin recargar.
- **Rechazar eventos indebidos**: sin clave (401), con clave incorrecta,
  con formato incorrecto (415), con datos que no cumplen el contrato (422),
  demasiado grandes (413) y con campos de más (rechazo completo).
- **Avisar al sistema operativo** cuando una tarea pasa a *te espera*,
  *terminada* o *fallida*, con el texto correcto y **sin repetir** el mismo
  aviso dos veces.
- **Abrir la conversación externa** de un clic. Comprobado que la aplicación
  pide abrir exactamente la dirección guardada, y que solo acepta `http` y
  `https`.
- **Las dos vistas muestran el mismo estado.** Comprobado cambiando el estado en
  la vista operativa y verificando que el trabajador de la oficina cambia con
  ella.
- **Archivar** tareas y filtrar por texto, plataforma y grupo.
- **La ficha completa** se abre igual desde la vista operativa que pulsando un
  trabajador en la oficina.

**Construido y revisado, pendiente de que lo veas tú:**

- El **aspecto visual** de las dos pantallas. Las pruebas comprueban que los
  datos correctos están ahí, no que se vean bonitos.
- Que la **notificación aparezca visualmente** en tu Windows. Está comprobado
  que la aplicación se la pide al sistema con el texto correcto, pero el aviso
  se intercepta en las pruebas para no llenarte el escritorio. **Esto es lo
  único importante que te toca confirmar a ti.**

---

## 3. ❌ Qué NO funciona todavía

> Sé generoso aquí: más vale sobre-listar que dar falsa sensación de avance.

**Lo que falta para llegar a MVP:**

- **No hay ninguna integración real.** Ni Claude Code, ni ChatGPT, ni Claude web,
  ni Codex avisan solos. Hoy los eventos hay que simularlos con `pnpm evento`.
  El canal por el que llegarán está construido y probado; falta quien los envíe.
- **No se puede instalar.** No hay un `.exe` ni un instalador: hay que arrancarla
  con `pnpm dev` desde una terminal. Depende de decidir para qué sistema
  operativo se empaqueta primero (decisión abierta O1).

**Fuera de alcance de este sprint, por decisión:**

- Extensión de navegador.
- Lectura del contenido de conversaciones (y no se hará: decisión D5).
- Cualquier API de OpenAI, Anthropic u otros (y no se hará: decisión D2).
- Cuentas, autenticación, sincronización entre ordenadores, multiusuario.
- Oficina visual avanzada (pixel art, isométrico, animaciones). La actual es
  deliberadamente sencilla: React, CSS y SVG.
- Modificación de tu `~/.claude/settings.json`. No se ha tocado nada tuyo.

**Limitaciones conocidas de lo que sí funciona:**

- Solo se ha probado en **Windows 11**. Debería funcionar en macOS y Linux, pero
  no está comprobado.
- No hay **copia de seguridad** de la base de datos. Si pierdes el ordenador,
  pierdes el histórico.
- No hay **registro de errores en fichero**: si algo falla, el detalle solo
  aparece en la consola.
- El rendimiento con **muchísimas tareas** no se ha medido. Sobra para decenas o
  cientos; no sé qué pasa con decenas de miles.

---

## 4. 🧪 Cómo probarlo

> Pasos EXACTOS para que veas el estado actual con tus propios ojos.

Necesitas [Node.js](https://nodejs.org) 20 o superior. Si no tienes `pnpm`:
`npm install -g pnpm`.

**1. Instalar y abrir** (desde la carpeta del proyecto):

```bash
pnpm install
pnpm dev
```

Debe abrirse una ventana oscura con el título *AI Torre de Control*.

**2. Crear tres tareas de plataformas distintas.**
Pulsa **Nueva tarea**. Ponle título, elige la herramienta, pega un enlace
cualquiera que empiece por `https://` y créala. Repítelo con otras dos
plataformas. Elige estados iniciales distintos: una *Trabajando*, otra *En cola*.

**3. Cambiar estados a mano.**
En una tarjeta, usa el desplegable *Cambiar estado…* y pon **Te espera**.
→ Debe subir al grupo de arriba, *Necesitan tu atención*, y **debe aparecer una
notificación de Windows**. Este es el punto que necesito que confirmes.

**4. Ver la oficina.**
Pulsa **Oficina** arriba. Verás una persona por tarea, con el color y el símbolo
de su estado, y quien te espera con la mano levantada. Pulsa a cualquiera: se
abre su ficha completa.

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

**Para ver los tests por ti mismo:**

```bash
pnpm test        # 105 tests de las reglas, la base de datos y la seguridad
pnpm test:e2e    # abre la aplicación de verdad y recorre todo el flujo
```

---

## 5. 🔚 Última decisión tomada

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

---

## 7. ⚠️ Riesgos abiertos

| Riesgo | Impacto | Estado |
|---|---|---|
| **Sin copia de seguridad.** Si se pierde el ordenador, se pierde el histórico de tareas | Medio | Abierto. Se resuelve con una exportación sencilla o copiando el fichero `.db` |
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
pruebas automáticas que se ejecutan sobre la aplicación real, no supuesto. Pero
quedan dos zonas grises honestas: **nadie la ha usado todavía en el día a día**,
y **el dueño del proyecto aún no ha visto la notificación aparecer en su
pantalla**. En cuanto confirmes el paso 3 del apartado «Cómo probarlo» y la uses
un par de días, esto pasa a alto.

---

*Última actualización: 3 de agosto de 2026 por Claude (Sprint 001).*
*Mantiene: Claude (con validación del dueño del proyecto).*
