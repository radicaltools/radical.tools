// Why a line stays slanted after Tidy: each slanted line's align moves tried
// on the tidied layout, with whether the spot was taken or what the cost said.
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { runTidyLayout } from '../src/tidy'
import { Layout } from '../src/tidy/layout'
import { WEIGHTS, buildIndex, isStraight, linesOf, totalCost } from '../src/tidy/cost'
import { candidateMoves } from '../src/tidy/moves'
import { viewLayoutInput } from '../src/viewInput'
import { projectPositions } from '../src/smartLayout'
import { projectToVisibleGraph } from '../src/geometry'

const byId = (xs: any[]) => Object.fromEntries(xs.map((x) => [x.id, x]))
for (const f of process.argv.slice(2)) {
  const d = JSON.parse(readFileSync(f, 'utf8'))
  const input = viewLayoutInput(d.view, byId(d.nodes), byId(d.relations))
  const res = runTidyLayout(input.nodes, input.relations, { frames: [...input.frames] })
  const { nodes, relations } = projectToVisibleGraph(input.nodes, input.relations)
  const l = new Layout(projectPositions(nodes, res.winner.positions), undefined, [], input.frames)
  const lines = linesOf(l, relations)
  const index = buildIndex(l, lines)
  const base = totalCost(l, lines)
  const slanted = lines.filter((x) => !isStraight(index, x))
  console.log(`${basename(f)}: ${slanted.length}/${lines.length} slanted, cost ${base.total.toFixed(1)}, length ${base.length.toFixed(1)}`)
  const label = (id: string) => nodes[id].label || id
  for (const x of slanted) {
    console.log(`  ${label(x.a)} -> ${label(x.b)} (${x.flow}/${x.axis})`)
    const moves = candidateMoves(l, nodes, relations, lines, new Set([x.a, x.b])).filter((m) => m.kind === 'align' && m.ids.some((id) => id === x.a || id === x.b) && (m.description.includes(label(x.a)) && m.description.includes(label(x.b))))
    for (const m of moves) {
      const was = l.positions()
      const ok = m.apply(l)
      if (!ok) { console.log(`    ${m.description}: BLOCKED`); l.setPositions(was); continue }
      const now = totalCost(l, lines)
      const diff = (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).map((k) => [k, (now[k] - base[k]) * WEIGHTS[k]] as const).filter(([, v]) => Math.abs(v) > 0.05).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v.toFixed(1)}`).join(', ')
      console.log(`    ${m.description}: gain ${(base.total - now.total).toFixed(1)}  [${diff}]`)
      l.setPositions(was)
    }
  }
}
