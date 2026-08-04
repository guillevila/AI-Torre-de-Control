import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

const here = fileURLToPath(new URL('.', import.meta.url))

/**
 * `externalizeDepsPlugin` deja fuera del paquete las dependencias de npm
 * (se cargan desde node_modules en tiempo de ejecución).
 *
 * Excepción: los paquetes internos del monorepo se distribuyen como código
 * TypeScript sin compilar, así que hay que incluirlos en el paquete final.
 */
const externalize = () =>
  externalizeDepsPlugin({ exclude: ['@torre/contracts', '@torre/domain'] })

/**
 * Política de contenidos para la versión construida.
 *
 * En producción la interfaz se carga desde el disco (file://), donde no hay
 * cabeceras HTTP que interceptar, así que la política tiene que viajar dentro
 * del propio HTML. En desarrollo NO se aplica: la recarga en caliente de Vite
 * necesita permisos que en producción no queremos dar, y allí la política se
 * inyecta por cabecera desde el proceso principal.
 */
const productionCsp = () => ({
  name: 'torre-csp-produccion',
  apply: 'build' as const,
  transformIndexHtml(html: string): string {
    const policy = [
      "default-src 'none'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'none'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
    ].join('; ')
    return html.replace(
      '</head>',
      `  <meta http-equiv="Content-Security-Policy" content="${policy}" />\n  </head>`,
    )
  },
})

export default defineConfig({
  main: {
    plugins: [externalize()],
    build: {
      rollupOptions: { input: { index: resolve(here, 'src/main/index.ts') } },
    },
  },
  preload: {
    plugins: [externalize()],
    build: {
      rollupOptions: { input: { index: resolve(here, 'src/preload/index.ts') } },
    },
  },
  renderer: {
    root: resolve(here, 'src/renderer'),
    plugins: [react(), productionCsp()],
    build: {
      rollupOptions: { input: { index: resolve(here, 'src/renderer/index.html') } },
    },
  },
})
