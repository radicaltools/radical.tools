/**
 * Smart Layout on real models, measured by what a reader sees rather than by
 * Smart Layout's own score (which this bench exists to check):
 *   area    bounding box / the area of the leaf elements (lower: tighter)
 *   aspect  long side / short side of the bounding box
 *   cross   rendered edge crossings, draw: edges through unrelated elements
 *   overlap pairs of leaf elements that overlap, out: children outside their parent
 *   corridor relations squeezed through one place (Σ over 50 px squares)
 * Run from packages/layout: npx tsx bench/nestedLayout.bench.mts [--only name] [--out file.json] [model folders…]
 */
import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { join, basename, dirname } from 'node:path'
import { mkdirSync } from 'node:fs'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import { runSmartLayoutCore, computeCompositeScore } from '../src/smartLayout'
import { viewLayoutInput } from '../src/viewInput'
import { projectToVisibleGraph } from '../src/geometry'
import { deserializeFromMdFolder } from '@radical/common/formats/mdFolder'
import { documentMetamodel } from '@radical/common/model'
import type { C4Node, C4Relation } from '@radical/common/c4'

const args = process.argv.slice(2)
const flag = (name: string) => { const i = args.indexOf(name); if (i < 0) return undefined; const v = args[i + 1]; args.splice(i, 2); return v }
const only = flag('--only')
const out = flag('--out')
const dump = flag('--dump')
const byId = <T extends { id: string }>(xs: T[]) => Object.fromEntries(xs.map((x) => [x.id, x])) as Record<string, T>

interface Fixture { name: string; nodes: C4Node[]; relations: C4Relation[]; metamodel?: unknown; constraints?: unknown }
const fixtures: Fixture[] = []
// The former Hub blueprints and patterns, kept here as models to lay out.
const catalogue = 'bench/models'
for (const dir of ['blueprint', 'pattern']) {
  for (const f of readdirSync(join(catalogue, dir)).filter((f) => f.endsWith('.radical')).sort()) {
    const d = JSON.parse(readFileSync(join(catalogue, dir, f), 'utf8'))
    fixtures.push({ name: basename(f, '.radical'), nodes: d.nodes, relations: d.relations, metamodel: d.metamodel })
  }
}
for (const f of ['bookstore.radical', 'order-machine.radical']) {
  const d = JSON.parse(readFileSync(join('../../apps/e2e/fixtures', f), 'utf8'))
  fixtures.push({ name: basename(f, '.radical'), nodes: d.nodes, relations: d.relations, metamodel: d.metamodel })
}
for (const folder of args) {
  if (!existsSync(folder)) continue
  const d = deserializeFromMdFolder(readFolder(folder)).data as any
  fixtures.push({ name: folder.split('/').filter(Boolean).slice(-2).join('/'), nodes: d.nodes, relations: d.relations, metamodel: d.metamodel, constraints: d.defaultLayoutConstraints })
}

/** A model folder's files by path (the Markdown nodes and the JSON sidecars),
 *  read straight from disk: this package does not depend on node-files. */
function readFolder(root: string, dir = ''): Record<string, string> {
  const files: Record<string, string> = {}
  for (const name of readdirSync(join(root, dir))) {
    if (name.startsWith('.')) continue
    const path = dir ? `${dir}/${name}` : name
    if (statSync(join(root, path)).isDirectory()) Object.assign(files, readFolder(root, path))
    else if (/\.(md|json)$/.test(name)) files[path] = readFileSync(join(root, path), 'utf8')
  }
  return files
}

type Rect = { x: number; y: number; w: number; h: number }
function measure(nodes: Record<string, C4Node>, relations: Record<string, C4Relation>) {
  const abs: Record<string, Rect> = {}
  const rectOf = (id: string): Rect => {
    if (abs[id]) return abs[id]
    const n = nodes[id]
    const p = n.parentId && nodes[n.parentId] ? rectOf(n.parentId) : { x: 0, y: 0 }
    return (abs[id] = { x: p.x + n.x, y: p.y + n.y, w: n.width, h: n.height })
  }
  // What is drawn: not what sits inside a folded group.
  const hidden = (id: string): boolean => { for (let p = nodes[id].parentId; p && nodes[p]; p = nodes[p].parentId) if (nodes[p].collapsed) return true; return false }
  const ids = Object.keys(nodes).filter((id) => !hidden(id))
  ids.forEach(rectOf)
  const hasKids = new Set(ids.filter((id) => !nodes[id].collapsed).length ? ids.map((id) => nodes[id].parentId).filter((p) => p && !nodes[p].collapsed) as string[] : [])
  const leaves = ids.filter((id) => !hasKids.has(id))
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const id of ids) { const r = abs[id]; x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h) }
  const W = x1 - x0, H = y1 - y0
  const leafArea = leaves.reduce((s, id) => s + abs[id].w * abs[id].h, 0)
  let overlap = 0
  const sorted = [...leaves].sort((a, b) => abs[a].x - abs[b].x)
  for (let i = 0; i < sorted.length; i++) {
    const a = abs[sorted[i]]
    for (let j = i + 1; j < sorted.length && abs[sorted[j]].x < a.x + a.w; j++) {
      const b = abs[sorted[j]]
      if (b.y < a.y + a.h && a.y < b.y + b.h && Math.min(a.x + a.w, b.x + b.w) - b.x > 1) overlap++
    }
  }
  let outside = 0
  for (const id of ids) {
    const par = nodes[id].parentId
    if (!par || !nodes[par]) continue
    const c = abs[id], p = abs[par]
    if (c.x < p.x - 1 || c.y < p.y - 1 || c.x + c.w > p.x + p.w + 1 || c.y + c.h > p.y + p.h + 1) outside++
  }
  const visible = projectToVisibleGraph(nodes, relations)
  const score = computeCompositeScore(visible.nodes, visible.relations) as any
  return { size: `${Math.round(W)}x${Math.round(H)}`, area: +(W * H / Math.max(leafArea, 1)).toFixed(1), aspect: +(Math.max(W / H, H / W)).toFixed(2),
    cross: score.renderedCrossings, draw: score.renderedOverdraws, corridor: score.corridorCrowding ?? 0, overlap, out: outside }
}

const results: Record<string, unknown> = {}
for (const f of fixtures) {
  if (only && !f.name.includes(only)) continue
  const input = viewLayoutInput(undefined, byId(f.nodes), byId(f.relations), f.constraints as any)
  const t = Date.now()
  const res = await runSmartLayoutCore(input.nodes, input.relations, documentMetamodel(f.metamodel as any, f.nodes))
  const ms = Date.now() - t
  const after: Record<string, C4Node> = {}
  for (const [id, n] of Object.entries(input.nodes)) {
    const p = res.winner.positions[id]
    after[id] = p ? { ...n, x: p.x, y: p.y, width: p.width ?? n.width, height: p.height ?? n.height } : n
  }
  const m = { nodes: Object.keys(input.nodes).length, edges: Object.keys(input.relations).length, ...measure(after, input.relations), ms, winner: res.winner.name, distinct: new Set(res.candidates.map((c) => Math.round(c.score.composite))).size, candidates: res.candidates.length }
  results[f.name] = m
  if (dump) {
    // The winner as a model folder, to open in Studio.
    const doc: any = { nodes: f.nodes.map((n) => ({ ...n, ...(after[n.id] ? { x: after[n.id].x, y: after[n.id].y, width: after[n.id].width, height: after[n.id].height } : {}) })), relations: f.relations, metamodel: f.metamodel }
    for (const [path, content] of Object.entries(serializeToMdFolder(doc, f.name))) { const file = join(dump, f.name.replace(/\//g, '_'), path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, content as string) }
  }
  console.log(`${f.name.padEnd(38)} n ${String(m.nodes).padStart(4)} area ${String(m.area).padStart(6)} aspect ${String(m.aspect).padStart(5)} cross ${String(m.cross).padStart(6)} draw ${String(m.draw).padStart(5)} corr ${String(m.corridor).padStart(5)} overlap ${m.overlap} out ${m.out} ${String(ms).padStart(6)} ms  ${m.distinct}/${m.candidates} distinct  ${m.winner}`)
}
if (out) writeFileSync(out, JSON.stringify(results, null, 1))
