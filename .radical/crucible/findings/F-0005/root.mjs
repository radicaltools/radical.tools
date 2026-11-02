// The repository root: the first folder above this file with apps/cli/dist/index.js.
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
let dir = dirname(fileURLToPath(import.meta.url))
while (!existsSync(join(dir, 'apps/cli/dist/index.js')) && dirname(dir) !== dir) dir = dirname(dir)
export const ROOT = dir
export const CLI = join(ROOT, 'apps/cli/dist/index.js')
export const SERVER = join(ROOT, 'apps/mcp/dist/index.js')
