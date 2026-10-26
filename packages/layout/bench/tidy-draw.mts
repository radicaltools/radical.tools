// Tidy a view and draw it as Studio would roughly show it (frames, labels, port to port lines): <file> <out.svg>
import { readFileSync, writeFileSync } from 'node:fs'
import { runTidyLayout } from '../src/tidy'
import { Layout } from '../src/tidy/layout'
import { buildIndex, geomOf, isStraight, linesOf } from '../src/tidy/cost'
import { viewLayoutInput } from '../src/viewInput'
import { projectPositions } from '../src/smartLayout'
import { projectToVisibleGraph } from '../src/geometry'

const [file, out] = process.argv.slice(2)
const d = JSON.parse(readFileSync(file, 'utf8'))
const byId = (xs: any[]) => Object.fromEntries(xs.map((x) => [x.id, x]))
const input = viewLayoutInput(d.view, byId(d.nodes), byId(d.relations))
const res = runTidyLayout(input.nodes, input.relations, { frames: [...input.frames] })
const { nodes, relations } = projectToVisibleGraph(input.nodes, input.relations)
const l = new Layout(projectPositions(nodes, res.winner.positions), undefined, [], input.frames)
const lines = linesOf(l, relations)
const index = buildIndex(l, lines)
const depth = (id: string) => { let n = 0; for (let p = l.parentOf(id); p; p = l.parentOf(p)) n++; return n }
const ids = [...l.ids()].sort((a, b) => depth(a) - depth(b))
const bs = ids.map((id) => l.box(id)!)
const x0 = Math.min(...bs.map((b) => b.x)) - 40, y0 = Math.min(...bs.map((b) => b.y)) - 40
const x1 = Math.max(...bs.map((b) => b.x + b.w)) + 40, y1 = Math.max(...bs.map((b) => b.y + b.h)) + 40
const colour: Record<string, string> = { person: '#8ab', system: '#68a', container: '#79c', component: '#9bd', database: '#c96', adr: '#ca6', requirement: '#9c9' }
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" width="${Math.min(2400, x1 - x0)}"><rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="white"/>`
for (const id of ids) {
  const b = l.box(id)!, n = nodes[id]
  if (l.isTight(id)) s += `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="#dde" stroke-dasharray="2 6"/>`
  else if (l.isFrame(id)) s += `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#f4f6fa" stroke="#99a" stroke-dasharray="8 6" rx="8"/><text x="${b.x + 10}" y="${b.y + 26}" font-size="20" fill="#556">${esc(n.label ?? id)}</text>`
  else s += `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="${colour[n.type] ?? '#bbb'}" stroke="#334" rx="6"/><text x="${b.x + b.w / 2}" y="${b.y + b.h / 2 + 7}" font-size="20" text-anchor="middle">${esc((n.label ?? id).slice(0, 24))}</text>`
}
for (const x of lines) {
  const g = geomOf(index, x)
  const pts = g.path.map((p) => `${p.x},${p.y}`).join(' ')
  s += `<polyline points="${pts}" fill="none" stroke="${isStraight(index, x) ? '#222' : '#d33'}" stroke-width="3"/>`
}
writeFileSync(out, s + '</svg>')
console.log(file, 'moves', res.tidy.steps.length)
