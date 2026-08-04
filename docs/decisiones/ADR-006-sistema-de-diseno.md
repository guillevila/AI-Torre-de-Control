# ADR-006 — Sistema de diseño «Oficina de papel»

**Fecha:** 2026-08-03
**Estado:** Aceptada
**Relacionada con:** decisiones D10, D11, D16 y D19 de [SYSTEM_VISION.md](../../SYSTEM_VISION.md)

## Contexto

Tras el Sprint 001 la aplicación funcionaba pero su aspecto era una decisión
tomada sobre la marcha: tema oscuro genérico, tipografía del sistema y dos
vistas sin más navegación que un conmutador.

El dueño del proyecto encargó un documento de diseño completo (estrategia,
arquitectura de información, flujos, wireframes, dos direcciones visuales,
prototipo de alta fidelidad, sistema de diseño y handoff) y decidió adoptarlo
**íntegro**, no solo su paleta.

El documento partía de `SYSTEM_VISION.md` y no reinterpretaba ninguna decisión
cerrada, de modo que adoptarlo no obligó a reabrir nada.

## Decisión

Adoptar el sistema de diseño **«Oficina de papel»** completo: paleta, tipografía,
escala, arquitectura de información de cinco destinos, planta de oficina por
zonas y todos sus componentes.

**Lo que cambia respecto al Sprint 001:**

| | Antes | Ahora |
|---|---|---|
| Fondo | Oscuro genérico | Papel cálido, modo claro |
| Tipografía | Fuente del sistema | Instrument Serif + Instrument Sans + JetBrains Mono, **empaquetadas** |
| Navegación | 2 vistas y filtros | 5 destinos con barra lateral |
| Oficina | Rejilla de puestos | Planta por zonas; la posición **es** el estado |
| Ficha | Ventana modal | Panel lateral de 480 px con historial de estados |
| Alta | Formulario completo | Alta rápida con `⌘N` y plataforma autodetectada |

**Principios que se hacen cumplir en el código, no solo en el papel:**

1. **La posición es el estado.** Quien te espera está en tu puerta; quien
   terminó, junto a la mesa de entregas; los errores, lo más lejos. No hay
   leyenda que memorizar.
2. **Honestidad antes que continuidad.** Un estado sin confirmar se dibuja
   roto: contorno discontinuo y animación **detenida**. Preferimos un hueco
   visible a una animación que miente.
3. **Cuatro veces redundante.** Cada estado se codifica en color, glifo
   geométrico, texto y comportamiento. Quitando el color, la pantalla sigue
   siendo legible al 100 %.
4. **Una sola acción primaria.** En toda fila, ficha y trabajador el único
   botón sólido es «Abrir conversación». Es D4 convertida en jerarquía visual.
5. **Solo se mueve lo que cambia de estado.** Nada de deambular decorativo: si
   alguien camina, algo ha pasado de verdad. Y la información nunca viaja con
   la animación — contadores y listas se actualizan en el instante cero.

## Alternativas consideradas

- **Dirección visual B, «Tablero de instrumentos»** (gris frío, alta densidad,
  tabla dominante). Venía propuesta en el mismo documento y quedó descartada
  allí por un motivo que se comparte: iguala visualmente lo urgente y lo
  rutinario. Cuando todo es una fila de tabla, nada destaca. De ella sí se toma
  la disciplina: mono para metadatos, fila compacta de 44 px y ni un gráfico
  decorativo.
- **Adoptar solo la paleta** y dejar la navegación como estaba. Descartada por
  decisión explícita del dueño del proyecto.
- **Cargar las tipografías desde Google Fonts.** Descartada: la aplicación es
  local-first (D1) y su política de contenidos en producción bloquea cualquier
  petición externa. Además delataría a un servidor de terceros cada vez que se
  abre la aplicación. Se empaquetan dentro: 190 KB para las tres familias, solo
  subconjuntos latin y latin-ext, bajo licencia SIL OFL.

## Lo que se apartó del diseño, y por qué

El diseño contemplaba tres cosas que **no** se han construido, porque tocaban el
modelo de datos y quedaron como decisiones abiertas del dueño:

- **Campo «rol»** (O7). En la oficina, el color del trabajador iba a ser su rol.
  Se usa la **plataforma** en su lugar: es el dato que sí existe y cumple la
  misma función de distinguir de un vistazo quién trabaja en qué.
- **Estado «revisada»** (O8). Una tarea terminada pasa directamente a archivada.
- **Interruptores sin conectar.** El diseño mostraba ajustes de sonido, contador
  en el icono, tamaño de texto, ventana interna y caducidad del historial.
  Ninguno está construido, así que **ninguno se dibuja**. La pantalla de Ajustes
  solo contiene controles que hacen algo de verdad.

Esa última es una desviación deliberada del diseño y la más importante: un
interruptor que no está conectado a nada es exactamente el tipo de falsa
sensación de avance que este proyecto existe para evitar.

## Consecuencias

**A favor**

- El producto tiene por fin una identidad propia y coherente, no un tema por
  defecto.
- La arquitectura de cinco destinos hace visible lo que antes había que buscar:
  el Centro de atención es ahora un sitio, no un filtro.
- El historial de estados (D19) da la prueba de honestidad que faltaba.
- Las formas son planas y de un solo peso de línea: migrar la oficina a un motor
  gráfico más adelante no obliga a rediseñar nada, porque cada trabajador es
  solo `{id, plataforma, estado, x, y}`.

**En contra**

- El paquete de la interfaz crece a ~740 KB de código más 190 KB de tipografías.
  Aceptable en escritorio, donde no hay descarga por visita.
- Más superficie de interfaz que mantener: seis vistas en lugar de dos.
- La planta de oficina usa posiciones en porcentaje sobre un plano inclinado.
  Con muchas tareas se llena; por eso hay un tope de 12 puestos visibles por
  zona y un aviso explícito de cuántas quedan fuera.

**Revisión**

El sistema de diseño se revisará cuando el dueño lleve unos días usando la
aplicación a diario, que es la única prueba real del criterio de los diez
segundos. Las decisiones O7 y O8 se resolverán entonces, con uso real detrás.
