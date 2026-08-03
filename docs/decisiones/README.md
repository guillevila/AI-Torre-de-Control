# Decisiones — Architecture Decision Records (ADRs)

> Aquí se documentan las decisiones técnicas importantes del proyecto.
> Para decisiones de negocio, ver `SYSTEM_VISION.md`.

---

## ¿Qué es un ADR?

Un ADR es un documento corto que explica una decisión técnica:
- **Qué** se decidió
- **Por qué** (el contexto y la razón)
- **Qué alternativas** se consideraron
- **Cuáles son las consecuencias**

---

## ¿Para qué sirve?

Dentro de 6 meses, nadie recordará por qué se eligió X sobre Y.
Los ADRs evitan que se reabran debates que ya se tuvieron, y ayudan
a los nuevos miembros del equipo a entender el proyecto.

---

## Cómo crear un ADR

Dile a Claude: *"Crea un ADR para la decisión de [nombre]"*
Claude creará el archivo con el formato correcto.

## Formato estándar

```markdown
# ADR-001 — [Título de la decisión]

**Fecha:** YYYY-MM-DD
**Estado:** Aceptada / En revisión / Deprecada

## Contexto
[Por qué había que tomar esta decisión]

## Decisión
[Qué se decidió]

## Alternativas consideradas
- [Opción A] — descartada porque [razón]
- [Opción B] — descartada porque [razón]

## Consecuencias
[Qué implica esta decisión a futuro — bueno y malo]
```

---

## ADRs de este proyecto

| ADR | Decisión | Estado | Fecha |
|-----|----------|--------|-------|
| [001](ADR-001-electron.md) | Electron como base de la aplicación de escritorio | ✅ Aceptada | 2026-08-03 |
| [002](ADR-002-local-first.md) | Arquitectura local-first con SQLite en fichero | ✅ Aceptada | 2026-08-03 |
| [003](ADR-003-modelo-de-estados.md) | Modelo normalizado de estados con fuente y confianza | ✅ Aceptada | 2026-08-03 |
| [004](ADR-004-monorepo.md) | Monorepo con dominio aislado y adaptadores futuros | ✅ Aceptada | 2026-08-03 |
| [005](ADR-005-clave-receptor-local.md) | Clave local además de escuchar solo en 127.0.0.1 | ✅ Aceptada | 2026-08-03 |
