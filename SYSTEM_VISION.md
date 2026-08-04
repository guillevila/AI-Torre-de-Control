# SYSTEM_VISION.md — Visión de AI Torre de Control

> Este documento es la fuente de verdad sobre qué producto estamos construyendo, para quién y bajo qué límites.
>
> Las decisiones cerradas no deben reabrirse sin información nueva y aprobación explícita del dueño del proyecto.

---

## 1. ¿Qué es este proyecto?

AI Torre de Control es una aplicación de escritorio local para supervisar las tareas que el usuario deja ejecutándose en diferentes herramientas de inteligencia artificial.

El sistema no pretende sustituir a Claude, ChatGPT, Codex ni otras plataformas. Su función es mostrar en un único lugar qué tareas están trabajando, cuáles necesitan intervención, cuáles han terminado y dónde se encuentra su conversación o resultado original.

La metáfora visual del producto es una oficina en la que diferentes trabajadores realizan encargos y se acercan al despacho del CEO cuando necesitan algo o han terminado.

---

## 2. ¿Para quién es?

### Usuario principal

* **Propietario o CEO de una empresa pequeña gestionada de forma muy autónoma** — delega simultáneamente tareas administrativas, de investigación, diseño, programación, contabilidad y gestión en diferentes herramientas de IA.

### Usuarios futuros

* **Pequeños equipos que utilizan múltiples agentes de IA** — podrían compartir posteriormente una torre de control, aunque el MVP será estrictamente para un único usuario.

---

## 3. ¿Cuál es el objetivo central?

Evitar que el usuario olvide tareas que ha dejado ejecutándose en herramientas de IA y permitirle conocer, de un vistazo, cuáles siguen trabajando, cuáles requieren atención y cuáles han terminado.

El usuario debe poder volver al resultado original con un solo clic.

---

## 4. Stack técnico elegido para el MVP

* **Aplicación de escritorio:** Electron.
* **Frontend:** React con TypeScript estricto.
* **Proceso local y lógica de sistema:** Node.js con TypeScript dentro de Electron.
* **Base de datos:** SQLite local.
* **Comunicación en tiempo real:** eventos internos y WebSocket o mecanismo local equivalente.
* **Extensión de navegador futura:** TypeScript y Manifest V3.
* **Gestión de paquetes:** pnpm.
* **Organización:** monorepo sencillo mediante pnpm workspaces.
* **Tests:** Vitest y pruebas mínimas de interfaz con Playwright o alternativa equivalente.
* **Hosting:** ninguno para el MVP. El producto funciona localmente.
* **Servicios de modelos de IA:** ninguno. No se consumirán APIs de modelos.

El stack puede revisarse después del MVP únicamente si aparecen problemas demostrables de rendimiento, distribución, seguridad o mantenimiento.

---

## 5. Decisiones cerradas ✅

| ID  | Decisión                                                                                                                          | Razón                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| D1  | El producto será local-first                                                                                                      | Reduce costes, evita infraestructura innecesaria y protege la privacidad                                     |
| D2  | No se utilizarán APIs de modelos de OpenAI, Anthropic ni otros proveedores                                                        | El usuario quiere aprovechar sus suscripciones actuales y evitar costes variables de API                     |
| D3  | AI Torre de Control no necesita recuperar ni mostrar el output de los agentes                                                     | El resultado seguirá viviendo en la plataforma original                                                      |
| D4  | Cada tarea tendrá un enlace o referencia para abrir su conversación o herramienta original                                        | El usuario debe acceder al resultado con un clic                                                             |
| D5  | No se almacenarán prompts, respuestas ni contenido de conversaciones                                                              | El producto solo necesita metadatos operativos y estados                                                     |
| D6  | Siempre existirá actualización manual de estado                                                                                   | Las integraciones automáticas pueden fallar cuando cambian las interfaces externas                           |
| D7  | Los estados de todos los proveedores se traducirán a un modelo común                                                              | La interfaz no debe depender de los nombres internos de cada plataforma                                      |
| D8  | Cada estado tendrá una fuente y un nivel de confianza                                                                             | El sistema debe distinguir un evento oficial de una estimación basada en la interfaz                         |
| D9  | La aplicación nunca afirmará que una tarea sigue trabajando si ha perdido el contacto                                             | En ese caso utilizará el estado `unknown`                                                                    |
| D10 | La vista operativa será la fuente funcional de verdad                                                                             | La oficina visual será una representación de los mismos datos, no un sistema independiente                   |
| D11 | La oficina visual avanzada se construirá después de validar el control de tareas                                                  | El valor principal está en no perder trabajos, no en las animaciones                                         |
| D12 | El MVP será para un solo usuario y un solo ordenador                                                                              | Evita autenticación, sincronización y complejidad prematura                                                  |
| D13 | La aplicación no modificará configuraciones globales de Claude, Codex o el navegador sin confirmación explícita                   | Protege el entorno de trabajo del usuario                                                                    |
| D14 | Las primeras integraciones se apoyarán en eventos locales, hooks, procesos y extensiones, no en automatización visual de pantalla | Son mecanismos más seguros y mantenibles                                                                     |
| D15 | El repositorio puede ser público, pero nunca contendrá secretos, tokens, credenciales ni datos reales                             | Es una exigencia de seguridad                                                                                |
| D16 | Electron, React, TypeScript y SQLite serán el stack del MVP                                                                       | Permiten construir la aplicación, la lógica local y futuras extensiones principalmente con un mismo lenguaje |
| D17 | La aplicación escuchará eventos exclusivamente en localhost                                                                       | No debe exponer el monitor a la red local ni a internet                                                      |
| D18 | ~~Ninguna integración debe enviar mensajes, aceptar permisos ni ejecutar acciones sensibles en nombre del usuario durante el MVP~~ **REVISADA el 4/8/2026 → ver D18-bis** | La primera versión solo observa y registra estados |
| D18-bis | Ninguna integración enviará mensajes ni ejecutará acciones por su cuenta. **Sí podrá transmitir una decisión que el usuario tome explícitamente en la Torre**, como aceptar o rechazar un permiso que una herramienta esté pidiendo | El dueño del proyecto reabrió D18 el 4 de agosto de 2026: quiere resolver los permisos de Claude Code sin cambiar de ventana. La aplicación sigue sin decidir NADA por su cuenta — solo transmite un clic humano. Riesgo aceptado y razonado en [ADR-007](docs/decisiones/ADR-007-permisos-remotos.md) |
| D19 | Cada tarea guardará el historial completo de sus cambios de estado, no solo el estado actual                                      | Es la prueba de honestidad del sistema: permite ver cuándo se perdió el contacto, quién dijo qué y cuánto lleva algo esperando. Aprobada el 3 de agosto de 2026 |
| D20 | Las peticiones de permiso **nunca se guardan en la base de datos**: viven en memoria y desaparecen al decidirse                    | Para poder enseñar el comando completo —necesario para aprobar con criterio— sin romper D5. Nada de lo que se muestra queda escrito en disco |
| D21 | Si el usuario no responde a un permiso en 90 segundos, o la Torre está cerrada, la herramienta vuelve a preguntar por su vía normal | La Torre es un atajo, nunca un cuello de botella. Ninguna sesión puede quedarse colgada esperándola |

---

## 6. Decisiones abiertas ❓

| ID | Pregunta                                                                              | Quién decide       | Cuándo debe resolverse                               |
| -- | ------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------- |
| O1 | ¿Cuál será el sistema operativo prioritario para empaquetar y probar primero?         | Dueño del proyecto | Antes de preparar la primera distribución instalable |
| O2 | ¿Chrome, Edge o Firefox será el navegador prioritario?                                | Dueño del proyecto | Antes de iniciar la extensión de navegador           |
| ~~O3~~ | ~~¿La primera integración real será Claude Code, Codex CLI o una plataforma web?~~ **RESUELTA 4/8/2026: Claude Code primero, ChatGPT después** | — | — |
| O4 | ¿Qué estilo visual tendrá la oficina: pixel art, isométrico, ilustrado o minimalista? | Dueño del proyecto | Antes de la fase visual avanzada                     |
| O5 | ¿Se necesitará sincronización entre ordenadores en el futuro?                         | Dueño del proyecto | Después de validar el MVP local                      |
| O6 | ¿El producto terminará siendo una herramienta interna o se ofrecerá a terceros?       | Dueño del proyecto | Después de validar el uso personal                   |
| O7 | ¿Las tareas tendrán un campo «rol» (analista, diseñador, contable…)?                  | Dueño del proyecto | Cuando el uso real diga si aporta o solo estorba al registrar |
| O8 | ¿Hará falta un estado «revisada» entre terminada y archivada?                         | Dueño del proyecto | Cuando el uso real diga si archivar directamente basta |

Estas decisiones no bloquean la construcción de la primera vertical local.

**Sobre O7 y O8.** Ambas aparecen en el diseño visual aprobado el 3 de agosto de
2026 y quedaron deliberadamente fuera del modelo de datos. Mientras no se
decidan, la oficina usa la **plataforma** —no el rol— para colorear y agrupar a
los trabajadores, y una tarea terminada pasa directamente a archivada.

---

## 7. Lo que NO es este proyecto

* No es un nuevo modelo de inteligencia artificial.
* No es una plataforma para ejecutar prompts mediante APIs de pago.
* No sustituye a ChatGPT, Claude, Codex ni otras herramientas.
* No necesita mostrar ni copiar las respuestas generadas.
* No almacena conversaciones completas.
* No es un gestor documental en el MVP.
* No es una memoria compartida entre agentes en el MVP.
* No gestiona correo, Drive, calendario ni contabilidad en las primeras fases.
* No envía correos ni mensajes por el usuario.
* No acepta **automáticamente** permisos solicitados por agentes. Desde el 4 de
  agosto de 2026 sí puede transmitir tu decisión explícita: la Torre te enseña
  qué se pide y tú clicas. Nunca decide sola (D18-bis).
* No realiza pagos ni acciones empresariales sensibles.
* No será multiusuario en el MVP.
* No tendrá sincronización en la nube en el MVP.
* No utilizará automatización de pantalla como mecanismo principal.
* No intentará soportar todas las plataformas desde el primer día.
* No priorizará gráficos complejos sobre la fiabilidad del seguimiento.

---

## 8. Modelo conceptual del producto

### Tarea

Representa el encargo que el usuario ha delegado.

Una tarea puede incluir:

* título;
* plataforma;
* URL externa;
* identificador de sesión externo;
* carpeta local de trabajo;
* estado;
* fuente del estado;
* nivel de confianza;
* hora de inicio;
* última actividad;
* hora de finalización;
* notas.

### Estados normalizados

* `draft` — el encargo está preparado pero no iniciado.
* `queued` — está esperando a comenzar.
* `running` — la herramienta parece estar trabajando.
* `waiting_user` — necesita información, aprobación o intervención.
* `completed` — ha terminado.
* `failed` — ha finalizado con error.
* `unknown` — el sistema ha perdido la capacidad de confirmar su estado.
* `archived` — el usuario ya ha revisado o retirado la tarea de la vista activa.

### Fuentes de estado

* actualización manual;
* evento local;
* hook de Claude Code;
* monitor de proceso;
* extensión de navegador;
* integración oficial futura.

### Confianza del estado

* **Alta:** procede de un evento oficial o del proceso controlado.
* **Media:** procede de una señal indirecta razonablemente fiable.
* **Baja:** procede de una heurística o la información puede estar desactualizada.

---

## 9. Fases del proyecto

| Fase                      | Qué incluye                                                                          | Estado      |
| ------------------------- | ------------------------------------------------------------------------------------ | ----------- |
| Fase 0 — Definición       | Visión, arquitectura inicial, modelo de estados y roadmap                            | 🟨 En curso |
| Fase 1 — Vertical local   | Aplicación de escritorio, SQLite, tareas manuales, estados, notificaciones y enlaces | ⬜ Pendiente |
| Fase 2 — Claude Code      | Recepción de eventos mediante hooks y asociación con sesiones                        | ⬜ Pendiente |
| Fase 3 — Navegador        | Extensión para registrar conversaciones y observar estados en plataformas web        | ⬜ Pendiente |
| Fase 4 — Oficina visual   | Representación avanzada de trabajadores, puestos, despacho y entregas                | ⬜ Pendiente |
| Fase 5 — Más herramientas | Codex, otras CLIs y adaptadores adicionales                                          | ⬜ Pendiente |
| Fase 6 — Opcional         | Sincronización, equipos, memoria o integraciones empresariales si se justifican      | ⬜ Pendiente |

---

## 10. Alcance del MVP

El MVP debe permitir:

1. Crear una tarea manualmente.
2. Seleccionar la plataforma donde se ejecuta.
3. Asociar una URL, sesión o carpeta local.
4. Ver todas las tareas activas.
5. Distinguir cuáles trabajan, esperan intervención, han terminado, han fallado o tienen estado desconocido.
6. Cambiar manualmente cualquier estado.
7. Recibir eventos automáticos de al menos una herramienta real.
8. Recibir una notificación cuando una tarea termina o necesita intervención.
9. Abrir el resultado externo con un clic.
10. Archivar tareas revisadas.
11. Consultar el historial básico.
12. Utilizar una vista operativa y una vista oficina conectadas al mismo estado.
13. Funcionar sin APIs de modelos.
14. Funcionar sin servidor externo.
15. No almacenar contenido de las conversaciones.

---

## 11. Contexto de negocio relevante

El usuario gestiona una patrimonial prácticamente solo y trabaja en ámbitos muy diferentes:

* administración;
* estudios de mercado;
* desarrollo de software;
* diseño;
* contabilidad;
* documentación;
* análisis;
* organización empresarial.

Utiliza simultáneamente diferentes herramientas y agentes de IA.

El problema principal no es la calidad de los outputs. El problema es perder la conciencia de qué tareas están ejecutándose y descubrir demasiado tarde que una tarea terminó, se bloqueó o necesita intervención.

La aplicación debe reducir carga mental. No debe convertirse en otra herramienta compleja que haya que administrar constantemente.

Registrar una tarea debe ser rápido y el estado debe entenderse de un vistazo.

Las integraciones con interfaces web serán inherentemente menos fiables que los eventos oficiales o los procesos locales. La interfaz debe comunicar claramente esa incertidumbre y conservar siempre controles manuales.

---

## 12. Principios de experiencia de usuario

* La información importante se entiende en menos de diez segundos.
* Las tareas que requieren intervención destacan por encima de las que simplemente trabajan.
* Una tarea terminada no desaparece hasta que el usuario la revise o archive.
* Ningún estado incierto se presenta como seguro.
* Toda tarea debe tener una forma clara de volver a su herramienta original.
* La vista oficina debe aportar comprensión, no decoración.
* Las animaciones nunca deben ocultar información operativa.
* La aplicación debe poder utilizarse aunque fallen todas las integraciones automáticas.
* El usuario no necesita entender conceptos técnicos para utilizarla.

---

## 13. Seguridad y privacidad

* Toda la información se almacena localmente durante el MVP.
* El servicio de eventos solo escucha en `127.0.0.1`.
* No se almacenan prompts ni outputs.
* No se almacenan contraseñas ni cookies de sesión.
* No se interceptan credenciales.
* Los enlaces externos se validan antes de abrirlos.
* No se ejecutan comandos arbitrarios procedentes de eventos.
* Toda modificación de configuración global requiere aprobación explícita.
* La extensión de navegador solicitará únicamente los permisos imprescindibles.
* Los eventos se validarán antes de modificar una tarea.
* Las integraciones deben aplicar el principio de mínimo privilegio.
* Los datos de desarrollo y tests serán ficticios.

---

## 14. Riesgos conocidos

### Cambios en las interfaces web

ChatGPT, Claude y otras plataformas pueden modificar su HTML o sus indicadores visuales. Esto puede romper los detectores de la extensión.

Mitigación:

* adaptadores separados por plataforma;
* tests de detectores;
* nivel de confianza;
* estado `unknown`;
* actualización manual como respaldo.

### Falsos estados

Una plataforma puede parecer terminada cuando en realidad espera una acción o ha perdido conexión.

Mitigación:

* conservar la fuente del estado;
* mostrar nivel de confianza;
* no inferir más de lo que indique la señal;
* permitir corrección manual.

### Configuraciones globales

Instalar hooks puede afectar otras sesiones de Claude Code.

Mitigación:

* no modificar configuraciones automáticamente;
* mostrar previamente el cambio;
* crear copia de seguridad;
* permitir desinstalación;
* pedir confirmación explícita.

### Diferencias entre sistemas operativos

Procesos, notificaciones y apertura de enlaces pueden comportarse de forma distinta.

Mitigación:

* abstraer las funciones del sistema operativo;
* elegir un sistema prioritario;
* probar antes de afirmar compatibilidad.

### Crecimiento prematuro

Intentar integrar todas las herramientas y construir la oficina completa puede retrasar la validación.

Mitigación:

* verticales pequeñas;
* una integración cada vez;
* tablero operativo antes de gráficos avanzados;
* criterios de aceptación por sprint.

---

## 15. Métricas de éxito

* El usuario puede registrar una tarea en menos de 15 segundos.
* El 100 % de las tareas activas registradas aparecen en la torre de control.
* Una finalización detectada automáticamente se muestra y notifica en menos de 10 segundos.
* El usuario puede abrir el resultado original con un solo clic.
* Las tareas que requieren intervención no se pierden entre tareas completadas.
* La aplicación continúa siendo útil aunque una integración automática falle.
* El uso normal no genera costes por APIs de modelos.
* No se almacena contenido de las conversaciones.
* El usuario deja de olvidar trabajos activos o terminados.
* La interfaz permite comprender la carga de trabajo sin abrir cada plataforma.

---

## 16. Definición de éxito del primer prototipo

El primer prototipo se considerará válido cuando el usuario pueda:

1. abrir la aplicación;
2. crear tres tareas de plataformas diferentes;
3. verlas representadas en la vista operativa y en una oficina sencilla;
4. cambiar una a `running`;
5. cambiar otra a `waiting_user`;
6. recibir un evento local que marque la tercera como `completed`;
7. cerrar y volver a abrir la aplicación sin perder esos datos;
8. pulsar una tarea terminada y abrir su conversación externa;
9. recibir una notificación de finalización;
10. hacerlo sin utilizar ninguna API de inteligencia artificial.

---

*Última actualización: 3 de agosto de 2026 por el dueño del proyecto.*
