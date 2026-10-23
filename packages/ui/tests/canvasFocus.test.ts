import { it, expect } from 'vitest'
import type { Edge, Node } from 'reactflow'
import { canvasFocus, selectCanvasFocus } from '../src/store/canvasFocus'

const node = (id: string, parentNode?: string): Node => ({ id, parentNode, position: { x: 0, y: 0 }, data: {} })
const edge = (id: string, source: string, target: string): Edge => ({ id, source, target })

// shop ⊃ web, api;  user → web → api → db;  mail stands alone
const nodes = [node('user'), node('shop'), node('web', 'shop'), node('api', 'shop'), node('db'), node('mail')]
const edges = [edge('r1', 'user', 'web'), edge('r2', 'web', 'api'), edge('r3', 'api', 'db')]
const sorted = (s: Set<string>) => [...s].sort()

it('nothing selected: no focus', () => {
  expect(canvasFocus(nodes, edges, [], null)).toBeNull()
})

it('focus off: no focus', () => {
  const state = { rfNodes: nodes, rfEdges: edges, selectedNodeIds: ['user'], selectedEdgeId: null }
  expect(selectCanvasFocus({ ...state, selectionFocus: false })).toBeNull()
  // On again, the same selection is focused.
  expect(sorted(selectCanvasFocus({ ...state, selectionFocus: true })!.nodes)).toEqual(['shop', 'user', 'web'])
})

it('a selected node focuses its relations, their other ends and the containers they sit in', () => {
  const focus = canvasFocus(nodes, edges, ['user'], null)!
  expect(sorted(focus.edges)).toEqual(['r1'])
  expect(sorted(focus.nodes)).toEqual(['shop', 'user', 'web'])
})

it('a selected container focuses the relations of everything inside it', () => {
  const focus = canvasFocus(nodes, edges, ['shop'], null)!
  expect(sorted(focus.edges)).toEqual(['r1', 'r2', 'r3'])
  expect(sorted(focus.nodes)).toEqual(['api', 'db', 'shop', 'user', 'web'])
})

it('several selected nodes focus all their relations', () => {
  const focus = canvasFocus(nodes, edges, ['user', 'db'], null)!
  expect(sorted(focus.edges)).toEqual(['r1', 'r3'])
  expect(focus.nodes.has('mail')).toBe(false)
})

it('a selected relation focuses itself and its two ends', () => {
  const focus = canvasFocus(nodes, edges, [], 'r3')!
  expect(sorted(focus.edges)).toEqual(['r3'])
  expect(sorted(focus.nodes)).toEqual(['api', 'db', 'shop'])
})

it('a selection that is not on this canvas focuses nothing', () => {
  expect(canvasFocus(nodes, edges, ['elsewhere'], null)).toBeNull()
  expect(canvasFocus(nodes, edges, [], 'gone')).toBeNull()
})

it('elements the view hides take no part', () => {
  const hidden = nodes.map((n) => (n.id === 'db' ? { ...n, hidden: true } : n))
  const hiddenEdges = edges.map((e) => (e.id === 'r3' ? { ...e, hidden: true } : e))
  expect(canvasFocus(hidden, hiddenEdges, ['db'], null)).toBeNull()
  const focus = canvasFocus(hidden, hiddenEdges, ['api'], null)!
  expect(sorted(focus.edges)).toEqual(['r2'])
})
