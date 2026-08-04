# Sprint 003 — Claude Code conectado

**Fecha:** 4 de agosto de 2026
**Rama:** `feat/integracion-claude-code`
**Fase:** Fase 2 — Claude Code
**Estado al terminar:** 🛠️ Prototipo funcional (con la primera integración real construida)

---

## Objetivo

Que Claude Code avise solo a la Torre, y que los permisos que pide se puedan
resolver desde ella sin cambiar de ventana.

Nace de una petición concreta del dueño del proyecto:

> *«Cuando mando a Claude Code, que si me está pidiendo permiso para hacer algo
> aparezca como que está en espera y pueda darle a aceptar.»*

---

## La decisión difícil

Ese «pueda darle a aceptar» **contradecía la decisión cerrada D18**, que prohibía
expresamente que ninguna integración aceptara permisos en nombre del usuario.

Se le expuso el riesgo antes de construir nada:

> Cuando Claude Code pide permiso te enseña el comando completo. En una tarjeta
> de la Torre verías menos contexto. La diferencia entre aprobar leyendo y
> aprobar por reflejo es cómo se borra una carpeta que no tocaba.

Se le ofrecieron dos alternativas que no reabrían la decisión —solo llevarle a
la sesión, o aceptar únicamente lo inofensivo—. **Las descartó y reafirmó que
quería el botón.** Queda registrado en [ADR-007](../decisiones/ADR-007-permisos-remotos.md)
quién decidió qué y con qué información delante.

D18 se sustituyó por **D18-bis**: la Torre puede *transmitir* una decisión
humana, nunca decidir por su cuenta.

### Las tres salvaguardas que la hacen aceptable

| | |
|---|---|
| **D20** — nada en disco | Las peticiones viven **solo en memoria**. Por eso se puede enseñar el comando íntegro sin romper D5. Al cerrar la aplicación desaparecen |
| **D21** — tiempo de espera con salida | Si no decides en 90 s, o la Torre está cerrada, Claude Code **pregunta en su terminal como siempre**. Ninguna sesión se queda colgada |
| **El comando entero** | La tarjeta no resume. Aprobar un resumen sería peor que no aprobar nada |

La salvaguarda D21 es la que convirtió la petición en algo defendible. Sin ella,
cerrar la Torre por accidente habría dejado sesiones muertas.

---

## Qué se ha construido

### El canal de permisos

```
Claude Code pide permiso
        ↓  el hook manda la petición y ESPERA
Receptor local 127.0.0.1/permissions
        ↓  encuentra o crea la tarea, la pone en «te espera»
Notificación de Windows + tarjeta en la Torre
        ↓  tu clic
Respuesta de vuelta al hook  →  Claude Code continúa o se detiene
```

Si en cualquier punto algo falla o tarda, el hook se aparta y Claude Code se
comporta como si esto no existiera.

### El enlace con Claude Code

Un único script que atiende cuatro eventos:

| Evento | Qué hace |
|---|---|
| `PermissionRequest` | Te lo enseña y espera tu decisión |
| `Notification` | La tarea pasa a «te espera» |
| `Stop` | Refresca la señal de vida |
| `SessionEnd` | La tarea pasa a «terminada» |

**No hace falta registrar las tareas a mano.** La sesión dice desde qué carpeta
trabaja; si hay una tarea con esa carpeta se asocia, y si no, se crea. Perder
una señal es peor que tener una tarea de más.

### El instalador, con D13 intacta

Instalar modifica `~/.claude/settings.json`, que gobierna **todas** tus sesiones
de Claude Code. Por eso:

- El botón de instalar **no aparece** hasta que has visto el cambio exacto:
  el fichero antes, después, y dónde queda la copia de seguridad.
- Se guarda copia **antes** de escribir, siempre.
- Se **conservan** los automatismos que ya tuvieras: nunca se sustituye una
  lista, se añade al final.
- Se niega a tocar un fichero cuyo JSON no entienda.
- Hay desinstalación limpia que quita solo lo nuestro.
- El script se copia a **tu carpeta de datos**, no se referencia dentro del
  repositorio: puedes mover o borrar la carpeta del proyecto sin romper nada.

---

## Verificación

| | |
|---|---|
| Tests unitarios | **173** |
| Pruebas de interfaz | **10** |
| Tipos y build | ✅ |

Lo importante no es el número, sino qué se comprueba:

- **El script real del hook**, ejecutado como lo ejecutará Claude Code —con el
  JSON del evento por la entrada estándar—, espera, recibe el clic y escribe la
  respuesta que Claude Code leerá. No se simula ninguna pieza.
- **Sin la Torre abierta, el hook sale en silencio con código 0.** Es la prueba
  de D21.
- **El instalador conserva** un hook personal preexistente y lo deja intacto al
  desinstalar.
- **Se niega** a escribir sobre un `settings.json` corrupto, y lo deja como
  estaba.
- **Reinstalar no duplica** entradas.
- Una petición **sin la clave local** no llega a la pantalla.

---

## Qué NO se ha hecho

- **ChatGPT.** Era la otra mitad de lo que pediste. Va al Sprint 004: necesita
  una extensión de navegador, que es un mecanismo mucho más frágil —hay que leer
  la página, y se rompe cuando cambian el diseño.
- **Codex.** Sprint 005.
- **Instalable.** Sigue arrancándose con `pnpm dev`. Depende de O1.
- **Enlace directo a la sesión.** La ficha guarda el identificador de sesión,
  pero no hay un botón que abra esa terminal: no hay forma fiable de hacerlo
  desde fuera. Lo que sí hay es el identificador para `claude --resume`.

---

## Riesgo que hay que vigilar

El que el propio dueño aceptó: **aprobar con menos contexto del que hay en la
terminal.** La tarjeta enseña el comando entero, pero no la conversación que
llevó hasta él.

Si en el uso real aparece **una sola aprobación por reflejo de la que te
arrepientas**, hay que revisarlo. La opción «aceptar solo lo inofensivo» sigue
sobre la mesa.

---

## Siguiente paso

1. Instalar el enlace desde **Ajustes → Enlace con Claude Code**, mirando el
   cambio antes de aceptarlo.
2. Usarlo unos días con trabajo real.
3. Decidir si ChatGPT (Sprint 004) o empaquetar la aplicación (O1) es lo
   siguiente.
