import { describe, expect, it } from 'vitest'
import type { C4Node, C4Relation, DiagramView } from '../src/c4'
import { builtInGovernanceMetamodel } from '../src/metamodel'
import { createWikiDocument, type WikiContext } from '../src/wikiDocument'

const node = (id: string, type: string, extra = {}): C4Node =>
  ({ id, type, label: id, x: 0, y: 0, width: 100, height: 60, ...extra }) as C4Node
const relation = (id: string, sourceId: string, targetId: string, relationType: string, extra = {}): C4Relation =>
  ({ id, sourceId, targetId, relationType, ...extra }) as C4Relation
const view = (extra: Partial<DiagramView> = {}): DiagramView =>
  ({ id: 'wiki', name: 'Wiki', kind: 'wiki', nodeIds: [], positions: {}, ...extra })
function context(nodes: C4Node[], relations: C4Relation[] = []): WikiContext {
  return {
    nodes: Object.fromEntries(nodes.map((n) => [n.id, n])),
    relations: Object.fromEntries(relations.map((r) => [r.id, r])),
    metamodel: builtInGovernanceMetamodel(),
  }
}

describe('shared wiki document', () => {
  it('includes navigation ancestors, sorts containment and respects explicitly empty scope', () => {
    const ctx = context([node('system', 'system'), node('b', 'component', { parentId: 'system' }), node('a', 'component', { parentId: 'system' }), node('outside', 'system')])
    const wiki = createWikiDocument(view({ nodeIds: ['b', 'a'] }), ctx)
    expect(wiki.nodeList.map((n) => n.id)).toEqual(['system', 'b', 'a'])
    expect(wiki.roots.map((n) => n.id)).toEqual(['system'])
    expect(wiki.page('system').children.map((n) => n.id)).toEqual(['a', 'b'])
    expect(wiki.page('b').breadcrumb.map((n) => n.id)).toEqual(['system', 'b'])
    expect(() => wiki.page('outside')).toThrow('outside this wiki')
    expect(createWikiDocument(view({ empty: true }), ctx).nodeList).toEqual([])
    expect(createWikiDocument(null, ctx).nodeList).toHaveLength(4)
  })

  it('uses a requirement → incoming Verifies → scenario chain in navigation and page content', () => {
    const ctx = context([node('r1', 'requirement'), node('r2', 'requirement'), node('s', 'scenario'), node('outside', 'need')], [relation('v1', 's', 'r1', 'verifies'), relation('v2', 's', 'r2', 'verifies')])
    const wiki = createWikiDocument(view({ wikiFocusId: 'r1', wikiDepth: 1, pipeline: { levels: [
      { ways: [{ types: ['requirement'] }] },
      { ways: [{ types: ['scenario'], via: { relationType: 'verifies', direction: 'in' } }] },
    ] } }), ctx)
    expect(wiki.roots.map((n) => n.id)).toEqual(['r1', 'r2'])
    expect(wiki.navigationChildren.r1).toEqual(wiki.page('r1').children)
    expect(wiki.rows.map((r) => [r.node.id, r.depth, r.alsoIn])).toEqual([['r1', 0, 0], ['s', 1, 1], ['r2', 0, 0], ['s', 1, 1]])
    expect(wiki.page('r1').relationGroups[0].label).toBe('Verified by')
    expect(wiki.page('s').relationGroups[0].label).toBe('Verifies')
    expect(wiki.glossary.typeCounts).toEqual(new Map([['requirement', 2], ['scenario', 1]]))
    expect(wiki.glossary.relationCounts).toEqual(new Map([['verifies', 2]]))
  })

  it('applies chain filters to the shared scope before creating pages', () => {
    const ctx = context([node('r1', 'requirement', { ears_type: 'ubiquitous' }), node('r2', 'requirement', { ears_type: 'event-driven' })])
    const wiki = createWikiDocument(view({ pipeline: { levels: [{ ways: [{ types: ['requirement'] }], filters: [{ kind: 'property', key: 'ears_type', op: 'is', values: ['event-driven'] }] }] } }), ctx)
    expect(wiki.rows.map((r) => r.node.id)).toEqual(['r2'])
    expect(() => wiki.page('r1')).toThrow('outside this wiki')
  })

  it('keeps repeated element types within their pipeline levels instead of walking every graph path', () => {
    const nodes = Array.from({ length: 7 }, (_, i) => node(`c${i}`, 'component'))
    const relations = nodes.flatMap((source) => nodes
      .filter((target) => target.id !== source.id)
      .map((target) => relation(`${source.id}-${target.id}`, source.id, target.id, 'interacts')))
    const wiki = createWikiDocument(view({ pipeline: { levels: [
      { ways: [{ types: ['component'] }] },
      { ways: [{ types: ['component'], via: { relationType: 'interacts', direction: 'out' } }] },
    ] } }), context(nodes, relations))

    expect(wiki.rows).toHaveLength(49)
    expect(wiki.rows.filter((r) => r.depth === 0)).toHaveLength(7)
    expect(wiki.rows.filter((r) => r.depth === 1)).toHaveLength(42)
    expect(wiki.rows.every((r) => r.alsoIn === 6)).toBe(true)
    expect(wiki.rows.filter((r) => r.depth === 1).every((r) => !r.hasChildren)).toBe(true)
  })

  it('uses hierarchy relations for chapters and suppresses the redundant parent link only in a chapter', () => {
    const derives = relation('d', 'child', 'parent', 'derives')
    const ctx = context([node('parent', 'requirement'), node('child', 'requirement'), node('other', 'requirement')], [derives, relation('d2', 'child', 'other', 'derives')])
    const wiki = createWikiDocument(view(), ctx)
    expect(wiki.page('parent').children.map((n) => n.id)).toEqual(['child'])
    expect(wiki.page('parent').ownRelations).toEqual([])
    expect(wiki.page('child').ownRelations.map((r) => r.id)).toEqual(['d', 'd2'])
    expect(wiki.page('child', 'parent').ownRelations.map((r) => r.id)).toEqual(['d2'])
    expect(wiki.page('child')).toBe(wiki.page('child'))
    expect(wiki.page('child', 'parent')).not.toBe(wiki.page('child'))
  })

  it('classifies metamodel fields once and retains their definitions for Studio editors', () => {
    const ctx = context([node('c', 'component', { description: '**Lead**', owner: 'team', priority: 0, approved: true, references: ['s'], notes: 'Why?', mode: 'public', internal: 'hidden' }), node('s', 'scenario')])
    const def = ctx.metamodel!.nodeTypes.component
    def.properties = [
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'owner', label: 'Owner', type: 'text' },
      { key: 'priority', label: 'Priority', type: 'number' },
      { key: 'approved', label: 'Approved', type: 'boolean' },
      { key: 'references', label: 'References', type: 'ref', refType: 'scenario', multiple: true },
      { key: 'notes', label: 'Notes (optional)', type: 'text' },
      { key: 'blank', label: 'Blank', type: 'textarea' },
      { key: 'internal', label: 'Internal', type: 'textarea', visibleWhen: { key: 'mode', values: ['internal'] } },
    ]
    const page = createWikiDocument(view(), ctx).page('c')
    expect(page.lead).toMatchObject({ text: '**Lead**', markdown: true })
    expect(page.lead!.definition).toBe(def.properties[0])
    expect(page.facts.map((f) => [f.definition.key, f.text])).toEqual([['owner', 'team'], ['priority', '0'], ['approved', 'approved'], ['references', 's']])
    expect(page.facts[3].references).toEqual([{ id: 's', label: 's' }])
    expect(page.sections.map((f) => [f.title, f.text, f.markdown])).toEqual([['Notes', 'Why?', false], ['Blank', '', true]])
    expect(page.blocks.map((b) => b.kind)).toEqual(['lead', 'contents', 'section', 'section', 'children'])
    expect(page.bylineFacts.find((f) => f.key === 'approved')).toMatchObject({ label: '', text: 'approved' })
  })

  it('resolves requirement subject and state from the full model outside the wiki scope', () => {
    const ctx = context([
      node('r', 'requirement', { ears_type: 'state-driven', action: 'send a receipt', precondition_state: 'confirmed' }),
      node('engine', 'component', { label: 'Billing engine' }),
      node('confirmed', 'state', { label: 'Confirmed', parentId: 'lifecycle' }),
      node('lifecycle', 'state-machine'), node('order', 'entity', { label: 'Order' }),
    ], [relation('s', 'engine', 'r', 'satisfies'), relation('l', 'lifecycle', 'order', 'lifecycle-of')])
    const wiki = createWikiDocument(view({ nodeIds: ['r'] }), ctx)
    expect(wiki.nodeList.map((n) => n.id)).toEqual(['r'])
    expect(wiki.page('r').requirement).toMatchObject({ started: true, complete: true, subject: 'Billing engine', state: 'the Order is Confirmed', sentence: 'While the Order is Confirmed, Billing engine shall send a receipt.' })
    expect(wiki.page('r').sections.some((f) => f.definition.key === 'action')).toBe(false)
    expect(wiki.page('r').ownRelations).toEqual([])
  })

  it('retains an unstarted requirement for editing without its empty EARS type byline', () => {
    const wiki = createWikiDocument(view(), context([node('r', 'requirement', { ears_type: 'event-driven' })]))
    expect(wiki.page('r').requirement).toMatchObject({ started: false, complete: false })
    expect(wiki.page('r').blocks.some((b) => b.kind === 'requirement')).toBe(true)
    expect(wiki.page('r').bylineFacts).toEqual([])
  })

  it('groups relationship readings and details, scopes endpoints and ignores canvas-only edge hiding', () => {
    const ctx = context([node('r', 'requirement'), node('s', 'scenario'), node('outside', 'scenario')], [relation('v', 's', 'r', 'verifies', { label: 'checkout' }), relation('x', 'outside', 'r', 'verifies')])
    const wiki = createWikiDocument(view({ nodeIds: ['r', 's'], hiddenRelationIds: ['v'] }), ctx)
    const group = wiki.page('r').relationGroups[0]
    expect(group).toMatchObject({ label: 'Verified by', direction: 'in' })
    expect(group.entries).toHaveLength(1)
    expect(group.entries[0]).toEqual({ relation: ctx.relations.v, other: ctx.nodes.s, details: ['checkout'] })
    expect(wiki.glossary.relationCounts.get('verifies')).toBe(1)
  })

  it('keeps the unknown-type fallback and mockup block available to both renderers', () => {
    const ctx = context([node('c', 'component', { description: 'Fallback', technology: 'TypeScript', external: true }), node('m', 'mockup')])
    ctx.metamodel = null
    const wiki = createWikiDocument(view(), ctx)
    expect(wiki.page('c').lead?.text).toBe('Fallback')
    expect(wiki.page('c').facts.map((f) => f.text)).toEqual(['TypeScript', 'external'])
    expect(wiki.page('m').blocks.map((b) => b.kind)).toEqual(['lead', 'contents', 'wireframe', 'children'])
  })

  it('bounds cyclic hierarchy traversal and containment breadcrumbs', () => {
    const ctx = context([node('a', 'requirement'), node('b', 'requirement')], [relation('a-b', 'a', 'b', 'derives'), relation('b-a', 'b', 'a', 'derives')])
    expect(createWikiDocument(view(), ctx).rows.map((r) => r.node.id)).toEqual(['a', 'b', 'b', 'a'])
    ctx.nodes.a.parentId = 'b'; ctx.nodes.b.parentId = 'a'
    const wiki = createWikiDocument(view({ nodeIds: ['a'] }), ctx)
    expect(wiki.page('a').breadcrumb.map((n) => n.id)).toEqual(['b', 'a'])
  })

  it('builds a fresh document for an edit without mutating the input model', () => {
    const ctx = context([node('r', 'requirement', { action: 'save' })])
    const before = structuredClone(ctx)
    const first = createWikiDocument(view(), ctx)
    expect(first.page('r').requirement?.sentence).toBe('The system shall save.')
    expect(ctx).toEqual(before)
    const edited = { ...ctx, nodes: { r: node('r', 'requirement', { action: 'load' }) } }
    expect(createWikiDocument(view(), edited).page('r').requirement?.sentence).toBe('The system shall load.')
    expect(first.page('r').requirement?.sentence).toBe('The system shall save.')
  })
})
