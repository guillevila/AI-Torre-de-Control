# ADR-003 — Modelo normalizado de estados con fuente y confianza

**Fecha:** 2026-08-03
**Estado:** Aceptada
**Relacionada con:** decisiones D6, D7, D8, D9 de [SYSTEM_VISION.md](../../SYSTEM_VISION.md)

## Contexto

Cada plataforma dice las cosas a su manera: una habla de «generando», otra de
«in progress», otra simplemente muestra un cursor parpadeando. Y algunas señales
no son señales oficiales, sino deducciones a partir de lo que se ve en pantalla,
que pueden equivocarse.

Hay dos riesgos distintos y ambos son graves:

1. Que la interfaz acabe llena de nombres de estado de cada herramienta, y el
   usuario tenga que aprenderse el vocabulario de todas.
2. Que una deducción poco fiable se presente con la misma seguridad que un aviso
   oficial. Creer que algo terminó cuando no ha terminado es peor que no saberlo.

## Decisión

**Tres piezas obligatorias en cada estado**, y una única puerta para cambiarlo.

### 1. Ocho estados normalizados

`draft` · `queued` · `running` · `waiting_user` · `completed` · `failed` ·
`unknown` · `archived`

Cualquier plataforma traduce a esta lista. `unknown` existe precisamente para no
mentir: cuando se pierde el contacto, la aplicación lo dice en lugar de dejar la
tarea eternamente «trabajando» (D9).

### 2. Cada estado arrastra su procedencia

- **Fuente**: `manual`, `local_event`, `claude_hook`, `browser_extension`,
  `process_monitor`.
- **Confianza**: `high`, `medium`, `low`.

Se muestran **siempre** en la interfaz, no solo cuando hay dudas. El usuario
puede distinguir de un vistazo «esto lo marqué yo» de «esto lo dedujo una
extensión y podría estar equivocado».

### 3. Una única máquina de estados

Todo cambio pasa por `applyStatusChange()` en `packages/domain`. Ni la interfaz,
ni el receptor de eventos, ni la base de datos modifican `status` por su cuenta.

Reglas que centraliza:

- **Grafo de transiciones**: qué salto es posible y cuál solo puede venir de un
  error.
- **La decisión manual manda**: lo que el usuario cerró a mano
  (`completed`, `failed`, `archived`) no lo puede deshacer una señal automática.
- **Marcas de tiempo derivadas**: `startedAt` se fija una vez; `finishedAt` se
  borra si la tarea se reabre.
- **Cuándo avisar**: solo al entrar de verdad en `waiting_user`, `completed` o
  `failed`.

## Alternativas consideradas

- **Guardar el estado literal de cada plataforma** — descartada: traslada la
  complejidad a la interfaz y a la cabeza del usuario. Contradice D7.
- **Un solo booleano «terminada / no terminada»** — descartada: pierde
  exactamente la información más valiosa, que es «te está esperando».
- **Cambiar el estado desde los componentes de la interfaz** — descartada: es el
  camino garantizado a que dos pantallas se comporten distinto y a que nadie
  sepa dónde mirar cuando algo falla.
- **Un campo de confianza numérico (0–100)** — descartada: da falsa precisión.
  Tres niveles se entienden y se pueden pintar.

## Consecuencias

**A favor**

- La interfaz nunca depende de los nombres internos de nadie.
- Añadir una plataforma nueva es escribir un traductor a estos ocho estados, sin
  tocar nada más.
- Un solo archivo que auditar cuando un estado se comporta raro, y un solo sitio
  que testear (33 tests unitarios cubren estas reglas).
- El usuario puede confiar en lo que ve, porque la aplicación distingue entre lo
  que sabe y lo que supone.

**En contra**

- Los ocho estados pueden quedarse cortos algún día. Añadir uno obliga a revisar
  el grafo de transiciones entero.
- El grafo hay que mantenerlo: si una transición legítima no está contemplada,
  el evento se rechaza. Mitigado con mensajes de rechazo explícitos y con la
  posibilidad de corregir siempre a mano (D6).

**Revisión**

Añadir un estado nuevo requiere información real de una integración concreta que
no encaje en los ocho actuales. No se hará por intuición.
