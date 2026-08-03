# ADR-004 — Monorepo con dominio aislado, preparado para adaptadores futuros

**Fecha:** 2026-08-03
**Estado:** Aceptada
**Relacionada con:** decisiones D14, D16 de [SYSTEM_VISION.md](../../SYSTEM_VISION.md)

## Contexto

El roadmap contempla piezas que compartirán conceptos pero se ejecutan en sitios
muy distintos:

- la aplicación de escritorio (hoy);
- una extensión de navegador (Manifest V3, corre dentro de Chrome);
- adaptadores para Claude Code, Codex y otras herramientas.

Las tres necesitan hablar el mismo idioma: qué es una tarea, qué estados existen,
qué forma tiene un evento. Si cada una define lo suyo, la primera vez que cambie
algo se desincronizarán en silencio.

Al mismo tiempo, el proyecto lo lleva una persona: no puede permitirse la
ceremonia de un monorepo industrial.

## Decisión

**Un monorepo con pnpm workspaces y exactamente tres paquetes.**

```
packages/contracts   Tipos y esquemas de validación. Sin lógica.
packages/domain      Reglas puras. Depende solo de contracts.
apps/desktop         Electron. Depende de los dos anteriores.
```

La regla que lo ordena todo:

> `domain` y `contracts` **no importan nada de Electron, de React ni de la base
> de datos**. Son TypeScript puro y se ejecutan en cualquier sitio.

Los paquetes internos se publican como **código fuente TypeScript**, sin paso de
compilación propio: quien los consume (Vite, Vitest) los compila. Un paso menos
que mantener.

### Los puntos de extensión que esto deja preparados

- **Extensión de navegador**: podrá importar `@torre/contracts` y
  `@torre/domain` tal cual. Un `manifest.json` no puede cargar Electron, pero sí
  TypeScript puro.
- **Adaptadores**: el contrato de eventos ya contempla `claude_hook`,
  `browser_extension` y `process_monitor` como fuentes. Falta quien los emita,
  no dónde encajarlos.
- **Persistencia**: `TaskRepository` es una interfaz. Ya sirvió para cambiar de
  motor de base de datos sin tocar el dominio.

Ninguno de estos puntos tiene código simulado ni botones que aparenten estar
conectados. Son sitios donde encajará algo, no promesas fingidas.

## Alternativas consideradas

- **Un único paquete con todo dentro** — descartada: la extensión de navegador
  tendría que copiar los tipos y las reglas, y se desincronizarían. Además el
  dominio quedaría mezclado con Electron y no se podría testear rápido.
- **Repositorios separados** — descartada: mantener sincronizadas las versiones
  de tres repositorios es trabajo puro para una sola persona.
- **Turborepo o Nx** — descartada por ahora: resuelven caché y orquestación de
  builds en monorepos grandes. Con tres paquetes y un build de dos segundos, el
  problema no existe. Se reconsiderará si el build llega a molestar de verdad.
- **Un cuarto paquete `ui` con los componentes** — descartada: hoy solo hay una
  aplicación que los use. Se separará cuando haya una segunda.

## Consecuencias

**A favor**

- Los tests del dominio corren en milisegundos, sin abrir ninguna ventana.
- La frontera es explícita: si alguien intenta importar Electron desde el
  dominio, se ve en la revisión.
- Añadir la extensión de navegador será añadir `apps/extension` y reutilizar los
  dos paquetes existentes.

**En contra**

- Tres `package.json` y tres `tsconfig.json` en lugar de uno.
- Publicar código sin compilar obliga a que el consumidor sepa compilar
  TypeScript. Es cierto para Vite y Vitest, pero sería un problema si algún día
  se publicaran estos paquetes a npm. No está previsto.
- La disciplina de «el dominio no toca la plataforma» hay que sostenerla. No hay
  nada automático que lo impida hoy.

**Revisión**

Se añadirá un paquete nuevo solo cuando exista un segundo consumidor real, nunca
por anticipación.
