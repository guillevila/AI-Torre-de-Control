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
| **1 aprobación** | ✅ | Alguien tiene que revisar antes de fusionar |
| **Descartar aprobaciones antiguas** | ✅ | Si subes cambios nuevos, la aprobación anterior deja de valer |
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

## ⚠️ Lo que esto significa en el día a día

**GitHub no te deja aprobar tu propia Pull Request.** Y como las reglas se
aplican a todos sin excepción, incluido el dueño del repositorio:

> **Nadie puede fusionar su propio trabajo. Siempre lo aprueba el otro.**

Quiénes tienen acceso hoy:

| Persona | Permiso | Puede aprobar PRs |
|---|---|---|
| `guillevila` | administrador | Sí |
| `alonsollorente` | escritura | Sí |

En la práctica: tú abres una PR y la aprueba Alonso; él abre una y la apruebas
tú. Es exactamente el punto de todo esto — que nada entre en `master` sin que
una segunda persona lo haya mirado.

### Si el otro no está disponible y hay una urgencia

No hay atajo silencioso, y es a propósito. Si de verdad hace falta:

1. **Settings → Branches → Edit** en la regla de `master`
2. Desmarca **Do not allow bypassing the above settings**
3. Fusiona
4. **Vuelve a marcarlo inmediatamente**

O por terminal:

```bash
# quitar la restricción a administradores
gh api -X DELETE repos/guillevila/AI-Torre-de-Control/branches/master/protection/enforce_admins
# … fusionar …
# volverla a poner. NO se te olvide.
gh api -X POST repos/guillevila/AI-Torre-de-Control/branches/master/protection/enforce_admins
```

> Queda registrado en el historial del repositorio quién lo desactivó y cuándo.
> Eso no es vigilancia: es que un atajo que no deja rastro se convierte en
> costumbre, y uno que sí lo deja se usa solo cuando toca.

### Si entra una tercera persona

Basta con darle acceso de escritura. Las reglas ya se le aplican solas.

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
