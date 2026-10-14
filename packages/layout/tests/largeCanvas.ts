import type { LabelEdge, LabelObstacle } from '../src/edgeLabels'

/**
 * A canvas the size of the Structure view of radical.tools' own model
 * (2026-10-14): about 1400 labelled edges, 1600 node rects, and long
 * orthogonal paths across a canvas tens of thousands of pixels wide, many
 * of them crowding into a few busy regions. Deterministic.
 */
export function largeCanvas(): { edges: LabelEdge[]; obstacles: LabelObstacle[] } {
  let seed = 7
  const rnd = () => ((seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648) / 2_147_483_648)
  const obstacles: LabelObstacle[] = []
  const centres: Array<{ x: number; y: number }> = []
  for (let i = 0; i < 800; i++) {
    const x = Math.floor(rnd() * 120) * 220
    const y = Math.floor(rnd() * 40) * 160
    obstacles.push({ x, y, w: 160, h: 80 }, { x, y, w: 160, h: 24, weight: 3 })
    centres.push({ x: x + 80, y: y + 40 })
  }
  // Wide groups, as the layers and systems of the model are.
  for (let i = 0; i < 20; i++) obstacles.push({ x: rnd() * 4000, y: rnd() * 6000, w: 8000 + rnd() * 20_000, h: 60, weight: 2 })
  const hubs = centres.slice(0, 12)
  const edges: LabelEdge[] = []
  for (let i = 0; i < 1400; i++) {
    const a = centres[Math.floor(rnd() * centres.length)]
    const b = rnd() < 0.6 ? hubs[Math.floor(rnd() * hubs.length)] : centres[Math.floor(rnd() * centres.length)]
    const midX = (a.x + b.x) / 2 + (rnd() - 0.5) * 200
    const points = [a, { x: midX, y: a.y }, { x: midX, y: b.y }, b]
    edges.push({ id: `e${i}`, points, anchor: { x: midX, y: (a.y + b.y) / 2 }, size: { w: 90 + rnd() * 80, h: 22 + Math.floor(rnd() * 2) * 18 } })
  }
  return { edges, obstacles }
}
