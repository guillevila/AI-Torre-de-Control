# ADR-010 — El nombre de la conversación llega a la Torre

**Fecha:** 2026-08-04
**Estado:** Aceptada
**Revisa:** **D5** («no se almacenará contenido de conversaciones») → matizada por **D5-bis**
**Resuelve:** la decisión abierta **O9** (dos líneas en la etiqueta del muñeco)

---

## Contexto

El dueño quería ver bajo cada muñeco **qué conversación** es, no solo el repo.
Se le había explicado que el título no viaja en los hooks y que leerlo de la
transcripción rompería D5. Su decisión fue explícita, con estas palabras:

> «Pues si tiene que leer la conversación entera, que lo haga. […] Por lo que
> D5, fuera para tener el título.»

Es decir: el dueño autorizó **incluso leer la conversación entera**. Este ADR
registra que se implementó **mucho menos que eso**, porque investigando se
encontró una vía que no lo necesita.

## El hallazgo que cambió el coste

Claude Code mantiene un **registro de sesiones vivas** (`~/.claude/sessions/`):
un fichero de metadatos por sesión con su identificador, su carpeta y su
**nombre** — el automático («mi-app-a3») o el que el dueño pone con `/rename`.

El nombre está **fuera de la transcripción**. Se puede leer sin abrir jamás el
fichero de la conversación.

## Decisión (D5-bis)

**La Torre acepta exactamente una pieza de texto de la conversación: su NOMBRE,
acotado a 200 caracteres.** Los mensajes siguen sin tener ningún campo por el
que colarse; el contrato estricto sigue rechazando todo lo demás.

Cómo circula:

1. El enlace, en cada aviso de estado, busca su sesión en el registro de
   metadatos y añade `sessionTitle` si lo encuentra. **Jamás abre la
   transcripción** — el test «no manda nada del contenido de la conversación»
   sigue vigilando eso.
2. La Torre lo guarda en la tarea (columna `session_title`, migración v4) y lo
   refresca cuando cambia: un `/rename` a mitad de sesión se ve en la señal
   siguiente.
3. El muñeco lo enseña en **dos líneas**: el proyecto arriba, en pequeño, y el
   nombre debajo (O9, tal y como lo pidió el dueño). Sin nombre —tarea manual,
   enlace antiguo— se queda la línea única de siempre.

## Matiz de honestidad

El nombre automático **puede derivar del tema de la conversación** (Claude Code
genera títulos a partir de lo que se habla). Por eso esto es D5-bis y no «D5
intacta»: una línea de texto relacionada con el contenido sí entra ahora en la
Torre y sí se escribe en disco. Quien audite el proyecto debe saberlo. La
frontera nueva es nítida: **un nombre de una línea sí; mensajes, nunca**.

## Alternativas consideradas

- **Leer el título de la transcripción** (lo que el dueño autorizó). Descartada:
  exige abrir el fichero que D5 protege, y el registro de metadatos da lo mismo
  sin tocarlo. Se implementó lo mínimo que cumple el deseo.
- **Solo nombres puestos a mano en la Torre.** Era la recomendación anterior
  (sin tocar D5), pero exige disciplina del dueño y deja los muñecos anónimos
  por defecto. Descartada por el dueño al pedir el nombre real.
- **No hacer nada.** Descartada: petición explícita y repetida.

## Consecuencias

**A favor**

- Cada muñeco dice qué conversación es, que era lo pedido. Y `/rename` en
  Claude Code se convierte en la forma natural de etiquetar el trabajo.
- D5 se matiza, no se derriba: los mensajes siguen fuera, con test de guardia.

**En contra, asumido conscientemente**

- Un texto derivado del contenido entra y **se persiste**. El repositorio sigue
  siendo público: los nombres de conversación quedan en la base de datos local
  (no en el repo), pero cualquier exportación CSV los incluirá.
- Los nombres automáticos son poco descriptivos («mi-app-a3») hasta que el
  dueño usa `/rename`.

**Qué haría reconsiderarlo**

Que aparezca en un nombre automático algo que no debería persistirse (un dato
sensible dictado en la conversación y resumido en el título). Si pasa, la
salida es volver a «solo nombres manuales» borrando la columna — una migración
pequeña.
