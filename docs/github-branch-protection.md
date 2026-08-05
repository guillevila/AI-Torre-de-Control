# Protección de la rama `master` en GitHub

> Estas reglas **ya están activas**. Se aplicaron el 5/8/2026 por la API de
> GitHub. Este documento explica qué hace cada una, cómo cambiarlas y cómo
> quitarlas si hiciera falta.

---

## Por qué existe esto

Los hooks de Claude bloquean comandos peligrosos **en este ordenador**. No
protegen de nada si tu compañero trabaja desde el suyo, ni de un despiste
haciendo clic en la web de GitHub.

Las protecciones de rama son la red que sí cubre a todos, porque viven en el
servidor. Las dos capas se complementan: los hooks avisan antes, GitHub impide
después.

---

## Qué está activo ahora mismo

| Regla | Estado | Qué significa |
|---|---|---|
| **Pull Request obligatoria** | ✅ | A `master` no se escribe directamente. Nunca |
| **Aprobación de otra persona** | ❌ **no** | **Decisión consciente. Lee el apartado siguiente** |
| **Checks de CI obligatorios** | ✅ | Los tres tienen que estar en verde |
| **Rama al día antes de fusionar** | ✅ | Hay que traerse `master` antes de fusionar |
| **Conversaciones resueltas** | ✅ | No se fusiona con comentarios de revisión abiertos |
| **Force push bloqueado** | ✅ | Nadie puede reescribir la historia de `master` |
| **Borrado bloqueado** | ✅ | `master` no se puede borrar |
| **Se aplica a administradores** | ✅ | **Sin excepciones. También al dueño del repositorio** |

Los tres checks obligatorios son los del workflow `.github/workflows/ci.yml`:

- `Documentación y estado del proyecto`
- `Tipos, tests unitarios y build`
- `Prueba de interfaz (Electron)`

---

## ⚠️ Por qué NO hace falta que apruebe otra persona

Es una decisión consciente, tomada el 5/8/2026 por las dos personas que trabajan
en el repositorio. Conviene entenderla, porque es la pieza que más responsabilidad
reparte.

**Lo que se quiso evitar:** que cualquiera de los dos se quede bloqueado
esperando al otro. Si Alonso está fuera y Guille necesita integrar, con
aprobación obligatoria no puede — GitHub no deja aprobar tu propia Pull Request.

**En qué se confía en su lugar:** en `merge-guardian`. El agente ejecuta los
controles reales del proyecto, revisa el diff completo buscando **qué ha
desaparecido**, y se detiene si algo no está claro. Eso es más de lo que suele
detectar una revisión humana con prisa.

**Lo que se pierde, dicho sin adornos:** *nadie más mira el código*. El guardián
comprueba que todo pasa, no si el cambio es buena idea. Un fallo de diseño, una
decisión discutible o un atajo feo pasan sin que nadie los vea.

**Lo que NO se pierde:**

- Todo sigue entrando por Pull Request → queda el rastro y corre el CI.
- Nada entra con el CI en rojo.
- Nadie puede reescribir ni borrar `master`.
- Y las reglas se aplican **a todos**, dueño incluido.

### Cómo volver a exigir aprobación

Si algún día crece el equipo, o simplemente cambiáis de opinión:

```bash
gh api -X PATCH repos/guillevila/AI-Torre-de-Control/branches/master/protection/required_pull_request_reviews \
  -f required_approving_review_count=1 -F dismiss_stale_reviews=true
```

O desde **Settings → Branches → Edit** en la regla de `master`, marcando
**Require a pull request before merging → Require approvals**.

### Si entra una tercera persona

Basta con darle acceso de escritura. Las reglas ya se le aplican solas. Y ese
sería buen momento para replantearse lo de la aprobación: la confianza mutua
entre dos escala peor de lo que parece.

### Quiénes tienen acceso hoy

| Persona | Permiso |
|---|---|
| `guillevila` | administrador |
| `alonsollorente` | escritura |

---

## Cómo mirar el estado real desde la terminal

```bash
gh api repos/guillevila/AI-Torre-de-Control/branches/master/protection
```

O en la web: **Settings → Branches → Branch protection rules**.

---

## Cómo quitarlo si estorba

Con calma, y sabiendo lo que se pierde:

```bash
gh api -X DELETE repos/guillevila/AI-Torre-de-Control/branches/master/protection
```

O desde la web: **Settings → Branches → Delete** en la regla de `master`.

> Quitarlo deja `master` abierta a cualquiera con permiso de escritura, sin
> revisión ni CI. Si lo haces para desatascar algo puntual, **vuelve a ponerlo
> después** — se olvida con una facilidad asombrosa.

---

## Volver a aplicarlas desde cero

Si alguna vez se pierden, el contenido exacto está aquí. Guarda esto como
`proteccion.json`:

```json
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Documentación y estado del proyecto",
      "Tipos, tests unitarios y build",
      "Prueba de interfaz (Electron)"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_last_push_approval": false,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "required_conversation_resolution": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_linear_history": false,
  "block_creations": false
}
```

Y aplícalo:

```bash
gh api -X PUT repos/guillevila/AI-Torre-de-Control/branches/master/protection --input proteccion.json
```

> Los nombres de los checks tienen que coincidir **letra por letra** con los
> `name:` de los jobs en `.github/workflows/ci.yml`, tildes incluidas. Si
> cambias el nombre de un job, esta lista deja de encontrarlo y el check deja de
> ser obligatorio **sin avisar de nada**.

---

## Lo que esto NO protege

Conviene tenerlo claro para no confiarse:

- **No revisa el contenido.** Que el CI esté verde significa que compila y los
  tests pasan, no que el cambio sea buena idea.
- **No impide aprobar sin leer.** Eso es criterio humano.
- **No cubre otras ramas.** Solo `master`.
- **No sustituye a `merge-guardian`.** GitHub comprueba que el resultado
  funciona; el agente comprueba que no ha **desaparecido** nada por el camino,
  que es lo que Git no ve.
