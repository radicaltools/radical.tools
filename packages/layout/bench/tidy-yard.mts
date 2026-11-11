// The yardstick (yardstick.ts) printed model by model: `npx tsx bench/tidy-yard.mts [files]`.
// OLD=1 measures src/tidy-old (a copy of another version, to compare); `--write` saves the
// totals as the baseline the yardstick test holds Tidy to (only ever to lower it: a better
// layout ratchets the baseline, a worse one is a regression to fix).
import { writeFileSync } from 'node:fs'
import { YARDSTICK_FILE, YARDSTICK_KEYS, baseline, benchModels, measure, total, worse, type YardRow } from './yardstick'
const tidy = process.env.OLD ? (await import('../src/tidy-old/index')).runTidyLayout : undefined
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const write = process.argv.includes('--write')
// SHAKES=n: every model from n shaken starts instead of its canvas, the totals averaged
// (to compare two versions of Tidy: one start is one sample).
const shakes = Number(process.env.SHAKES ?? 0)
if (shakes) {
  const sums = Array.from({ length: shakes }, (_, i) => total((args.length ? args : benchModels()).map((f) => measure(f, tidy, i + 1))))
  for (const s of sums) console.log(`shake ${YARDSTICK_KEYS.map((k) => `${k} ${s[k]}`).join('  ')}`)
  console.log(`MEAN  ${YARDSTICK_KEYS.map((k) => `${k} ${(sums.reduce((n, s) => n + s[k], 0) / shakes).toFixed(1)}`).join('  ')}`)
  process.exit(0)
}
const rows: YardRow[] = []
for (const f of args.length ? args : benchModels()) {
  const r = measure(f, tidy)
  rows.push(r)
  console.log(`${r.file.padEnd(38)} drawn cross ${String(r.drawnCrossings).padStart(3)} over ${String(r.drawnOverdraws).padStart(2)}  slanted ${String(r.slanted).padStart(2)}/${String(r.lines).padEnd(3)} length ${r.length.toFixed(1).padStart(6)}  area ${r.area.toFixed(0).padStart(4)}  straight cross ${r.crossings} over ${r.overdraws}  near ${r.near} kin ${r.kin} cramped ${r.cramped.toFixed(1)}  cost ${r.cost.toFixed(0)} moves ${r.moves}`)
}
const sum = total(rows)
console.log(`TOTAL ${YARDSTICK_KEYS.map((k) => `${k} ${sum[k]}`).join('  ')}  cost ${rows.reduce((s, r) => s + r.cost, 0).toFixed(0)} moves ${rows.reduce((s, r) => s + r.moves, 0)}`)
if (!args.length) {
  if (write) { writeFileSync(YARDSTICK_FILE, JSON.stringify(sum, null, 2) + '\n'); console.log(`baseline written to ${YARDSTICK_FILE}`) }
  else { const base = baseline(); console.log(`BASE  ${YARDSTICK_KEYS.map((k) => `${k} ${base[k]}`).join('  ')}`); for (const w of worse(sum, base)) console.log(`WORSE: ${w}`) }
}
