// How Tidy scales: n elements (systems holding containers and databases, people, ADRs, a chain of
// relations) from a pile and from a plain grid, with and without the 10 s budget.
//   npx tsx bench/tidy-scale.mts 300 600 1000
import { runTidyLayout } from '../src/tidy/index'
import { NODE_SIZES, type C4Node, type C4Relation } from '@radical/common/c4'

function model(n: number, start: 'pile' | 'grid'): { nodes: Record<string, C4Node>; relations: Record<string, C4Relation> } {
  const nodes: C4Node[] = [], relations: C4Relation[] = []
  const node = (id: string, type: keyof typeof NODE_SIZES, parentId: string | undefined, x: number, y: number): C4Node =>
    ({ id, type, label: id, collapsed: false, x, y, ...NODE_SIZES[type], ...(parentId ? { parentId } : {}) }) as C4Node
  const rel = (a: string, b: string): C4Relation => ({ id: `${a}-${b}`, sourceId: a, targetId: b, relationType: 'interacts' })
  let i = 0
  const at = (k: number): [number, number] => (start === 'pile' ? [(k % 6) * 15, Math.floor(k / 6) * 15] : [(k % 8) * 900, Math.floor(k / 8) * 700])
  while (nodes.length < n) {
    const [sx, sy] = at(i)
    const sys = `sys${i}`
    nodes.push(node(sys, 'system', undefined, sx, sy))
    let prev: string | undefined
    for (let k = 0; k < 4 && nodes.length < n; k++) {
      const c = `${sys}-c${k}`
      nodes.push(node(c, 'container', sys, start === 'pile' ? 40 + k * 10 : 40 + (k % 2) * 320, start === 'pile' ? 120 + k * 10 : 120 + Math.floor(k / 2) * 220))
      if (prev) relations.push(rel(prev, c))
      prev = c
      if (k % 2 === 0 && nodes.length < n) { const db = `${sys}-db${k}`; nodes.push(node(db, 'database', sys, 40 + k * 12, 120 + k * 12)); relations.push(rel(c, db)) }
    }
    if (i % 3 === 0 && nodes.length < n) { const p = `person${i}`; nodes.push(node(p, 'person', undefined, sx + 10, sy + 10)); relations.push(rel(p, `${sys}-c0`)) }
    if (i % 2 === 0 && nodes.length < n) { const a = `adr${i}`; nodes.push(node(a, 'adr', undefined, sx + 20, sy + 20)); relations.push({ id: `${a}-${sys}`, sourceId: a, targetId: sys, relationType: 'constrains' }) }
    if (i > 0) relations.push(rel(`sys${i - 1}-c0`, `${sys}-c0`))
    i++
  }
  return { nodes: Object.fromEntries(nodes.map((x) => [x.id, x])), relations: Object.fromEntries(relations.map((r) => [r.id, r])) }
}

for (const n of process.argv.slice(2).map(Number)) {
  for (const start of ['grid', 'pile'] as const) {
    for (const budgetMs of [10_000, undefined]) {
      const { nodes, relations } = model(n, start)
      const t = Date.now(), cpu0 = process.cpuUsage()
      const r = runTidyLayout(nodes, relations, { budgetMs })
      const ms = Date.now() - t
      const cpu = Math.round((process.cpuUsage(cpu0).user + process.cpuUsage(cpu0).system) / 1000)
      const b = r.tidy.before, a = r.tidy.after
      console.log(`${String(n).padStart(5)} ${start.padEnd(4)} budget ${budgetMs ? '10s ' : 'none'} ${String(ms).padStart(6)} ms (cpu ${String(cpu).padStart(6)})  moves ${String(r.tidy.steps.length).padStart(4)}${r.tidy.budgetOut ? ' (cut)' : '      '}  cost ${b.total.toFixed(0).padStart(6)} -> ${a.total.toFixed(0).padStart(6)}  cross ${b.crossings}->${a.crossings} over ${b.overdraws}->${a.overdraws} slant ${b.slanted}->${a.slanted}`)
    }
  }
}
