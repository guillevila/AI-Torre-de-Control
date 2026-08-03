#!/usr/bin/env node
/**
 * Arrancador de electron-vite.
 *
 * Existe por un motivo concreto y real: los terminales integrados de editores
 * construidos sobre Electron (VS Code, Cursor y similares) heredan la variable
 * de entorno `ELECTRON_RUN_AS_NODE=1`. Con esa variable puesta, Electron se
 * comporta como si fuera Node a secas: no abre ninguna ventana y el fallo es
 * silencioso y muy difícil de diagnosticar.
 *
 * Aquí se limpia antes de arrancar. Si lanzas desde una terminal normal, este
 * envoltorio no cambia absolutamente nada.
 *
 * Se ejecuta la CLI en este mismo proceso (no se abre otro) para no depender
 * del intérprete de comandos del sistema.
 */

import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

delete process.env['ELECTRON_RUN_AS_NODE']

// El paquete no expone su carpeta `bin` en el mapa de exports, pero sí su
// package.json: se resuelve ese y se compone la ruta desde ahí.
const require = createRequire(import.meta.url)
const cli = join(dirname(require.resolve('electron-vite/package.json')), 'bin', 'electron-vite.js')

// La CLI lee sus órdenes de process.argv, así que se le deja tal cual las
// recibimos ("dev", "preview", …).
process.argv = [process.argv[0] ?? 'node', cli, ...process.argv.slice(2)]

await import(pathToFileURL(cli).href)
