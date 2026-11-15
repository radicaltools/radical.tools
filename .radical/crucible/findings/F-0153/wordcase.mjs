// Runs word cases through quoteCase (MCP write + radical check), prints them, keeps the log in shots/<name>.txt.
import { quoteCase } from './words.mjs'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DIR } from './lib.mjs'
export async function runCases(shot, cases) {
  const log = []; const out = {}
  for (const [name, c] of cases) {
    const r = await quoteCase(`${shot}-${name}`, c)
    out[name] = r.check
    const text = `${name}\n  need answer: ${c.answer}\n  requirement: ${c.action}\n  radical check: ${r.check.length ? '\n    ' + r.check.join('\n    ') : '(no finding)'}`
    console.log(text); log.push(text)
  }
  mkdirSync(join(DIR, 'shots'), { recursive: true }); writeFileSync(join(DIR, 'shots', `${shot}.txt`), log.join('\n\n') + '\n')
  return out
}
export const has = (findings, rule) => findings.some((f) => f.startsWith(rule + ':'))
