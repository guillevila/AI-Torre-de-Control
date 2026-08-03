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
    ],
    exclude: ['**/node_modules/**', '**/dist/**', '**/out/**', '**/e2e/**'],
    reporters: 'default',
  },
})
