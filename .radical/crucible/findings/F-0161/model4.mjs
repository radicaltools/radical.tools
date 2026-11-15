import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { DIR } from './lib.mjs'
export function briefModel(n) {
  const out = join(DIR, `b${n}.json`)
  if (!existsSync(out)) { const r = spawnSync(process.execPath, ['--import', 'tsx', join(DIR, 'gen4.mts'), String(n), out], { cwd: DIR, encoding: 'utf8' }); if (r.status) throw new Error(r.stderr) }
  return JSON.parse(readFileSync(out, 'utf8'))
}
