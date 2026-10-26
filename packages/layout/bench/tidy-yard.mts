// One yardstick for Tidy whatever its weights: slanted lines, crossings and
// lines over elements, total line length and the area, in mean element sizes.
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
const { runTidyLayout } = await import(process.env.OLD ? '../src/tidy-old/index' : '../src/tidy/index')
import { Layout } from '../src/tidy/layout'
import { buildIndex, geomOf, isStraight, kinApartOf, linesOf, nearMissesOf, totalCost } from '../src/tidy/cost'
import { viewLayoutInput } from '../src/viewInput'
import { projectPositions } from '../src/smartLayout'
import { projectToVisibleGraph } from '../src/geometry'

const byId = (xs: any[]) => Object.fromEntries(xs.map((x) => [x.id, x]))
const sum = { slanted: 0, crossings: 0, overdraws: 0, length: 0, area: 0, near: 0, kin: 0 }
for (const f of process.argv.slice(2)) {
  const d = JSON.parse(readFileSync(f, 'utf8'))
  const input = viewLayoutInput(d.view, byId(d.nodes), byId(d.relations))
  const res = runTidyLayout(input.nodes, input.relations, { frames: [...input.frames] })
  const { nodes, relations } = projectToVisibleGraph(input.nodes, input.relations)
  const l = new Layout(projectPositions(nodes, res.winner.positions), undefined, [], input.frames)
  const lines = linesOf(l, relations)
  const index = buildIndex(l, lines)
  const c = totalCost(l, lines)
  const slanted = lines.filter((x) => !isStraight(index, x)).length
  const length = lines.reduce((s, x) => { const g = geomOf(index, x); return s + Math.hypot(g.ax - g.bx, g.ay - g.by) }, 0) / l.meanSize
  const roots = l.ids().filter((id) => !l.parentOf(id)).map((id) => l.box(id)!)
  const area = (Math.max(...roots.map((b) => b.x + b.w)) - Math.min(...roots.map((b) => b.x))) * (Math.max(...roots.map((b) => b.y + b.h)) - Math.min(...roots.map((b) => b.y))) / l.meanSize ** 2
  const near = l.ids().reduce((s, id) => s + nearMissesOf(l, id).length, 0) / 2
  const kin = l.ids().filter((id) => kinApartOf(l, id, (o) => !!index.linesOf.get(o)?.length).length).length
  sum.near += near; sum.kin += kin
  sum.slanted += slanted; sum.crossings += c.crossings; sum.overdraws += c.overdraws; sum.length += length; sum.area += area
  console.log(`${basename(f).padEnd(38)} slanted ${String(slanted).padStart(2)}/${String(lines.length).padEnd(3)} cross ${c.crossings} over ${c.overdraws}  length ${length.toFixed(1).padStart(6)}  area ${area.toFixed(0).padStart(4)}  near ${near} kin ${kin}  moves ${res.tidy.steps.length}`)
}
console.log(`TOTAL slanted ${sum.slanted} cross ${sum.crossings} over ${sum.overdraws} length ${sum.length.toFixed(1)} area ${sum.area.toFixed(0)} near ${sum.near} kin ${sum.kin}`)
