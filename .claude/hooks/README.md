# Hooks — Automatismos y protecciones

> **En lenguaje normal:** los hooks son pequeños programas que se ejecutan solos
> en momentos concretos, como alarmas que saltan sin que nadie las llame.
> Tú no tienes que hacer nada para que funcionen.

---

## Los hooks de este proyecto

| Cuándo se dispara | Qué hace |
|---|---|
| **Al abrir sesión** | Le da a Claude el estado real: rama, últimos commits, cambios sin guardar, lecciones aprendidas y la etapa del proyecto. Avisa si el modo ininterrumpido quedó encendido |
| **Antes de cada herramienta** | 🛡️ **Bloquea** operaciones destructivas y el acceso a ficheros con credenciales |
| **Antes de que Claude pregunte** | ⏩ Si el modo ininterrumpido está encendido, Claude decide la duda y sigue en vez de pararte |
| **Después de escribir** | Deja rastro de qué ficheros se tocaron |
| **Al lanzar un subagente** | Anota qué agente se usó y para qué |
| **Al cerrar sesión** | Recuerda registrar lecciones y no dejar trabajo sin commitear |

El registro de auditoría se guarda en `.claude/audit/`, **fuera del repositorio**.

---

## La protección más importante

`pre-tool-use.mjs` es la red de seguridad. Bloquea:

- Borrados irreversibles (borrar la raíz del disco, borrar tablas, formatear).
- Reescrituras de historial (`git push --force`, `git reset --hard HEAD~`).
- Cualquier lectura o edición de `.env`, claves `.pem`, `.key`, `.p12` o
  carpetas `secrets/`.

`.env.example` está **expresamente permitido**: es la plantilla sin valores
reales y forma parte del repositorio.

---

## El modo ininterrumpido

> **En lenguaje normal:** un interruptor que decide **quién responde** cuando
> Claude tiene una duda. Encendido, responde Claude y sigue trabajando. Apagado,
> respondes tú. No cambia lo que Claude tiene *permitido* hacer.

```
/ininterrumpido on     → lo enciendes antes de irte
/ininterrumpido off    → lo apagas al volver
/ininterrumpido        → te dice en qué estado está
```

**El interruptor es un fichero:** `.claude/modo-ininterrumpido.on`. Existe =
encendido. No existe = apagado. Está en `.gitignore`, así que es personal: nadie
lo hereda al clonar el repositorio, y para el resto del equipo el hook nunca hace
nada.

**Qué pasa exactamente cuando está encendido.** Claude va a preguntarte algo →
`modo-ininterrumpido.mjs` intercepta la pregunta y se la devuelve con la
instrucción de elegir la opción recomendada (o la más conservadora), anotar la
decisión con el prefijo `[decisión automática]` y continuar.

**Dos cosas que este modo NO hace:**

1. **No amplía permisos.** Los bloqueos de `pre-tool-use.mjs` siguen actuando
   igual: borrados irreversibles y ficheros con credenciales siguen bloqueados.
2. **No decide lo irreversible.** El propio texto que recibe Claude le ordena
   pararse si la decisión implicaría borrar datos reales, tocar producción o algo
   que no se pueda deshacer. En ese caso termina el resto y explica qué dejó sin
   hacer.

**Trazabilidad.** Toda pregunta auto-resuelta se anota con fecha y hora en
`.claude/audit/decisiones-automaticas.log`. Si una IA decide por ti, tienes que
poder revisar después qué decidió. Al abrir sesión, `session-start.mjs` avisa si
el modo quedó encendido de una sesión anterior.

---

## Por qué están escritos en Node

Los hooks originales de la plantilla estaban en Bash y Python. En el ordenador
donde se desarrolla este proyecto **ninguno de los dos estaba disponible**, así
que los cinco fallaban en silencio: parecía haber protección y no la había.

Node sí está garantizado, porque la aplicación no arranca sin él. Además se
invocan en **forma directa** (`"command": "node", "args": [...]`), sin pasar por
ningún intérprete de comandos, así que funcionan igual en Windows, macOS y Linux.

También se corrigió el código de salida: para **bloquear** una herramienta hay
que salir con **2**. Los hooks antiguos salían con 1, que Claude Code trata como
un error no bloqueante — es decir, aunque hubieran podido ejecutarse, no habrían
bloqueado nada.

---

## Comprobar que siguen funcionando

Cada hook recibe un JSON por la entrada estándar. Se pueden probar a mano.
En PowerShell:

```powershell
# Debe devolver 2 (bloqueado)
'{"tool_name":"Read","tool_input":{"file_path":".env"}}' | node .claude/hooks/pre-tool-use.mjs
$LASTEXITCODE

# Debe devolver 0 (permitido)
'{"tool_name":"Bash","tool_input":{"command":"pnpm test"}}' | node .claude/hooks/pre-tool-use.mjs
$LASTEXITCODE
```

---

## Ficheros

| Fichero | Evento |
|---|---|
| `session-start.mjs` | SessionStart |
| `pre-tool-use.mjs` | PreToolUse (todas) — el que protege |
| `modo-ininterrumpido.mjs` | PreToolUse (solo `AskUserQuestion`) — el que no te interrumpe |
| `post-tool-use.mjs` | PostToolUse (solo escrituras) |
| `stop.mjs` | Stop |
| `log-subagent-spawn.mjs` | SubagentStart |
| `_input.mjs` | Utilidad compartida para leer la entrada |

Ojo a un detalle que no es obvio: `pre-tool-use.mjs` **bloquea** saliendo con
código **2**, pero `modo-ininterrumpido.mjs` sale siempre con **0** y comunica su
decisión por el JSON de salida (`permissionDecision: "deny"`). Salir con 2 ahí
abortaría el turno en vez de reconducirlo — que es justo lo contrario de lo que
busca el modo.

Se activan desde [`.claude/settings.json`](../settings.json). Si tocas ese
fichero y el JSON queda mal formado, **se desactivan todos los ajustes en
silencio** — comprueba siempre que sigue siendo JSON válido.
