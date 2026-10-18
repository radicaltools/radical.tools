import { describe, it, expect } from 'vitest'
import type { C4Node, C4Relation, DiagramView } from '../src/c4'
import { builtInGovernanceMetamodel, validateModel } from '../src/metamodel/index'
import { checkAddNode, checkAddRelation, insertNode, type ModelState } from '../src/model'
import { viewpointsOf } from '../src/viewpoints'
import { insertPlan, outlinePlan, processFlow, warnierEditable, warnierRows, warnierTree, type WarnierNode } from '../src/warnier'

const metamodel = builtInGovernanceMetamodel()

const node = (id: string, type: string, label: string, extra: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, collapsed: false, x: 0, y: 0, width: 200, height: 80, ...extra }) as C4Node
const rel = (id: string, relationType: string, sourceId: string, targetId: string): C4Relation => ({ id, relationType, sourceId, targetId })

/** Checkout: take the order, for each line reserve stock (1,n), pay by card
 *  or by invoice (⊕), then at once confirm and notify (+). Steps are listed
 *  out of order: their `order` puts them in place. */
const CHECKOUT: C4Node[] = [
  node('checkout', 'process', 'Checkout'),
  node('pay', 'step', 'Pay', { parentId: 'checkout', order: 3, children: 'choice' }),
  node('take', 'step', 'Take the order', { parentId: 'checkout', order: 1 }),
  node('reserve', 'step', 'Reserve stock', { parentId: 'checkout', order: 2, repeat: '1..n', condition: 'for each order line' }),
  node('card', 'step', 'By card', { parentId: 'pay', order: 1 }),
  node('invoice', 'step', 'By invoice', { parentId: 'pay', order: 2 }),
  node('finish', 'step', 'Finish', { parentId: 'checkout', order: 4, children: 'concurrent' }),
  node('confirm', 'step', 'Confirm', { parentId: 'finish' }),
  node('notify', 'step', 'Notify', { parentId: 'finish', repeat: '0..1' }),
]

const byId = <T extends { id: string }>(items: T[]): Record<string, T> => Object.fromEntries(items.map((n) => [n.id, n]))

/** label, repeat, mode and children, for a readable comparison. */
const shape = (items: WarnierNode[]): unknown[] => items.map((w) => [
  w.node.label, ...(w.repeat ? [w.repeat] : []), ...(w.condition ? [w.condition] : []), ...(w.children.length ? [w.mode, shape(w.children)] : []),
])

describe('process and step types', () => {
  it('a process of steps that repeat, are alternatives and run at once is valid, with what performs, satisfies and verifies it', () => {
    const nodes = [
      ...CHECKOUT,
      node('api', 'system', 'Payments'),
      node('req', 'requirement', 'Take payment', { ears_type: 'ubiquitous', action: 'The shop shall take the payment' }),
      node('sc', 'scenario', 'Card payment', { given: 'a cart', when: 'the customer pays', then: 'the order is paid' }),
    ]
    const relations = [
      rel('r1', 'performed-by', 'card', 'api'),
      rel('r2', 'satisfies', 'checkout', 'req'),
      rel('r3', 'verifies', 'sc', 'checkout'),
    ]
    const errors = validateModel(byId(nodes), byId(relations), metamodel).filter((issue) => issue.severity === 'error')
    expect(errors).toEqual([])
    expect(metamodel.nodeTypes.step.properties?.map((p) => p.key)).toEqual(['order', 'repeat', 'condition', 'children', 'description'])
  })

  it('a step runs once in sequence unless it says otherwise, and sits only in a process or a step', () => {
    const state: ModelState = { c4Nodes: byId([node('checkout', 'process', 'Checkout'), node('api', 'component', 'API'), node('req', 'requirement', 'R')]), c4Relations: {}, views: {}, activeViewId: null, metamodel }
    insertNode(state, 'take', { type: 'step', label: 'Take', parentId: 'checkout', collapsed: false, x: 0, y: 0, width: 200, height: 80 } as unknown as Omit<C4Node, 'id'>)
    expect(state.c4Nodes.take).toMatchObject({ repeat: '1', children: 'sequence' })
    expect(state.c4Nodes.checkout.type).toBe('process')
    expect(checkAddNode(state, { type: 'step', label: 'Loose', collapsed: false, x: 0, y: 0, width: 200, height: 80 } as unknown as Omit<C4Node, 'id'>)).toMatch(/Cannot place Step inside the canvas root/)
    expect(checkAddNode(state, { type: 'step', label: 'In API', parentId: 'api', collapsed: false, x: 0, y: 0, width: 200, height: 80 } as unknown as Omit<C4Node, 'id'>)).toMatch(/Cannot place Step inside/)
    expect(checkAddRelation(state, { sourceId: 'take', targetId: 'req', relationType: 'performed-by' })).toMatch(/Relation not allowed: Step → Requirement/)
    expect(checkAddRelation(state, { sourceId: 'take', targetId: 'api', relationType: 'performed-by' })).toBeNull()
  })

  it('the viewpoint Process (Warnier) shows the processes and steps in a Warnier view', () => {
    const viewpoint = viewpointsOf(metamodel).find((v) => v.id === 'process-warnier')
    expect(viewpoint).toMatchObject({ label: 'Process (Warnier)', group: 'Process', kind: 'warnier' })
  })
})

describe('warnierTree', () => {
  it('draws a process: steps in their order, what repeats, the alternatives and what runs at once', () => {
    const view: DiagramView = { id: 'v', name: 'Checkout', kind: 'warnier', nodeIds: [], positions: {}, pipeline: viewpointsOf(metamodel).find((v) => v.id === 'process-warnier')!.pipeline }
    const tree = warnierTree(warnierRows(view, { nodes: byId([...CHECKOUT, node('api', 'component', 'API')]), relations: [], metamodel }))
    expect(shape(tree)).toEqual([
      ['Checkout', 'sequence', [
        ['Take the order'],
        ['Reserve stock', '(1,n)', 'for each order line'],
        ['Pay', 'choice', [['By card', '(0,1)'], ['By invoice', '(0,1)']]],
        ['Finish', 'concurrent', [['Confirm'], ['Notify', '(0,1)']]],
      ]],
    ])
  })

  it('reads a state machine: a compound state\'s children are alternatives, a parallel state\'s regions run at once', () => {
    const nodes = [
      node('m', 'state-machine', 'Order'),
      node('init', 'pseudostate', '', { parentId: 'm', kind: 'initial' }),
      node('open', 'state', 'Open', { parentId: 'm' }),
      node('done', 'state', 'Done', { parentId: 'm', kind: 'parallel' }),
      node('paid', 'state', 'Payment', { parentId: 'done' }),
      node('shipped', 'state', 'Shipping', { parentId: 'done' }),
    ]
    const tree = warnierTree(warnierRows(undefined, { nodes: byId(nodes), relations: [], metamodel }))
    // The machine's states are alternatives: (0,1) under each (Warnier–Orr).
    expect(shape(tree)).toEqual([['Order', 'choice', [['Done', '(0,1)', 'concurrent', [['Payment'], ['Shipping']]], ['Open', '(0,1)']]]])
  })

  it('nests a chain as its levels say, and a one-level chain by containment', () => {
    const nodes = [
      node('need', 'need', 'Pay online'),
      node('r1', 'requirement', 'Take card'),
      node('r2', 'requirement', 'Send invoice'),
      node('shop', 'system', 'Shop'),
      node('api', 'container', 'API', { parentId: 'shop' }),
    ]
    const relations = [rel('d1', 'derives', 'r1', 'need'), rel('d2', 'derives', 'r2', 'need')]
    const ctx = { nodes: byId(nodes), relations, metamodel }
    const chain: DiagramView = { id: 'c', name: 'Needs', kind: 'warnier', nodeIds: [], positions: {}, pipeline: { levels: [
      { ways: [{ types: ['need'] }] },
      { ways: [{ via: { relationType: 'derives', direction: 'in' }, types: ['requirement'] }] },
    ] } }
    expect(shape(warnierTree(warnierRows(chain, ctx)))).toEqual([['Pay online', 'sequence', [['Send invoice'], ['Take card']]]])
    const c4: DiagramView = { id: 's', name: 'Systems', kind: 'warnier', nodeIds: [], positions: {}, pipeline: { levels: [{ ways: [{ types: ['system', 'container'] }] }] } }
    expect(shape(warnierTree(warnierRows(c4, ctx)))).toEqual([['Shop', 'sequence', [['API']]]])
  })
})

describe('outline edits', () => {
  const view: DiagramView = { id: 'v', name: 'Checkout', kind: 'warnier', nodeIds: [], positions: {}, pipeline: { levels: [{ ways: [{ types: ['process', 'step'] }] }] } }
  const tree = warnierTree(warnierRows(view, { nodes: byId(CHECKOUT), relations: [], metamodel }))
  const keyOf = (id: string): string => {
    const find = (items: WarnierNode[]): string | undefined => items.map((i) => (i.node.id === id ? i.key : find(i.children))).find(Boolean)
    return find(tree)!
  }
  const hasOrder = (type: string) => type === 'step'

  it('plans a step after another and inside one, numbering the siblings', () => {
    expect(insertPlan(tree, keyOf('take'), 'after', 'step', hasOrder)).toEqual({ parentId: 'checkout', order: 2, orders: { take: 1, reserve: 3, pay: 4, finish: 5 } })
    expect(insertPlan(tree, keyOf('pay'), 'inside', 'step', hasOrder)).toEqual({ parentId: 'pay', order: 3, orders: { card: 1, invoice: 2 } })
    // A new process after the root process: at the top, no order.
    expect(insertPlan(tree, keyOf('checkout'), 'after', 'process', hasOrder)).toEqual({ parentId: null, orders: {} })
  })

  it('moves up and down among the siblings, and not past either end', () => {
    expect(outlinePlan(tree, keyOf('pay'), 'up', hasOrder)).toEqual({ orders: { take: 1, pay: 2, reserve: 3, finish: 4 } })
    expect(outlinePlan(tree, keyOf('take'), 'down', hasOrder)).toEqual({ orders: { reserve: 1, take: 2, pay: 3, finish: 4 } })
    expect(outlinePlan(tree, keyOf('take'), 'up', hasOrder)).toBeNull()
    expect(outlinePlan(tree, keyOf('finish'), 'down', hasOrder)).toBeNull()
  })

  it('indents under the element before and outdents after the parent', () => {
    expect(outlinePlan(tree, keyOf('reserve'), 'indent', hasOrder)).toEqual({ parentId: 'take', orders: { take: 1, pay: 2, finish: 3, reserve: 1 } })
    expect(outlinePlan(tree, keyOf('invoice'), 'outdent', hasOrder)).toEqual({ parentId: 'checkout', orders: { card: 1, take: 1, reserve: 2, pay: 3, invoice: 4, finish: 5 } })
    expect(outlinePlan(tree, keyOf('take'), 'indent', hasOrder)).toBeNull()
    expect(outlinePlan(tree, keyOf('checkout'), 'outdent', hasOrder)).toBeNull()
  })

  it('edits a containment tree, and only renames a chain\'s', () => {
    expect(warnierEditable(view)).toBe(true)
    expect(warnierEditable(undefined)).toBe(true)
    expect(warnierEditable({ ...view, pipeline: { levels: [{ ways: [{ types: ['need'] }] }, { ways: [{ via: { relationType: 'derives', direction: 'in' } }] }] } })).toBe(false)
  })
})

describe('processFlow', () => {
  it('draws an arrow from each step to the next of a sequence, by order, and none among alternatives or concurrent parts', () => {
    const nodes = byId([...CHECKOUT, node('wrap', 'step', 'Wrap up', { parentId: 'checkout' })])
    expect(processFlow(nodes).map((a) => `${a.sourceId}>${a.targetId}`)).toEqual([
      'take>reserve', 'reserve>pay', 'pay>finish', 'finish>wrap',
    ])
    expect(processFlow(nodes)[0].id).toBe('flow:take>reserve')
  })
})
