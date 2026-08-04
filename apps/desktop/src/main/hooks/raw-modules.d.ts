/**
 * Permite incrustar el texto de un fichero en la compilación.
 *
 * Se usa para el script del enlace con Claude Code: así el instalador puede
 * escribirlo en tu carpeta de datos sin depender de dónde esté el repositorio,
 * y sin que la aplicación deje de funcionar si mueves la carpeta del proyecto.
 */
declare module '*?raw' {
  const content: string
  export default content
}
