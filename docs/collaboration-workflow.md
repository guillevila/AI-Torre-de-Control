# Trabajar entre varias personas sin pisarse

> Esta guía es para cualquiera que toque el repositorio: el dueño del proyecto,
> otro programador, o un agente de IA. Da igual quién seas — las reglas son las
> mismas para todos.

**La rama principal de este repositorio se llama `master`**, no `main`. Todos
los ejemplos usan el nombre real.

---

## La idea en una frase

Nadie escribe nunca en `master`. Cada uno trabaja en su rama, y `master` solo
cambia cuando una Pull Request pasa todas las comprobaciones.

Esto no es burocracia: es lo que impide que el trabajo de dos personas se
solape, que algo desaparezca sin que nadie se entere, o que el proyecto quede
roto un viernes por la tarde.

---

## 1. Empezar una tarea

Siempre desde `master` actualizado:

```bash
git fetch origin
git checkout master
git pull --ff-only
git checkout -b feature/lo-que-vas-a-hacer
```

**Nombres de rama**, por lo que hace la tarea:

| Prefijo | Para qué |
|---|---|
| `feature/` | Algo nuevo |
| `fix/` | Arreglar algo roto |
| `chore/` | Mantenimiento, configuración, herramientas |
| `docs/` | Solo documentación |
| `integration/` | **Lo crea el agente de integración. No lo crees a mano.** |

---

## 2. Mantenerla al día

Si la tarea dura más de un rato, otra persona habrá tocado `master` mientras
tanto. Traer sus cambios pronto y a menudo:

```bash
git fetch origin
git merge origin/master
```

> Hacerlo a menudo es la diferencia entre resolver tres conflictos pequeños o
> uno enorme al final, cuando ya no recuerdas por qué escribiste nada.

---

## 3. Commits pequeños

Un commit = una idea. Si al describirlo tienes que usar «y», probablemente sean
dos.

```bash
git add packages/domain/src/urls.ts
git commit -m "feat(dominio): reconocer conversaciones de Claude web"
```

Prefijos: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.

Antes de subir nada:

```bash
pnpm typecheck && pnpm test
pnpm test:e2e    # si tocaste la interfaz o el proceso principal
```

---

## 4. Subir la rama

```bash
git push -u origin feature/lo-que-vas-a-hacer
```

El CI se ejecuta solo. Si sale en rojo, arréglalo **antes** de pedir revisión:
no le hagas revisar a otra persona algo que ya sabes que está roto.

---

## 5. Abrir la Pull Request

Desde la web de GitHub, o:

```bash
gh pr create --base master --head feature/lo-que-vas-a-hacer
```

Se rellena sola con la plantilla. **Rellénala entera**, incluidos los apartados
que no aplican —ahí se escribe «nada»—. La diferencia entre «no hay» y «no lo he
mirado» es justo lo que importa al revisar.

---

## 6. Integrar el trabajo de otra persona

Aquí es donde se rompen los proyectos, así que hay un proceso.

**No fusiones a mano.** Pídeselo al agente:

```
Usa merge-guardian para integrar la rama <origen> en <destino>
```

El agente:

1. Compara las dos ramas **antes** de tocar nada.
2. Busca lo que Git no ve: funciones borradas, tipos cambiados, dos migraciones
   con el mismo número, rutas que ya no existen.
3. Prepara la fusión en una rama `integration/<origen>-into-<destino>`.
4. Ejecuta los controles de verdad del proyecto.
5. Revisa el diff completo buscando **qué ha desaparecido**.
6. Abre una Pull Request. **Nunca escribe en `master`.**
7. Te entrega un informe con lo que hizo y lo que quedó en duda.

Y si algo no está claro, **se para y pregunta**. Eso es lo que hace bien, no un
defecto.

---

## 7. Cuando hay conflictos

Un conflicto no es un problema: es Git avisando de que dos personas cambiaron lo
mismo y hace falta criterio humano.

**Se resuelven de uno en uno, leyendo.** Nunca en bloque.

```bash
# BIEN — este fichero concreto, sabiendo lo que haces
git checkout --ours packages/domain/src/selectors.ts

# MAL — todos de golpe, sin mirar ninguno
git checkout --ours .
```

Lo segundo está **bloqueado automáticamente**. Es la forma más rápida de borrar
el trabajo de otra persona sin enterarte.

Si los dos cambios son válidos pero incompatibles, **para y habla con la otra
persona**. Esa decisión no la toma una herramienta.

---

## 8. Prohibido

| Prohibido | Por qué |
|---|---|
| `git push origin master` | La rama principal solo cambia por Pull Request |
| `git push --force` / `-f` | Reescribe la historia. Si otro ya se la trajo, la pierde |
| `git reset --hard` | Tira cambios sin guardar, sin preguntar y sin vuelta atrás |
| `git checkout --ours .` | Resuelve todo a ciegas |
| Fusionar estando en `master` | Escribe en la principal saltándose la revisión |
| Borrar `master` | No |
| Desactivar tests para que pase el CI | Entonces no está listo |

Todo esto lo bloquea `.claude/hooks/guard-git.mjs` con un mensaje que explica la
alternativa. **Si algo se te bloquea, no busques cómo rodearlo**: es la señal de
que el camino era el equivocado.

---

## 9. Si una integración sale mal

Nada se ha perdido: la integración vive en su propia rama y `master` está
intacto.

```bash
# Salir de la integración y volver a lo tuyo
git merge --abort            # si el merge está a medias
git checkout master
git branch -D integration/la-que-fue-mal    # borrar la rama fallida
```

Si ya se había fusionado en `master` y hay que deshacerlo:

```bash
git checkout -b fix/revertir-integracion
git revert -m 1 <hash-del-commit-de-merge>
git push -u origin fix/revertir-integracion
# y abrir una Pull Request
```

`git revert` **añade** un commit que deshace; no borra historia. Por eso es
seguro y `reset --hard` no lo es.

---

## 10. Revisar una Pull Request de otra persona

Antes de aprobar, mira estas cosas **en este orden**:

1. **¿Qué desaparece?** `git diff master...la-rama | grep '^-'`. Es lo que menos
   se ve y lo que más duele.
2. **¿Toca `packages/contracts/`?** Un tipo cambiado rompe los dos lados a la vez.
3. **¿Hay migración de base de datos?** Comprobar que no reescribe una publicada
   y que el plan de reversión dice qué pasa con los datos ya guardados.
4. **¿Está el CI en verde?** Si no, no sigas revisando.
5. **¿La descripción se entiende** sin haber estado en esa sesión?
6. **¿Hay secretos, claves o datos reales?** Este repositorio es **público**.

Si algo no lo entiendes, pregunta. Aprobar sin entender es peor que no revisar:
reparte la responsabilidad sin repartir el conocimiento.

---

## Resumen de un vistazo

```bash
git fetch origin                                  # 1. al día
git checkout -b feature/mi-tarea                  # 2. tu rama
# … trabajar, commits pequeños …
pnpm typecheck && pnpm test                       # 3. comprobar
git push -u origin feature/mi-tarea               # 4. subir
gh pr create --base master                        # 5. Pull Request
```

Y para integrar lo de otra persona:

```
Usa merge-guardian para integrar la rama <origen> en master
```
