# ADR-009 — Un icono por conversación, no por proyecto

**Fecha:** 2026-08-04
**Estado:** Aceptada
**Revisa:** **D23** («un proyecto = un icono, nunca dos») → sustituida por **D23-bis**

---

## Contexto

**Esto empezó como una petición de visibilidad y resultó ser un fallo con pérdida
de datos.** Merece la pena contarlo en ese orden, porque cambia el peso de la
decisión.

El dueño del proyecto preguntó cómo ver el estado de cada conversación cuando
tiene varias abiertas en el mismo repositorio. Al mirarlo, apareció esto en
`session-linker.ts`:

- Una tarea guarda **un solo** `externalSessionId`.
- Cuando llegaba una señal de otra conversación del mismo repositorio, el enlace
  reutilizaba la tarea y **sobrescribía** ese identificador.
- Resultado: el estado de la tarea era el de **la última señal recibida**, de
  cualquiera de las conversaciones.

Es decir: con dos conversaciones abiertas, si una te esperaba y la otra terminaba
su turno, **el «te espera» desaparecía y nunca te enterabas**. La función central
del producto —no perder lo que te reclama— fallaba precisamente en el escenario
que el modo desatendido (D24) hace más probable: más conversaciones a la vez,
más señales pisándose.

D23 decía:

> Un proyecto de Claude Code tiene **un solo icono**, que se mueve entre estados.
> Nunca dos. […] Las sesiones se emparejan por carpeta —incluidas las
> subcarpetas— y una tarea en reposo se reutiliza en lugar de crear otra.

## La objeción que se planteó, y su respuesta

Se le ofreció al dueño una alternativa que **no reabría D23**: mantener un icono
por proyecto que mostrara el estado *más urgente* de sus conversaciones, y ver el
desglose al abrir la ficha. Arreglaba la pérdida de información igual.

**El dueño eligió un icono por conversación**, con la consecuencia expuesta
delante: un repositorio con cuatro conversaciones abiertas pone cuatro muñecos, y
la oficina pasa de decir «tengo 3 proyectos» a «tengo 11 ventanas». Es su
producto y su criterio de qué quiere ver de un vistazo.

## Decisión

**La identidad de una tarea de Claude Code pasa a ser la conversación, no la
carpeta.**

1. **Misma conversación → misma tarea, siempre.** Se busca primero por
   identificador de sesión. Da igual desde qué subcarpeta llegue la señal: una
   conversación nunca se parte en dos iconos. Esto conserva intacto el motivo por
   el que se escribió D23.
2. **Conversación nueva en un proyecto ocupado → icono nuevo.** Una tarea que ya
   pertenece a otra conversación viva no se reutiliza.
3. **Sin identificador de sesión → como siempre**, emparejando por carpeta.
   Perder una señal es peor que compartir una tarea.

### Lo que evita que la oficina se llene

«Ocupada» **excluye el reposo**. Una tarea en estado **revisada** (D22) ya no
reclama nada, así que vuelve a estar disponible y la adopta la siguiente
conversación que abras. El ciclo que D22 y D23 dejaron montado sigue funcionando:
revisas, y el icono se recicla.

Sin esta condición, cada sesión que abrieras crearía un muñeco permanente y en
una semana la oficina sería un cementerio. Es la parte útil de D23, conservada.

### Cómo se distinguen en pantalla

Dos tareas del mismo repositorio tendrían la misma etiqueta bajo el muñeco —el
nombre de la carpeta— y serían indistinguibles. Así que:

- La **segunda** conversación de un proyecto lleva el código de sesión en el
  título: `Claude Code · mi-app · a8439a`.
- La **etiqueta** de la oficina añade ese código **solo cuando hay ambigüedad**.
  Con una sola conversación por proyecto —el caso normal— la etiqueta sigue
  limpia: un código que no distingue nada solo ocupa 96 píxeles de nada.

**Por qué un código y no un nombre.** Claude Code no manda el título de la
conversación a sus hooks, y aunque lo mandara, **D5** prohíbe que la Torre reciba
contenido de conversaciones. El identificador de sesión es lo único disponible, y
es opaco por diseño.

## Alternativas consideradas

- **Un icono por proyecto con el estado más urgente, y desglose en la ficha.**
  Arreglaba la pérdida de información sin reabrir D23 ni llenar la planta.
  **Descartada por el dueño del proyecto.**
- **Dejarlo como estaba.** Descartada sin discusión: hay pérdida de señales, y
  eso contradice la razón de existir del producto.
- **Guardar una lista de sesiones dentro de una sola tarea.** Habría exigido
  migración de la base de datos y un estado por sesión dentro de la tarea, o sea
  el modelo de arriba con más complicación y sin icono propio. Descartada.

## Consecuencias

**A favor**

- Se arregla una pérdida de datos real: ninguna conversación borra el estado de
  otra.
- Cada conversación tiene su estado visible de un vistazo, que es lo que se pedía.
- La misma conversación sigue siendo un solo icono aunque salte de subcarpeta.

**En contra, asumido conscientemente**

- **La planta se llena más.** Un repositorio con varias conversaciones abiertas
  ocupa varios puestos. La oficina deja de ser un mapa de proyectos.
- **Etiquetas con código de sesión.** `mi-app · a8439a` es menos legible que
  `mi-app`. Mitigado apareciendo solo cuando hay ambigüedad.
- **Más tareas que revisar.** Cada conversación termina en la mesa de entregas por
  su cuenta. El reciclaje depende de que las marques como revisadas; si no lo
  haces, se acumulan.

**Qué haría reconsiderarlo**

Que la planta se vuelva ilegible en el uso normal. La alternativa descartada
—icono por proyecto, desglose en la ficha— sigue disponible, y el trabajo hecho
aquí no se pierde: la identidad por conversación es lo que permite calcular el
«estado más urgente» de un proyecto.

---

## Adenda (mismo día): el reciclaje al cerrar la sesión

La consecuencia prevista —«la planta se llena más»— apareció **el primer día**:
el dueño reinició todas sus sesiones para instalar el enlace, cada reinicio
estrenó conversación, y la planta quedó llena de muñecos huérfanos de sesiones
muertas. El reciclaje original solo actuaba sobre tareas **revisadas**, y nadie
revisa la tarea de un simple reinicio.

**Corrección, dentro de la misma decisión:** una tarea también queda libre
cuando su conversación **ha terminado** (el evento `SessionEnd` del enlace, que
ahora viaja como `sessionEnded` en el aviso). Cerrar una sesión deja su entrega
en la mesa; abrir la siguiente en esa carpeta **adopta esa misma tarea** —con su
historial— en lugar de crear otra.

Lo que NO cambia: una conversación **viva** sigue sin poder ser robada (el
arreglo central de este ADR), y lo entregado no se descarta jamás — si nadie
abre otra sesión, la entrega espera en la mesa hasta que la revises.

Dos límites honestos:

- **Una sesión que muere sin despedirse** (cierre forzado del ordenador, un
  cuelgue) no emite `SessionEnd`, así que su tarea queda «viva» y ocupa sitio
  hasta que la revises o archives a mano.
- **Las tareas existentes** de antes de este cambio se marcan como terminadas en
  bloque (migración v3). Si alguna sigue viva de verdad, se corrige sola con su
  siguiente señal; la dirección contraria no se corregiría nunca, por eso se
  eligió esta.
