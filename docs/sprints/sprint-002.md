# Sprint 002 — El diseño, construido

**Fecha:** 3 de agosto de 2026
**Rama:** `feat/bootstrap-control-tower`
**Fase del proyecto:** Fase 1 — Vertical local
**Estado al terminar:** 🛠️ Prototipo funcional (sin cambio de etapa)

---

## Objetivo

Adoptar íntegro el documento de diseño encargado a Claude Designer, **copiándolo
al detalle pero haciéndolo funcional**: nada de pantallas maquetadas ni de
controles que aparenten estar conectados.

Del modelo de datos, el dueño aprobó **solo** el historial de estados. El campo
«rol» y el estado «revisada» quedaron como decisiones abiertas.

---

## Qué se ha construido

### Identidad visual

- Paleta **«Oficina de papel»** completa, con los nombres de token del documento
  de diseño para poder leer diseño y código en paralelo.
- Tres tipografías **empaquetadas dentro de la aplicación** (190 KB, solo
  subconjuntos latin): Instrument Serif para cifras y títulos, Instrument Sans
  para el trabajo, JetBrains Mono para tiempos e identificadores. No se pide
  nada a internet, ni siquiera una fuente.
- Glifo geométrico propio por estado: `◌ ◔ ◉ ▲ ✓ ✕ ? ▣`. El color nunca va solo.

### Arquitectura de información

Cinco destinos en lugar de dos vistas:

| Destino | Qué responde |
|---|---|
| **Torre de control** | ¿Qué está pasando ahora mismo? |
| **Centro de atención** | ¿Qué espera una decisión mía? |
| **Tareas** | ¿Qué hay delegado, agrupado por urgencia? |
| **Historial** | ¿Qué hice y cuánto tardó? |
| **Ajustes** | Avisos, datos y privacidad |

El conmutador **Operativa ⇄ Oficina** es transversal y conserva la selección
entre secciones. La ficha y el alta rápida son **capas**, no destinos:
profundidad máxima 2, nunca pierdes dónde estabas.

### La oficina, por zonas

La posición **es** el estado, sin leyenda que memorizar:

- **Tu despacho**, arriba a la derecha y fijo. Quien te espera está en tu puerta,
  con la mano levantada.
- **Mesa de entregas**, pegada al despacho, con el contador de lo no revisado.
- **Zona de trabajo**: quien trabaja, con las barras latiendo.
- **Incidencias**, abajo a la izquierda, lo más lejos de tu puerta.
- **Recepción**: cola y borradores, atenuados.

Quien pierde el contacto se queda en su puesto con **la animación detenida** y
contorno discontinuo. La quietud es información (D9).

### Historial de estados (D19)

Migración v2 de la base de datos con una tabla nueva. Cada cambio deja una línea
con de dónde vino, adónde fue, quién lo dijo y cuándo. Se ve en el centro de la
ficha y alimenta el panel de actividad reciente de la Torre.

Las tareas anteriores a la migración no tienen historial retroactivo, y eso es
correcto: inventarlo sería lo contrario de lo que esta tabla existe para
garantizar.

### Funcionalidad nueva de verdad

- **Alta rápida con `⌘N`** desde cualquier sitio, con la plataforma deducida del
  dominio del enlace.
- **Ajustes que funcionan**: silenciar cada tipo de aviso, elegir la sección y la
  vista de arranque, y fijar cuándo una tarea automática pasa a «sin confirmar».
- **Barrido automático a «sin confirmar»**: lo automático que lleva demasiado
  tiempo callado deja de fingir que sigue vivo. **Nunca toca lo que fijaste tú a
  mano.**
- **Exportar a CSV**, que cierra el riesgo abierto más incómodo: hasta hoy no
  había forma de sacar los datos. Neutraliza fórmulas para que abrir el fichero
  en Excel no ejecute nada.
- **Abrir la carpeta de datos** desde Ajustes.
- **Eliminar una tarea**, con confirmación en dos pasos.

---

## Lo que se apartó del diseño, y por qué

| Del diseño | Qué se hizo | Motivo |
|---|---|---|
| Color del trabajador = **rol** | Color = **plataforma** | El campo «rol» quedó como decisión abierta O7 |
| Estado **«revisada»** | Terminada → archivada directamente | Decisión abierta O8 |
| Ajustes de sonido, contador en el icono, tamaño de texto, ventana interna | **No se dibujan** | No están construidos. Un interruptor sin conectar es la falsa sensación de avance que este proyecto evita |
| «Retención: 90 días · configurable» | Se dice que **nada se borra solo** | No hay caducidad implementada |
| Integraciones «Hook instalado» | Todas dicen **«Próximamente»** | Es la verdad |

---

## Verificación

| Qué | Cómo |
|---|---|
| Tipos | `pnpm typecheck` — TypeScript estricto, sin errores |
| Lógica | **147 tests unitarios** (eran 105) |
| Interfaz | **3 pruebas** que arrancan la aplicación real (eran 2) |
| Build | `pnpm build` correcto, tipografías incluidas |
| Aspecto | **Capturas de las 8 pantallas**, revisadas una a una contra el diseño |

Tests nuevos de este sprint: historial de estados (6), barrido a sin confirmar
(5), ajustes que gobiernan los avisos (3), exportación a CSV (7), detección de
plataforma por URL (6), y el historial en disco con migración desde la v1 (6).

La prueba de interfaz ahora cubre además: la plataforma detectándose sola al
pegar el enlace, el historial creciendo en la ficha, el trabajador levantando la
mano en la oficina, y los ajustes silenciando un aviso de verdad.

---

## Números

| | Sprint 001 | Sprint 002 |
|---|---|---|
| Tests unitarios | 105 | **147** |
| Pruebas de interfaz | 2 | **3** |
| Vistas | 2 | **6** |
| ADRs | 5 | **6** |
| Tablas en la base de datos | 1 | **2** |
| Dependencias de producción | 4 | **4** |

Ninguna dependencia nueva: todo el rediseño se hizo con React, CSS y SVG, tal y
como exige D11.

---

## Siguiente paso

Sin cambios respecto al Sprint 001: hace falta que el dueño **use la aplicación
unos días** y responda las decisiones abiertas **O3** (primera integración real)
y **O1** (sistema operativo para empaquetar). A ellas se suman ahora **O7**
(campo rol) y **O8** (estado revisada), que solo se pueden decidir bien con uso
real detrás.
