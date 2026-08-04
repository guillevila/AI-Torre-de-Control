/**
 * Cuándo dos direcciones son la misma conversación.
 *
 * Vive aquí, en el dominio, porque la usan dos piezas distintas y tienen que
 * estar de acuerdo: la que da de alta una conversación desde el navegador y la
 * que después mueve su estado al detectar actividad. Si cada una decidiera por
 * su cuenta, la extensión registraría una tarea y luego movería otra.
 */

/**
 * Reduce una dirección a lo que la identifica.
 *
 * Se quitan el fragmento (`#...`) y la barra final porque el navegador los
 * añade y los quita él solo mientras navegas: `…/c/abc`, `…/c/abc/` y
 * `…/c/abc#x` son la misma página, y tratarlas como distintas duplicaría la
 * tarea.
 *
 * Los parámetros (`?...`) SÍ se conservan: hay herramientas que identifican la
 * conversación ahí, y unir dos conversaciones distintas es peor error que
 * separar una en dos.
 *
 * El servidor se pasa a minúsculas —los nombres de dominio no distinguen
 * mayúsculas— pero la ruta NO: hay sitios donde `/C/Abc` y `/c/abc` son cosas
 * distintas, y no nos corresponde decidir que no lo son.
 */
export function canonicalConversationUrl(url: string): string {
  const limpia = url.trim()
  try {
    const parsed = new URL(limpia)
    const ruta = parsed.pathname.replace(/\/+$/, '')
    return `${parsed.protocol}//${parsed.host.toLowerCase()}${ruta}${parsed.search}`
  } catch {
    // No es una dirección válida. Se devuelve tal cual: comparar dos textos
    // iguales sigue siendo correcto, y validar no es tarea de esta función.
    return limpia
  }
}

/** ¿Apuntan las dos a la misma conversación? */
export function sameConversation(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  return canonicalConversationUrl(a) === canonicalConversationUrl(b)
}
