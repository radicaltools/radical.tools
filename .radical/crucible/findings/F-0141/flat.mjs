// A flat model of n requirements (view "Every requirement" by type) as path → text, made by gen2.mts.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { DIR } from './lib.mjs'
export function flatModel(n, hub = false) {
  const out = join(DIR, `r${n}${hub ? 'h' : ''}.json`)
  if (!existsSync(out)) {
    const r = spawnSync(process.execPath, ['--import', 'tsx', join(DIR, 'gen2.mts'), String(n), out, ...(hub ? ['hub'] : [])], { cwd: DIR, encoding: 'utf8' })
    if (r.status !== 0) throw new Error(r.stderr)
  }
  return JSON.parse(readFileSync(out, 'utf8'))
}
