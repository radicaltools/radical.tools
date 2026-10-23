import { describe, it, expect } from 'vitest'
import type { C4Node, C4Relation } from '../src/c4'
import { deleteNode, type ModelState } from '../src/model'
import { builtInGovernanceMetamodel, validateModel } from '../src/metamodel'

const node = (id: string, type: string, parentId?: string, extra: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label: id, x: 0, y: 0, width: 100, height: 60, collapsed: false, ...(parentId ? { parentId } : {}), ...extra }) as C4Node

/** A machine with two states, a transition triggered by `submitted` that
 *  raises `accepted` and `audited`, and a requirement whose precondition is
 *  the state `open`. */
function machine(): ModelState {
  const nodes = [
    node('m', 'state-machine'), node('open', 'state', 'm'), node('done', 'state', 'm', { kind: 'final' }),
    node('submitted', 'event', 'm'), node('accepted', 'event', 'm'), node('audited', 'event', 'm'),
    node('req', 'requirement', undefined, { ears_type: 'state-driven', precondition_state: 'open', action: 'do it' }),
  ]
  const t = { id: 't', sourceId: 'open', targetId: 'done', relationType: 'transition', label: '', technology: '', event: 'submitted', raises: ['accepted', 'audited'] } as C4Relation
  return {
    c4Nodes: Object.fromEntries(nodes.map((n) => [n.id, n])),
    c4Relations: { t },
    views: {}, activeViewId: null, metamodel: builtInGovernanceMetamodel(),
  }
}

const badRefs = (s: ModelState) => validateModel(s.c4Nodes, s.c4Relations, s.metamodel!).filter((i) => i.id.startsWith('bad-ref:'))

describe('deleting an element a reference names', () => {
  it('takes the trigger event out of the transitions it triggered', () => {
    const s = machine()
    deleteNode(s, 'submitted')
    expect((s.c4Relations.t as unknown as Record<string, unknown>).event).toBeUndefined()
    expect(badRefs(s).map((i) => i.message)).toEqual([])
  })

  it('keeps the other events a transition raises', () => {
    const s = machine()
    deleteNode(s, 'accepted')
    expect((s.c4Relations.t as unknown as Record<string, unknown>).raises).toEqual(['audited'])
    deleteNode(s, 'audited')
    expect((s.c4Relations.t as unknown as Record<string, unknown>).raises).toBeUndefined()
    expect(badRefs(s).map((i) => i.message)).toEqual([])
  })

  it('takes a deleted state out of a requirement\'s precondition', () => {
    const s = machine()
    s.c4Nodes.open2 = node('open2', 'state', 'm')
    s.c4Relations.t = { ...s.c4Relations.t, sourceId: 'open2' }
    deleteNode(s, 'open')
    expect((s.c4Nodes.req as unknown as Record<string, unknown>).precondition_state).toBeUndefined()
    expect(badRefs(s).map((i) => i.message)).toEqual([])
  })
})
