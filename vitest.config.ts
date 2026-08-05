import { defineConfig } from 'vitest/config'

/**
 * Tests unitarios de todo el monorepo.
 *
 * Se ejecutan con Node normal (NO con Electron), por dos razones:
 *  - son mucho más rápidos;
 *  - el CI puede ejecutarlos sin pantalla ni recompilar módulos nativos.
 *
 * Las pruebas de interfaz de verdad viven en apps/desktop/e2e (Playwright).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'packages/*/src/**/*.test.ts',
      'apps/desktop/src/main/**/*.test.ts',
      // De la interfaz solo entran aquí los módulos PUROS (sin React ni DOM),
      // como el analizador de Markdown. Lo que pinta en pantalla se comprueba
      // en las pruebas de Playwright, que abren la aplicación de verdad.
      'apps/desktop/src/renderer/utils/**/*.test.ts',
      // La extensión es JavaScript de navegador, sin compilar. Lo que se puede
      // probar sin navegador —sus funciones puras— también se prueba.
      'apps/extension/**/*.test.mjs',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', '**/out/**', '**/e2e/**'],
    reporters: 'default',
  },
})
