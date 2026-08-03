import { defineConfig } from '@playwright/test'

/**
 * Configuración de la prueba de interfaz.
 *
 * Un solo proceso: la aplicación abre una base de datos SQLite y varias
 * instancias a la vez se pisarían. La lentitud no importa porque son pocas
 * pruebas y muy dirigidas; el grueso de la verificación está en los tests
 * unitarios, que tardan milisegundos.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0,
})
