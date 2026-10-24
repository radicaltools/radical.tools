// Debug: tidy a fixture view, print the moves, draw before/after SVGs.
import { readFileSync, writeFileSync } from 'node:fs'
import { runTidyLayout } from '../src/tidy'
import { viewLayoutInput } from '../src/viewInput'
import { projectToVisibleGraph } from '../src/geometry'
const [file, svgOut] = process.argv.slice(2)
const d = JSON.parse(readFileSync(file, 'utf8'))
const byId = (xs: any[]) => Object.fromEntries(xs.map((x) => [x.id, x]))
const input = viewLayoutInput(d.view, byId(d.nodes), byId(d.relations))
const t = Date.now()
const res = runTidyLayout(input.nodes, input.relations)
console.log('ms', Date.now() - t, 'steps', res.tidy.steps.length, 'cost', JSON.stringify(res.tidy.before), '->', JSON.stringify(res.tidy.after), 'crossings', res.winner.metrics.crossings, 'overdraws', res.winner.metrics.overdraws)
for (const s of res.tidy.steps) console.log(`  ${s.kind.padEnd(12)} +${s.gain.toFixed(1).padStart(5)}  ${s.description}`)
const draw = (pos: Record<string, any>, out: string) => {
  const v = projectToVisibleGraph(input.nodes, input.relations)
  const abs = (id: string): any => { const n = v.nodes[id]; const p = pos[id] ?? n; const par = n.parentId && v.nodes[n.parentId] ? abs(n.parentId) : { x: 0, y: 0 }; return { x: par.x + p.x, y: par.y + p.y, w: p.width ?? n.width, h: p.height ?? n.height } }
  const rs = Object.keys(v.nodes).map((id) => ({ id, ...abs(id) }))
  const x0 = Math.min(...rs.map((r) => r.x)) - 20, y0 = Math.min(...rs.map((r) => r.y)) - 20, x1 = Math.max(...rs.map((r) => r.x + r.w)) + 20, y1 = Math.max(...rs.map((r) => r.y + r.h)) + 20
  const R = Object.fromEntries(rs.map((r) => [r.id, r])); const ctr = (r: any) => [r.x + r.w / 2, r.y + r.h / 2]
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" width="${(x1 - x0) / 2}" height="${(y1 - y0) / 2}"><rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="white"/>`
  for (const r of rs) s += `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${v.nodes[r.id].type === 'adr' ? '#a52' : '#48c'}" fill-opacity="0.45" stroke="#000"/><text x="${r.x + 6}" y="${r.y + 24}" font-size="22">${r.id}</text>`
  for (const e of Object.values(v.relations) as any[]) { const [a, b] = [ctr(R[e.sourceId]), ctr(R[e.targetId])]; s += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#333" stroke-width="3"/>` }
  writeFileSync(out, s + '</svg>')
}
if (svgOut) { draw({}, svgOut.replace('.svg', '-before.svg')); draw(res.winner.positions, svgOut) }
