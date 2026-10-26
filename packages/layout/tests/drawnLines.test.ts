/**
 * Layouts and their score see the lines the canvas draws (deriveRFEdges):
 * relations of elements a view does not list roll up onto their nearest
 * listed ancestor, one line per pair with all their names; relations
 * between two shown elements are a line each; orthogonal segments on one
 * line are spread apart.
 */
import { describe, it, expect } from 'vitest'
import { viewFrames, viewLayoutInput } from '../src/viewInput'
import { projectToVisibleGraph } from '../src/geometry'
import { separateParallelSegments } from '../src/edgeRouting'
import type { C4Node, C4Relation, DiagramView } from '@radical/common/c4'

const node = (id: string, parentId?: string): C4Node => ({ id, type: parentId ? 'component' : 'container', label: id, x: 0, y: 0, width: 200, height: 100, ...(parentId ? { parentId } : {}) }) as C4Node
const rel = (id: string, sourceId: string, targetId: string, label?: string): C4Relation => ({ id, sourceId, targetId, ...(label ? { label } : {}) }) as C4Relation
const byId = <T extends { id: string }>(xs: T[]) => Object.fromEntries(xs.map((x) => [x.id, x]))

describe('the lines a layout sees', () => {
  // Studio (with two components the view does not list) uses common twice;
  // Studio itself also bundles common.
  const nodes = byId([node('studio'), node('canvas', 'studio'), node('store', 'studio'), node('common')])
  const relations = byId([rel('r1', 'canvas', 'common', 'renders with'), rel('r2', 'store', 'common', 'keeps the model with'), rel('r3', 'studio', 'common', 'bundles'), rel('r4', 'studio', 'common', 'loads')])
  const view = { id: 'v', name: 'v', nodeIds: ['studio', 'common'], positions: {} } as DiagramView

  it('rolls relations of unlisted elements up onto a listed ancestor, one line with all their names', () => {
    const input = viewLayoutInput(view, nodes, relations)
    const lines = Object.values(input.relations)
    // Two direct relations, and one line for the two rolled up.
    expect(lines).toHaveLength(3)
    const rolledUp = lines.find((r) => r.id === 'r1')!
    expect(rolledUp).toMatchObject({ sourceId: 'studio', targetId: 'common' })
    expect(rolledUp.label).toBe('renders with\nkeeps the model with')
  })

  it('gives a rolled-up line the technology of its relations only when they share it', () => {
    const tech = (r1: string, r2: string) => {
      const withTech = { ...relations, r1: { ...relations.r1, technology: r1 }, r2: { ...relations.r2, technology: r2 } }
      const drawn = [viewLayoutInput(view, nodes, withTech).relations.r1, projectToVisibleGraph({ ...nodes, studio: { ...nodes.studio, collapsed: true } }, withTech).relations.r1]
      return drawn.map((r) => r.technology)
    }
    expect(tech('TypeScript', 'TypeScript')).toEqual(['TypeScript', 'TypeScript'])
    // The first relation's alone read as the line's.
    expect(tech('TypeScript', 'JSON')).toEqual([undefined, undefined])
  })

  it('holds shown elements in the containers they sit in, as frames no line ends at', () => {
    // The view lists the two components, not Studio: Studio is a frame.
    const components = { ...view, nodeIds: ['canvas', 'store', 'common'] }
    expect([...viewFrames(components, nodes, relations)]).toEqual(['studio'])
    const input = viewLayoutInput(components, nodes, relations)
    expect(Object.keys(input.nodes).sort()).toEqual(['canvas', 'common', 'store', 'studio'])
    // Studio's own relations end at it, which is not shown: no line.
    expect(Object.keys(input.relations).sort()).toEqual(['r1', 'r2'])
  })

  it('keeps every relation between two shown elements a line of its own', () => {
    const { relations: drawn } = projectToVisibleGraph(byId([node('a'), node('b')]), byId([rel('x', 'a', 'b', 'reads'), rel('y', 'a', 'b', 'writes')]))
    expect(Object.keys(drawn).sort()).toEqual(['x', 'y'])
  })

  it('spreads orthogonal segments that share a stretch of one line, and leaves the ports', () => {
    // Two routes running along y = 100 from x 100 to 300.
    const routes = new Map([
      ['a', [{ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 200 }]],
      ['b', [{ x: 100, y: 0 }, { x: 100, y: 100 }, { x: 400, y: 100 }, { x: 400, y: 200 }]],
    ])
    const moved = separateParallelSegments(routes)
    const ya = moved.get('a')![1].y, yb = moved.get('b')![1].y
    expect(Math.abs(ya - yb)).toBeGreaterThanOrEqual(7)
    // Still horizontal, and the ends at the ports where they were.
    for (const [id, pts] of moved) {
      expect(pts[1].y).toBe(pts[2].y)
      expect(pts[0]).toEqual(routes.get(id)![0])
      expect(pts[pts.length - 1]).toEqual(routes.get(id)![routes.get(id)!.length - 1])
    }
  })
})
