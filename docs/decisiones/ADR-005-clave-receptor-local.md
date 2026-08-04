# ADR-005 — El receptor local exige una clave, además de escuchar solo en 127.0.0.1

**Fecha:** 2026-08-03
**Estado:** Aceptada
**Relacionada con:** decisiones D17, D18 y sección 13 de [SYSTEM_VISION.md](../../SYSTEM_VISION.md)

## Contexto

La aplicación abre un pequeño servidor para recibir avisos de herramientas
locales («la tarea 3f2a ha terminado»). La decisión D17 exige que escuche
únicamente en `127.0.0.1`.

Eso protege frente a la red: ningún otro equipo puede alcanzarlo. **Pero no
protege frente al propio ordenador.** Cualquier programa que se ejecute en la
misma máquina —una dependencia comprometida, un script descargado, una extensión
maliciosa— podría enviar eventos y falsear el estado de las tareas.

El daño no sería catastrófico (un evento solo mueve estados, no ejecuta nada),
pero sí destruiría lo único que el producto vende: **poder fiarse de lo que ves**.
Una tarea marcada como terminada cuando no lo está es exactamente el fallo que
la aplicación existe para evitar.

## Decisión

Además de escuchar solo en bucle local, **el receptor exige una clave secreta**
en la cabecera `x-torre-token` de cada evento.

- Se genera sola en el primer arranque (32 bytes aleatorios).
- Se guarda en `event-endpoint.json`, dentro de la carpeta de datos del usuario,
  junto a la dirección y el puerto, con permisos restringidos.
- **Nunca entra en el repositorio** (D15). Está en `.gitignore` y no hay ninguna
  variable de entorno que la contenga.
- Se compara en tiempo constante, para no filtrar información por el tiempo de
  respuesta.
- La aplicación la muestra en su panel «Eventos», oculta hasta que se pulse
  mostrar.

Las herramientas locales legítimas leen el fichero y usan la clave. Es lo que
hace el script `pnpm evento`, y lo que hará el futuro hook de Claude Code.

### Barreras adicionales que acompañan a la clave

Ninguna sustituye a las otras; se suman:

1. Atado a `127.0.0.1` en el `listen`.
2. Comprobación de que la conexión viene de una dirección de bucle local.
3. Clave local.
4. `Content-Type: application/json` obligatorio — obliga a cualquier página web
   a pedir permiso previo, que nunca se concede.
5. Límite de 16 KB por evento.
6. Validación estricta del contrato: un solo campo de más rechaza el evento
   entero.
7. Sin cabeceras CORS: ninguna web puede leer las respuestas.

## Alternativas consideradas

- **Solo `127.0.0.1`, sin clave** — es lo que pedía el requisito mínimo.
  Descartada por lo explicado: no protege de otros procesos del mismo equipo, y
  la fiabilidad del estado es el núcleo del producto.
- **Autenticación por certificado o firma** — descartada: complejidad
  desproporcionada para un canal que no sale del ordenador, y haría mucho más
  difícil escribir un hook sencillo.
- **Socket de dominio Unix / named pipe** — más elegante en cuanto a permisos,
  pero el comportamiento difiere bastante entre Windows y el resto, y complicaría
  a los futuros adaptadores. Se reconsiderará si aparece un motivo concreto.
- **Comprobar qué proceso envía el evento** — descartada: es distinto en cada
  sistema operativo y bastante frágil.

## Consecuencias

**A favor**

- Un programa cualquiera del ordenador ya no puede falsear estados: necesita
  además poder leer la carpeta de datos del usuario.
- El mecanismo es el mismo que usarán las integraciones reales, así que lo que
  se prueba hoy con `pnpm evento` es exactamente el camino de mañana.

**En contra**

- Cualquier integración futura tiene que leer el fichero de conexión. Es un paso
  más que documentar, aunque son cuatro líneas.
- Si el usuario borra la carpeta de datos, la clave cambia y hay que releerla.
  Aceptable: las herramientas la leen en cada ejecución.
- No protege de un atacante que ya tenga acceso completo a la cuenta del
  usuario. Ninguna medida local lo haría, y queda fuera del modelo de amenaza.

**Revisión**

Se reabriría si un adaptador real demostrara que leer el fichero es un obstáculo
práctico, o si se decidiera exponer el receptor más allá del propio equipo — lo
que hoy contradice D17.
