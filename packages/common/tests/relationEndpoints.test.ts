import { describe, it, expect } from 'vitest'
import { checkAddNode, checkAddRelation, checkRemoveNodeType, checkRemoveNodeTypeFromMetamodel, checkRemoveRelationType, checkRemoveRelationTypeFromMetamodel, deleteNode, documentMetamodel, metamodelWithoutNodeType, checkNodeUpdate, checkPatchRelation, checkReplaceMetamodel, checkUnwrap, parentCandidates, patchNode, patchRelation, relationTypeOnMove, reparentNodes, type ModelState } from '../src/model'
import { builtInC4Metamodel, builtInGovernanceMetamodel, validateModel } from '../src/metamodel'
import { viewShowsEveryNode, type C4Node } from '../src/c4'

const node = (id: string, type: string): C4Node =>
  ({ id, type, label: id, description: '', x: 0, y: 0, width: 100, height: 60, collapsed: false }) as C4Node

function state(): ModelState {
  return {
    c4Nodes: {
      user: node('user', 'person'),
      admin: node('admin', 'person'),
      shop: node('shop', 'system'),
      adrOld: node('adrOld', 'adr'),
      adrNew: node('adrNew', 'adr'),
    },
    c4Relations: {
      uses: { id: 'uses', sourceId: 'user', targetId: 'shop', relationType: 'interacts' },
      rule: { id: 'rule', sourceId: 'adrNew', targetId: 'shop', relationType: 'constrains' },
    },
    views: {},
    activeViewId: null,
    metamodel: builtInGovernanceMetamodel(),
  }
}

describe('moving a relation end', () => {
  it('refuses a pair the metamodel does not allow', () => {
    expect(checkPatchRelation(state(), 'uses', { targetId: 'adrOld' })).toMatch(/Relation not allowed: Person → ADR/)
  })

  it('allows an allowed pair and ignores updates that keep both ends', () => {
    const s = state()
    expect(checkPatchRelation(s, 'uses', { sourceId: 'admin' })).toBeNull()
    expect(checkPatchRelation(s, 'uses', { label: 'buys from' })).toBeNull()
  })

  it('infers the relation type again when the old one no longer fits', () => {
    const s = state()
    patchRelation(s, 'rule', { targetId: 'adrOld' })
    expect(s.c4Relations.rule).toMatchObject({ targetId: 'adrOld', relationType: 'supersedes' })
  })

  it('keeps a relation type that still fits', () => {
    const s = state()
    patchRelation(s, 'uses', { sourceId: 'admin' })
    expect(s.c4Relations.uses.relationType).toBe('interacts')
  })
})

// A relation that names its type is one its type has between its ends. The
// check asked only whether any type has the pair, so a relation could be
// given a type add_relation refuses for it (person → system "constrains",
// system → system "transition"), and the validation did not see it.
describe('a relation and its own type', () => {
  it('cannot be given a type that does not have its pair', () => {
    const s = state()
    expect(checkPatchRelation(s, 'uses', { relationType: 'constrains' })).toMatch(/"Constrains" does not connect Person → Software System/)
    expect(checkPatchRelation(s, 'uses', { relationType: 'transition' })).toMatch(/does not connect/)
    // The type it has, and a change that leaves the type alone, are fine.
    expect(checkPatchRelation(s, 'uses', { relationType: 'interacts' })).toBeNull()
    expect(checkPatchRelation(s, 'uses', { label: 'buys', relationType: undefined })).toBeNull()
  })

  it('cannot be added with a type that does not have its pair', () => {
    expect(checkAddRelation(state(), { sourceId: 'user', targetId: 'shop', relationType: 'constrains' })).toMatch(/does not connect/)
    expect(checkAddRelation(state(), { sourceId: 'user', targetId: 'shop', relationType: 'interacts' })).toBeNull()
    expect(checkAddRelation(state(), { sourceId: 'user', targetId: 'shop' })).toBeNull()
  })

  it('is flagged by the validation when a model has one', () => {
    const s = state()
    s.c4Relations.uses.relationType = 'constrains'
    const issues = validateModel(s.c4Nodes, s.c4Relations, s.metamodel!)
    expect(issues.filter((i) => i.relationId === 'uses').map((i) => i.id)).toEqual(['bad-rel-type:uses'])
    expect(validateModel(state().c4Nodes, state().c4Relations, state().metamodel!).some((i) => i.id.startsWith('bad-rel'))).toBe(false)
  })
})

describe('retyping an element that has relations', () => {
  it('is refused when one of them has no place between the new pair', () => {
    // person → system exists; adr → system "interacts" does not, but adr →
    // system "constrains" does, so the relation stays and changes type.
    const s = state()
    expect(checkNodeUpdate(s, 'user', { type: 'adr' } as never)).toBeNull()
    // Nothing connects a scenario to a system.
    expect(checkNodeUpdate(s, 'user', { type: 'scenario' } as never)).toMatch(/Cannot change "user" to Scenario: its relation to "shop"/)
  })

  it('gives its relations the type that has the new pair', () => {
    const s = state()
    patchNode(s, 'user', { type: 'adr' } as never)
    expect(s.c4Relations.uses.relationType).toBe('constrains')
    expect(validateModel(s.c4Nodes, s.c4Relations, s.metamodel!).some((i) => i.id.startsWith('bad-rel'))).toBe(false)
  })
})

describe('the parent of an element', () => {
  // A system may lie inside a system, so the types alone allow a loop.
  const nested = (): ModelState => {
    const s = state()
    s.c4Nodes.inner = { ...node('inner', 'system'), parentId: 'shop' }
    s.c4Nodes.innermost = { ...node('innermost', 'system'), parentId: 'inner' }
    return s
  }

  it('cannot be the element itself, its child or a deeper descendant', () => {
    for (const parentId of ['shop', 'inner', 'innermost']) {
      expect(checkNodeUpdate(nested(), 'shop', { parentId })).toBe('Cannot move a node into itself or one of its descendants.')
    }
  })

  it('can be any other element the type may lie in', () => {
    const s = nested()
    s.c4Nodes.other = node('other', 'system')
    expect(checkNodeUpdate(s, 'inner', { parentId: 'other' })).toBeNull()
    expect(checkNodeUpdate(s, 'inner', { parentId: undefined })).toBeNull()
  })

  // Open points of runs 25–34 and 35–44: the card's Parent field listed
  // parents a move then refused, and Edit facts offered external systems.
  it('is offered only where a move takes it, and not in an external element', () => {
    const s = nested()
    s.c4Nodes.other = node('other', 'system')
    s.c4Nodes.bank = { ...node('bank', 'system'), external: true } as C4Node
    s.c4Nodes.api = { ...node('api', 'container'), parentId: 'inner' }
    expect(parentCandidates(s, 'inner').map((n) => n.id).sort()).toEqual(['other', 'shop'])
    expect(parentCandidates(s, 'api').map((n) => n.id).sort()).toEqual(['inner', 'innermost', 'other', 'shop'])
    // The external element it is in already stays on the list.
    s.c4Nodes.api.parentId = 'bank'
    expect(parentCandidates(s, 'api').map((n) => n.id)).toContain('bank')
  })
})

describe('unwrapping an element (its children move one level up)', () => {
  const grouped = (): ModelState => {
    const s = state()
    s.c4Nodes.group = { ...node('group', 'group'), parentId: 'shop' }
    s.c4Nodes.api = { ...node('api', 'container'), parentId: 'group' }
    return s
  }

  it('is refused when a group among them would hold what its new place does not allow', () => {
    // A group may lie at the root; the container in it may not.
    expect(checkUnwrap(grouped(), 'shop')).toMatch(/Cannot unwrap: Group "group" would be left where its Container "api" has no place/)
  })

  it('is refused when a child itself has no place there', () => {
    const s = state()
    s.c4Nodes.api = { ...node('api', 'container'), parentId: 'shop' }
    expect(checkUnwrap(s, 'shop')).toMatch(/Cannot unwrap: Container "api" is not allowed inside the canvas root/)
  })

  it('is allowed when everything keeps a place', () => {
    // The group goes: its container lies in the system directly.
    expect(checkUnwrap(grouped(), 'group')).toBeNull()
    expect(checkUnwrap(state(), 'shop')).toBeNull()
  })
})

describe('replacing the metamodel', () => {
  it('is refused while the model holds what the new one has no type for', () => {
    const refused = checkReplaceMetamodel(state(), builtInC4Metamodel())
    expect(refused).toMatch(/has no type for what the model holds/)
    expect(refused).toMatch(/2 /) // the two ADRs
    expect(refused).toMatch(/relation/) // "constrains"
  })

  it('is allowed when every element and relation has a type there', () => {
    const s = state()
    delete s.c4Nodes.adrOld
    delete s.c4Nodes.adrNew
    delete s.c4Relations.rule
    expect(checkReplaceMetamodel(s, builtInC4Metamodel())).toBeNull()
  })

  // Item 209: Reset to C4 while a milestone held an ADR; Restore to live
  // then brought back an unknown type.
  it('is refused while a milestone holds what the new one has no type for, or a view names it', () => {
    const s = state()
    delete s.c4Nodes.adrOld
    delete s.c4Nodes.adrNew
    delete s.c4Relations.rule
    const v1 = { name: 'v1', nodes: { adr: node('adr', 'adr') }, relations: {} }
    expect(checkReplaceMetamodel(s, builtInC4Metamodel(), [v1])).toBe('C4 (built-in) has no type ADR, and the milestone "v1" holds 1 element of type ADR: delete the milestone first.')
    s.views = { req: { id: 'req', name: 'Requirements', nodeIds: [], positions: {}, pipeline: { levels: [{ ways: [{ types: ['requirement'] }] }] } } as never }
    expect(checkReplaceMetamodel(s, builtInC4Metamodel())).toMatch(/has no type Requirement, and the filter of the view "Requirements" names Requirement/)
  })
})

describe('a property keyed like a field of every element', () => {
  it('is listed by the validation', () => {
    const s = state()
    s.metamodel!.nodeTypes.system.properties = [...(s.metamodel!.nodeTypes.system.properties ?? []), { key: 'type', label: 'Kind', type: 'text' }]
    const issues = validateModel(s.c4Nodes, s.c4Relations, s.metamodel!)
    expect(issues.find((i) => i.id === 'reserved-prop:system:type')?.message).toMatch(/"type" is a field every element has/)
  })
})

describe('two properties of a type with one key', () => {
  it('are listed by the validation', () => {
    const s = state()
    s.metamodel!.nodeTypes.system.properties = [
      ...(s.metamodel!.nodeTypes.system.properties ?? []),
      { key: 'prop5', label: 'A', type: 'text' },
      { key: 'prop5', label: 'B', type: 'text' },
    ]
    const issues = validateModel(s.c4Nodes, s.c4Relations, s.metamodel!)
    expect(issues.find((i) => i.id === 'dup-prop:system:prop5')?.message).toMatch(/two properties have the key "prop5"/)
  })
})

describe('a relation the model cannot hold', () => {
  it('to no element, or of an unknown type, is listed by the validation', () => {
    const s = state()
    s.c4Relations.ghost = { id: 'ghost', sourceId: 'user', targetId: 'nobody', relationType: 'interacts' }
    s.c4Relations.odd = { id: 'odd', sourceId: 'user', targetId: 'shop', relationType: 'nonexistent-type' }
    const ids = validateModel(s.c4Nodes, s.c4Relations, s.metamodel!).map((i) => i.id)
    expect(ids).toContain('rel-end-missing:ghost')
    expect(ids).toContain('unknown-rel-type:odd')
  })
})

describe('an element added into an element that is gone', () => {
  // A wizard finished after the element it was opened in had been undone:
  // the new element was added as a child of nothing.
  it('is refused', () => {
    const s = state()
    expect(checkAddNode(s, { ...node('x', 'adr'), parentId: 'gone' } as C4Node)).toMatch(/no longer exists/)
    expect(checkAddNode(s, node('x', 'adr'))).toBeNull()
  })
})

describe('a view whose listed elements are all deleted', () => {
  // An empty list means "every element": deleting what a view listed turned
  // it into a view of the whole model.
  it('shows none of the elements left', () => {
    const s = state()
    s.views = { v: { id: 'v', name: 'Only the shop', nodeIds: ['shop'], positions: {} } }
    deleteNode(s, 'shop')
    expect(s.views.v.nodeIds).toEqual([])
    expect(viewShowsEveryNode(s.views.v)).toBe(false)
    // A view that showed every element still does.
    s.views.all = { id: 'all', name: 'All', nodeIds: [], positions: {} }
    deleteNode(s, 'user')
    expect(viewShowsEveryNode(s.views.all)).toBe(true)
  })
})

describe('a document saved without a metamodel', () => {
  // A Hub blueprint downloaded as a file has none: it opened under C4, with
  // its mockups, requirements and ADRs as unknown types.
  it('opens under the Radical preset when it holds types only that preset has', () => {
    expect(documentMetamodel(undefined, [{ type: 'system' }, { type: 'mockup' }]).id).toBe('c4-ddd-governance-builtin')
    expect(documentMetamodel(undefined, [{ type: 'system' }, { type: 'container' }]).id).toBe('c4-builtin')
    expect(documentMetamodel(undefined).id).toBe('c4-builtin')
  })
})

describe('deleting a node type that others name', () => {
  const withBadge = () => {
    const mm = builtInGovernanceMetamodel()
    mm.nodeTypes.badge = { ...mm.nodeTypes.system, id: 'badge', label: 'Badge', builtin: false, properties: [] }
    mm.nodeTypes.card = { ...mm.nodeTypes.system, id: 'card', label: 'Card', builtin: false, allowedParents: ['badge', 'group'], properties: [] }
    mm.relationTypes.issues = { id: 'issues', label: 'Issues', allowedPairs: [{ from: 'badge', to: 'badge' }], builtin: false } as never
    mm.relationTypes.links = { id: 'links', label: 'Links', allowedPairs: [{ from: 'badge', to: 'card' }, { from: 'card', to: 'card' }], builtin: false } as never
    return mm
  }

  it('is refused when a relation type would be left with no pair (which means any pair)', () => {
    expect(checkRemoveNodeTypeFromMetamodel(withBadge(), 'badge')).toMatch(/"Issues" connects only Badge/)
  })

  it('is refused when a property points at the type', () => {
    const mm = withBadge()
    delete (mm.relationTypes as Record<string, unknown>).issues
    mm.nodeTypes.card.properties = [{ key: 'owner', label: 'Owner', type: 'ref', refType: 'badge' }]
    expect(checkRemoveNodeTypeFromMetamodel(mm, 'badge')).toMatch(/"Owner" of "Card" points at Badge/)
  })

  it('takes the type out of allowed parents and pairs', () => {
    const mm = withBadge()
    delete (mm.relationTypes as Record<string, unknown>).issues
    expect(checkRemoveNodeTypeFromMetamodel(mm, 'badge')).toBeNull()
    const next = metamodelWithoutNodeType(mm, 'badge')
    expect(next.nodeTypes.badge).toBeUndefined()
    expect(next.nodeTypes.card.allowedParents).toEqual(['group'])
    expect(next.relationTypes.links.allowedPairs).toEqual([{ from: 'card', to: 'card' }])
  })
})

// A viewpoint or a view that names a type lost it in silence: the
// viewpoint kept `subject: badge`, a view of it was an empty group, and
// nothing in Studio cleared it.
describe('deleting a type a viewpoint or a view names', () => {
  const withViewpoint = (viewpoint: Record<string, unknown>) => {
    const mm = builtInGovernanceMetamodel()
    mm.nodeTypes.badge = { ...mm.nodeTypes.system, id: 'badge', label: 'Badge', builtin: false, properties: [] }
    mm.relationTypes.awards = { id: 'awards', label: 'Awards', allowedPairs: [{ from: 'person', to: 'badge' }, { from: 'person', to: 'person' }], builtin: false } as never
    mm.viewpoints = [{ id: 'badges', label: 'Badge map', kind: 'static', pipeline: {}, ...viewpoint } as never]
    return mm
  }

  it('is refused while a viewpoint makes a view per element of it', () => {
    expect(checkRemoveNodeTypeFromMetamodel(withViewpoint({ subject: { types: ['badge', 'system'] } }), 'badge'))
      .toBe('the viewpoint "Badge map" makes a view per Badge: change or delete it first.')
  })

  it('is refused while a viewpoint\'s filter names it, as a node type or a relation type', () => {
    expect(checkRemoveNodeTypeFromMetamodel(withViewpoint({ pipeline: { levels: [{ ways: [{ types: ['person'] }] }, { ways: [{ types: ['badge'], via: { relationType: 'awards', direction: 'out' } }] }] } }), 'badge'))
      .toBe('the filter of the viewpoint "Badge map" names Badge: change or delete the viewpoint first.')
    expect(checkRemoveNodeTypeFromMetamodel(withViewpoint({ pipeline: { levels: [{ ways: [{}], filters: [{ kind: 'type', types: ['badge'] }] }] } }), 'badge')).toMatch(/names Badge/)
    const follows = withViewpoint({ pipeline: { levels: [{ ways: [{ types: ['person'] }] }, { ways: [{ via: { relationType: 'awards', direction: 'out' } }] }] } })
    expect(checkRemoveRelationTypeFromMetamodel(follows, 'awards')).toBe('the filter of the viewpoint "Badge map" names "Awards": change or delete the viewpoint first.')
    const tests = withViewpoint({ pipeline: { levels: [{ ways: [{}], filters: [{ kind: 'relation', relationType: 'awards', direction: 'in', has: true }] }] } })
    expect(checkRemoveRelationTypeFromMetamodel(tests, 'awards')).toMatch(/names "Awards"/)
    expect(checkRemoveRelationTypeFromMetamodel(withViewpoint({}), 'awards')).toBeNull()
    expect(checkRemoveNodeTypeFromMetamodel(withViewpoint({}), 'badge')).toBeNull()
  })

  it('is refused while a view\'s own filter names it', () => {
    const s = state()
    s.metamodel = withViewpoint({})
    s.views = { v: { id: 'v', name: 'Badges', nodeIds: [], positions: {}, pipeline: { levels: [{ ways: [{ types: ['badge'] }] }, { ways: [{ via: { relationType: 'awards', direction: 'in' } }] }] } } as never }
    expect(checkRemoveNodeType(s, 'badge')).toBe('the filter of the view "Badges" names Badge: change it first.')
    expect(checkRemoveRelationType(s, 'awards')).toBe('the filter of the view "Badges" names "Awards": change it first.')
  })

  it('is refused while a milestone holds an element or a relation of it', () => {
    // Restore to live, or opening the milestone, brought back an element of
    // an unknown type.
    const s = state()
    s.metamodel = withViewpoint({})
    const legacy = { id: 'legacy', type: 'badge', label: 'Legacy', collapsed: false, x: 0, y: 0, width: 100, height: 60 } as unknown as C4Node
    const milestone = { id: 'm1', name: 'As-is', timestamp: 0, nodes: { legacy }, relations: { aw: { id: 'aw', sourceId: 'legacy', targetId: 'legacy', relationType: 'awards' } } }
    expect(checkRemoveNodeType(s, 'badge', [milestone])).toBe('the milestone "As-is" holds 1 element of type Badge: delete the milestone first.')
    expect(checkRemoveRelationType(s, 'awards', [milestone])).toBe('the milestone "As-is" holds 1 relation of type "Awards": delete the milestone first.')
    expect(checkRemoveNodeType(s, 'badge', [{ ...milestone, nodes: {}, relations: {} }])).toBeNull()
  })

  it('is listed by the validation when a viewpoint names a type the metamodel lacks', () => {
    const mm = withViewpoint({ subject: { types: ['service'] }, pipeline: { levels: [{ ways: [{ types: ['service'] }] }, { ways: [{ via: { relationType: 'calls', direction: 'out' } }] }] } })
    const issues = validateModel({}, {}, mm).filter((i) => i.id.startsWith('viewpoint-'))
    expect(issues.map((i) => i.message)).toEqual([
      'Viewpoint "Badge map" names node type "service", which the metamodel does not have.',
      'Viewpoint "Badge map" names relation type "calls", which the metamodel does not have.',
    ])
  })
})

describe('a required property of a relation type', () => {
  // Only elements were checked: a relation without the value went unlisted.
  it('is listed when a relation lacks it', () => {
    const s = state()
    s.metamodel!.relationTypes.interacts.properties = [{ key: 'evidence', label: 'Evidence', type: 'text', required: true }]
    const issues = validateModel(s.c4Nodes, s.c4Relations, s.metamodel!)
    expect(issues.find((i) => i.id === 'missing-prop:uses:evidence')?.relationId).toBe('uses')
  })
})

// Item 212: a type added by hand to a preset folder's metamodel.json was an
// unknown type, and Studio's next save erased it.
describe('a preset metamodel with a type the preset lacks', () => {
  it('keeps the type, under a custom copy of the preset', () => {
    const stored = builtInGovernanceMetamodel()
    stored.nodeTypes.risk = { ...stored.nodeTypes.system, id: 'risk', label: 'Risk', builtin: false }
    stored.relationTypes.mitigates = { id: 'mitigates', label: 'Mitigates', allowedPairs: [{ from: 'adr', to: 'risk' }] }
    const mm = documentMetamodel(JSON.parse(JSON.stringify(stored)))
    expect(mm.nodeTypes.risk?.label).toBe('Risk')
    expect(mm.relationTypes.mitigates?.label).toBe('Mitigates')
    expect(mm.id).toBe('c4-ddd-governance-custom')
    expect(Object.keys(mm.nodeTypes)).toEqual(expect.arrayContaining(Object.keys(builtInGovernanceMetamodel().nodeTypes)))
    // Saved and opened again, it stays.
    expect(documentMetamodel(JSON.parse(JSON.stringify(mm))).nodeTypes.risk?.label).toBe('Risk')
    // Without one, the preset is the preset.
    expect(documentMetamodel(builtInGovernanceMetamodel()).id).toBe('c4-ddd-governance-builtin')
  })
})

// F-0018: an end moved onto a pair where several types fit left the relation
// with none, unasked; Studio asks, as for a relation drawn.
describe('the type of a relation whose end moves', () => {
  const entity = (id: string, kind: string): C4Node => ({ ...node(id, 'entity'), kind } as unknown as C4Node)
  const moved = (): ModelState => ({
    ...state(),
    c4Nodes: { line: entity('line', 'entity'), order: entity('order', 'aggregate-root'), customer: entity('customer', 'aggregate-root'), kept: node('kept', 'requirement') },
    c4Relations: { sat: { id: 'sat', sourceId: 'line', targetId: 'kept', relationType: 'satisfies' }, ref: { id: 'ref', sourceId: 'line', targetId: 'order', relationType: 'references' } },
  })
  it('is asked about where the one it has does not fit and several do', () => {
    expect(relationTypeOnMove(moved(), 'sat', { targetId: 'order' })).toEqual({ ask: ['part-of', 'references'] })
  })
  it('is the one that fits, the aggregate rules kept', () => {
    // part-of leads from a part to a root: between two roots only references.
    expect(relationTypeOnMove(moved(), 'sat', { sourceId: 'customer', targetId: 'order' })).toEqual({ type: 'references' })
  })
  it('is kept where it still fits, or the move gives one', () => {
    expect(relationTypeOnMove(moved(), 'ref', { targetId: 'customer' })).toEqual({})
    expect(relationTypeOnMove(moved(), 'sat', { targetId: 'order', relationType: 'part-of' })).toEqual({})
  })
})

describe('a relation to what holds it', () => {
  it('is refused either way round and when an end moves there, but a transition to an enclosing state is not', () => {
    const s = state()
    s.c4Nodes.api = { ...node('api', 'container'), parentId: 'shop' }
    s.c4Nodes.db = { ...node('db', 'database'), parentId: 'shop' }
    s.c4Relations.calls = { id: 'calls', sourceId: 'api', targetId: 'db', relationType: 'interacts' }
    expect(checkAddRelation(s, { sourceId: 'api', targetId: 'shop' })).toMatch(/shop holds api, and containment already joins them/)
    expect(checkAddRelation(s, { sourceId: 'shop', targetId: 'api', relationType: 'interacts' })).toMatch(/shop holds api/)
    expect(checkPatchRelation(s, 'calls', { targetId: 'shop' })).toMatch(/shop holds api/)
    // Siblings and an outside element are joined as before.
    expect(checkAddRelation(s, { sourceId: 'api', targetId: 'db' })).toBeNull()
    expect(checkAddRelation(s, { sourceId: 'user', targetId: 'api' })).toBeNull()
    // A state machine: Active holds Paying; leaving Paying for Active is SCXML.
    s.c4Nodes.sm = node('sm', 'state-machine')
    s.c4Nodes.active = { ...node('active', 'state'), parentId: 'sm' }
    s.c4Nodes.paying = { ...node('paying', 'state'), parentId: 'active' }
    expect(checkAddRelation(s, { sourceId: 'paying', targetId: 'active', relationType: 'transition' })).toBeNull()
  })
  it('goes when an element moves into what it relates to, with those of what it holds', () => {
    const s = state()
    s.c4Nodes.api = node('api', 'container')
    s.c4Nodes.ctl = { ...node('ctl', 'component'), parentId: 'api' }
    s.c4Nodes.pay = node('pay', 'system')
    s.c4Relations.a1 = { id: 'a1', sourceId: 'api', targetId: 'shop', relationType: 'interacts' }
    s.c4Relations.a2 = { id: 'a2', sourceId: 'ctl', targetId: 'shop', relationType: 'interacts' }
    s.c4Relations.a3 = { id: 'a3', sourceId: 'api', targetId: 'pay', relationType: 'interacts' }
    const removed = reparentNodes(s, ['api'], 'shop')
    expect(removed.map((r) => r.id).sort()).toEqual(['a1', 'a2'])
    expect(Object.keys(s.c4Relations)).not.toContain('a1')
    expect(Object.keys(s.c4Relations)).toContain('a3')
    expect(s.c4Nodes.api.parentId).toBe('shop')
  })
})
