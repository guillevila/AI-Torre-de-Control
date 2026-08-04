---
name: ininterrumpido
description: Enciende o apaga el modo ininterrumpido. Con el modo encendido, Claude decide solo las preguntas rutinarias y sigue trabajando sin parar a consultarte. Uso: /ininterrumpido on | off | (vacío para ver el estado).
---

# Comando: /ininterrumpido

> **En lenguaje normal:** este interruptor decide quién responde cuando Claude
> tiene una duda. Encendido, responde Claude y sigue. Apagado, respondes tú.

El argumento recibido es: `$ARGUMENTS`

## Qué hacer según el argumento

| Argumento | Acción |
|---|---|
| `on` | Crear el fichero `.claude/modo-ininterrumpido.on` con el texto `on` |
| `off` | Borrar el fichero `.claude/modo-ininterrumpido.on` si existe |
| vacío o cualquier otra cosa | **No cambiar nada** — solo informar del estado actual |

El fichero es el interruptor real: el hook `.claude/hooks/modo-ininterrumpido.mjs`
mira si existe cada vez que Claude va a preguntar algo.

## Qué responder

Después de actuar, comprueba si el fichero existe y di **exactamente** en qué
estado ha quedado, sin jerga:

- **Encendido:** «⏩ Modo ininterrumpido **encendido**. A partir de ahora decido yo
  las dudas rutinarias y sigo trabajando sin pararte. Cada decisión queda anotada
  en `.claude/audit/decisiones-automaticas.log` para que puedas revisarla. Me
  seguiré parando si algo fuera irreversible: borrar datos reales, tocar
  producción o cualquier cosa que no se pueda deshacer.»
- **Apagado:** «⏸️ Modo ininterrumpido **apagado**. Vuelvo a consultarte las dudas.»
- **Consulta de estado:** decir en qué estado está y cómo cambiarlo
  (`/ininterrumpido on` o `/ininterrumpido off`).

## Reglas

- Este modo **no** amplía lo que Claude tiene permitido hacer. Solo cambia quién
  responde a las preguntas. Los bloqueos de seguridad de
  `.claude/hooks/pre-tool-use.mjs` siguen actuando exactamente igual.
- El interruptor es personal: está en `.gitignore` y no se comparte al subir el
  repositorio. Nadie más lo hereda.
- Si el modo lleva encendido y el dueño del proyecto vuelve a escribir, **no lo
  apagues por tu cuenta** — solo se apaga con `/ininterrumpido off`.
- Al terminar un turno con el modo encendido, resume al final las decisiones que
  tomaste tú, con el prefijo `[decisión automática]`.
