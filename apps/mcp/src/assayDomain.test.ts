import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FolderModel } from './folderModel'

/** Two code repositories, a TypeScript service with its schema and a VB6 point of sale, beside an empty central model. */
async function central() {
  const code = join(mkdtempSync(join(tmpdir(), 'assay-domain-')), 'code')
  const write = (repo: string, files: Record<string, string>) => {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(code, repo, path)), { recursive: true })
      writeFileSync(join(code, repo, path), text)
    }
    execFileSync('git', ['init', '-q'], { cwd: join(code, repo) })
  }
  write('orders', {
    'package.json': JSON.stringify({ name: 'orders', scripts: { start: 'node dist/server.js' }, dependencies: { express: '4' }, devDependencies: { typescript: '5', vitest: '4' } }),
    'db/schema.sql': [
      'CREATE TABLE customers (', '  id INTEGER PRIMARY KEY,', '  email VARCHAR(200)', ');', '',
      'CREATE TABLE orders (', '  id INTEGER PRIMARY KEY,', '  customer_id INTEGER REFERENCES customers(id),', "  status VARCHAR(20) CHECK (status IN ('new', 'paid', 'shipped'))", ');', '',
    ].join('\n'),
    'src/server.ts': [
      "import express from 'express'", "import { place, pay, ship } from './orders'", 'const app = express()',
      "app.post('/orders', place)", "app.post('/orders/:id/payment', pay)", "app.post('/orders/:id/shipment', ship)", '',
    ].join('\n'),
    'src/orders.ts': [
      "export type OrderStatus = 'new' | 'paid' | 'shipped'", '',
      'export async function place(req, res) {', "  const order = { customer: req.body.customer, status: 'new' as OrderStatus }",
      "  await db.run('INSERT INTO orders (customer_id, status) VALUES (?, ?)', order.customer, order.status)", '  res.status(201).json(order)', '}', '',
      'export async function pay(req, res) {', '  const order = await find(req.params.id)', "  order.status = 'paid'", '  await save(order)', '}', '',
      'export async function ship(req, res) {', '  const order = await find(req.params.id)', "  order.status = 'shipped'", '  await save(order)', '}', '',
    ].join('\n'),
  })
  write('pos', {
    'POS.vbp': 'Type=Exe\r\nForm=frmSale.frm\r\nName="POS"\r\n',
    'frmSale.frm': [
      'VERSION 5.00', 'Begin VB.Form frmSale', '   Caption         =   "Sale"', '   Begin VB.CommandButton cmdClose', '      Caption         =   "&Close the sale"', '   End', 'End',
      'Attribute VB_Name = "frmSale"', 'Private Sub cmdClose_Click()', '  db.Execute "UPDATE sales SET closed = 1 WHERE id = " & saleId', 'End Sub', '',
    ].join('\r\n'),
  })
  const root = join(dirname(code), 'architecture')
  mkdirSync(root)
  execFileSync('git', ['init', '-q'], { cwd: root })
  const model = await FolderModel.open(join(root, '.radical', 'model'))
  const call = async (name: string, input: unknown = {}) => model.call(name, input)
  const nodes = async () => JSON.parse((await call('search_model', { query: 'LIST NODES' })).text).rows as Array<{ id: string; type: string; label: string; parentId?: string } & Record<string, unknown>>
  const relations = async () => JSON.parse((await call('search_model', { query: 'LIST RELATIONS' })).text).rows as Array<{ relationType: string; sourceLabel: string; targetLabel: string } & Record<string, unknown>>
  const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'))
  await call('assay_start', { directories: ['../code'] })
  return { code, root, call, nodes, relations, json }
}

const ORDERS = 'orders:unit:.'
const POS = 'pos:unit:.'
const C4 = {
  elements: [
    { key: 'shop', type: 'system', label: 'Shop', facts: [ORDERS, POS], confidence: 'inferred' },
    { key: 'orders', type: 'container', label: 'Orders service', parent: 'shop', units: [ORDERS], facts: [ORDERS], confidence: 'observed' },
    { key: 'pos', type: 'container', label: 'Point of sale', parent: 'shop', units: [POS], facts: [POS], confidence: 'observed' },
  ],
}
const DOMAIN = {
  elements: [{ key: 'sales', type: 'domain', label: 'Sales', facts: ['orders:table:.:orders', 'orders:table:.:customers'], confidence: 'inferred' }],
  entities: [
    { key: 'customer', label: 'Customer', tables: ['orders:table:.:customers'], parent: 'sales' },
    { key: 'order', label: 'Order', tables: ['orders:table:.:orders'], parent: 'sales', references: [{ to: 'customer', cardinality: 'one' }] },
  ],
}
const route = (r: string) => `orders:entry:.:route:${r}`
const CODE = (lines: [number, number], text: string) => ({ repository: 'orders', file: 'src/orders.ts', lines, text })

describe('Radical Assay over MCP: the domain, processes and lifecycles', () => {
  it('writes entities from the tables, related by their foreign keys and realised by the containers that use them', async () => {
    const { call, nodes, relations, root, json } = await central()
    await call('assay_apply', { plan: C4 })
    const applied = await call('assay_apply', { plan: DOMAIN })
    expect(applied.ok).toBe(true)
    expect(applied.text).toContain('Wrote 1 element, 2 entities and 2 relations into the central model.')
    expect(applied.text).toContain('No element realises "Customer": no unit\'s code names their tables (a schema file is no use of them), though a stored routine may use them, and no element of the run holds those.')
    const all = await nodes()
    const sales = all.find((n) => n.label === 'Sales')!
    const order = all.find((n) => n.label === 'Order')!
    expect([sales.type, order.type, order.parentId === sales.id, order.kind]).toEqual(['domain', 'entity', true, 'aggregate-root'])
    expect(order.description).toBe('Table orders (SQL, db/schema.sql:6): id, customer_id, status.')
    expect((await relations()).filter((r) => r.relationType !== 'contains').map((r) => [r.relationType, r.sourceLabel, r.targetLabel]).sort()).toEqual([
      // Its code names orders; customers only its schema does.
      ['realises', 'Orders service', 'Order'], ['references', 'Order', 'Customer'],
    ])
    // A reference only the code shows is a relation of the same plan, inferred, citing the code.
    const lookup = await call('assay_apply', { plan: {
      entities: [{ key: 'sale', label: 'Sale', tables: ['pos:table:.:sales'], parent: sales.id }],
      relations: [{ from: 'sale', to: order.id, relationType: 'references', properties: { cardinality: 'many' }, citations: [{ repository: 'pos', file: 'frmSale.frm', lines: [10, 10], text: 'UPDATE sales SET closed = 1' }], confidence: 'inferred' }],
    } })
    expect(lookup.ok).toBe(true)
    expect((await relations()).find((r) => r.sourceLabel === 'Sale')).toMatchObject({ relationType: 'references', targetLabel: 'Order', cardinality: 'many' })
    const evidence = json(join(root, '.radical/assay/run.json')).written.find((w: { label: string; kind: string }) => w.kind === 'entity' && w.label === 'Order')
    expect([evidence.confidence, evidence.evidence]).toEqual(['observed', [{ fact: 'orders:table:.:orders', repository: 'orders', file: 'db/schema.sql', line: 6 }]])
    expect((await call('get_issues')).text).toMatch(/^No issues/)
  })

  it('refuses an entity relation no foreign key states, and an entity on no table, writing nothing', async () => {
    const { call, nodes } = await central()
    await call('assay_apply', { plan: C4 })
    const refused = await call('assay_apply', { plan: {
      ...DOMAIN,
      entities: [
        { key: 'customer', label: 'Customer', tables: ['orders:table:.:customers'], references: [{ to: 'order' }] },
        { key: 'order', label: 'Order', tables: ['orders:table:.:orders'], parent: 'sales' },
        { key: 'ghost', label: 'Ghost', tables: [] },
      ],
    } })
    expect(refused).toEqual({ ok: false, text: [
      'assay_apply: the plan is refused, nothing was written:',
      '- entities[0] (Customer): references order, but no foreign key of its tables references that entity\'s (a reference the code makes otherwise goes in relations, inferred, citing it)',
      '- entities[2] (Ghost): tables must list the table facts it is (assay_facts with kind tables); an entity no table backs is no entity of the code',
    ].join('\n') })
    expect((await nodes()).filter((n) => n.type === 'entity' || n.type === 'domain')).toEqual([])
  })

  it('writes a process with its steps in order, inferred, each on the entry point it rests on', async () => {
    const { call, nodes, relations, root, json } = await central()
    await call('assay_apply', { plan: C4 })
    const bare = await call('assay_apply', { plan: { processes: [{ key: 'p', label: 'Sell', parent: 'shop', steps: [{ key: 'x', label: 'Guess' }] }] } })
    expect(bare.text).toContain('- processes[0] (Sell).steps[0] (Guess): facts must list the ids of the facts it rests on, or citations the code or documents it quotes')
    const applied = await call('assay_apply', { plan: { processes: [{
      key: 'fulfil', label: 'Fulfil an order', parent: 'shop', description: 'From the order placed to its shipment.',
      steps: [
        { key: 'place', label: 'Place the order', performedBy: 'orders', facts: [route('POST /orders')] },
        { key: 'pay', label: 'Pay for it', performedBy: 'orders', facts: [route('POST /orders/:id/payment')], citations: [CODE([9, 11], "order.status = 'paid'")] },
        { key: 'ship', label: 'Ship it', performedBy: 'orders', facts: [route('POST /orders/:id/shipment')] },
      ],
    }] } })
    expect(applied.ok).toBe(true)
    expect(applied.text).toContain('Wrote 0 elements, 1 process of 3 steps and 3 relations into the central model (processes and state machines inferred, as read from the code: no proposal).')
    const all = await nodes()
    const process = all.find((n) => n.type === 'process')!
    expect(all.filter((n) => n.type === 'step').map((n) => [n.label, n.order, n.parentId === process.id]).sort((a, b) => Number(a[1]) - Number(b[1]))).toEqual([['Place the order', 1, true], ['Pay for it', 2, true], ['Ship it', 3, true]])
    expect((await relations()).filter((r) => r.relationType === 'performed-by').length).toBe(3)
    // A requirement names the process that meets it; accepted, the process satisfies it.
    const requirement = (processes: string[]) => ({ requirements: [{ key: `r-fulfil-${processes.length}`, label: 'Fulfil orders', satisfiedBy: 'orders', processes, properties: { action: 'the orders service shall take an order from placing to shipping' }, citations: [CODE([9, 11], "order.status = 'paid'")] }] })
    expect((await call('assay_apply', { plan: requirement(['fulfil', 'orders']) })).text).toContain('- requirements[0] (Fulfil orders): processes must list processes of the plan or the model that meet it')
    const proposed = await call('assay_apply', { plan: requirement(['fulfil']) })
    expect(proposed.text).toContain('requirement "Fulfil orders" (ubiquitous), satisfied by Orders service and the process Fulfil an order: the orders service shall take an order from placing to shipping')
    expect((await call('assay_answer', { proposal: 'P1', accept: true })).ok).toBe(true)
    expect((await relations()).filter((r) => r.relationType === 'satisfies').map((r) => [r.sourceLabel, r.targetLabel]).sort()).toEqual([['Fulfil an order', 'Fulfil orders'], ['Orders service', 'Fulfil orders']])
    const pay = json(join(root, '.radical/assay/run.json')).written.find((w: { label: string }) => w.label === 'Pay for it')
    expect([pay.kind, pay.confidence, pay.evidence.map((e: { fact?: string; quote?: string }) => e.fact ?? e.quote)]).toEqual(['step', 'inferred', [route('POST /orders/:id/payment'), "order.status = 'paid'"]])
  })

  it('writes the lifecycle of an entity from its status values, implemented by the container whose code sets them', async () => {
    const { call, nodes, relations, root, json } = await central()
    await call('assay_apply', { plan: C4 })
    await call('assay_apply', { plan: DOMAIN })
    const status = 'orders:state:.:orderstatus'
    const machine = {
      key: 'order-life', label: 'Order lifecycle', entity: 'order', facts: [status], initial: 'new',
      states: [{ key: 'new', label: 'New' }, { key: 'paid', label: 'Paid' }, { key: 'shipped', label: 'Shipped', kind: 'final' }],
      transitions: [{ from: 'new', to: 'paid', event: 'Payment received' }, { from: 'paid', to: 'shipped', event: 'Shipped', guard: 'paid in full' }],
    }
    const wrong = await call('assay_apply', { plan: { stateMachines: [{ ...machine, states: [...machine.states, { key: 'lost', label: 'Lost' }], transitions: [...machine.transitions, { from: 'shipped', to: 'lost' }] }] } })
    expect(wrong.text).toContain('- stateMachines[0] (Order lifecycle).states[3] (Lost): no state fact the machine cites holds "Lost" (new, paid, shipped); give its value, or cite the code that names it')
    expect(wrong.text).toContain('- stateMachines[0] (Order lifecycle).transitions[2] (shipped → lost): rests on nothing: no line of the code the state facts name sets lost; cite the code that makes it (citations)')
    // Paid and shipped are set by lines of the code; a cancellation no code makes rests on a quotation alone.
    const quote = CODE([1, 1], "export type OrderStatus = 'new'")
    const applied = await call('assay_apply', { plan: { stateMachines: [{
      ...machine,
      states: [...machine.states, { key: 'cancelled', label: 'Cancelled', kind: 'final', citations: [quote] }],
      transitions: [...machine.transitions, { from: 'new', to: 'cancelled', event: 'Cancelled', citations: [quote] }],
    }] } })
    expect(applied.ok).toBe(true)
    expect(applied.text).toContain('1 state machine of 4 states')
    expect(applied.text).toContain('Transitions: 2 rest on a line of the code that sets their target, 1 on a quotation the server could not match to such a line in the state facts (marked "quoted" in .radical/assay/run.json: read them again if the quotation does not show the target set).')
    const evidence = json(join(root, '.radical/assay/run.json')).written.filter((w: { basis?: string }) => w.basis).map((w: { label: string; basis: string }) => [w.label, w.basis])
    expect(evidence).toEqual([['Payment received', 'sets'], ['Shipped', 'sets'], ['Cancelled', 'quoted']])
    const all = await nodes()
    const life = all.find((n) => n.type === 'state-machine')!
    expect([life.label, life.parentId === all.find((n) => n.label === 'Sales')!.id]).toEqual(['Order lifecycle', true])
    expect(all.filter((n) => n.parentId === life.id).map((n) => [n.type, n.label, n.kind]).sort()).toEqual([
      ['event', 'Cancelled', undefined], ['event', 'Payment received', undefined], ['event', 'Shipped', undefined],
      ['pseudostate', 'Start', 'initial'], ['state', 'Cancelled', 'final'], ['state', 'New', 'normal'], ['state', 'Paid', 'normal'], ['state', 'Shipped', 'final'],
    ])
    const rels = await relations()
    expect(rels.filter((r) => ['transition', 'lifecycle-of', 'implements'].includes(r.relationType)).map((r) => [r.relationType, r.sourceLabel, r.targetLabel]).sort()).toEqual([
      ['implements', 'Orders service', 'Order lifecycle'], ['lifecycle-of', 'Order lifecycle', 'Order'],
      ['transition', 'New', 'Cancelled'], ['transition', 'New', 'Paid'], ['transition', 'Paid', 'Shipped'], ['transition', 'Start', 'New'],
    ])
    const paid = rels.find((r) => r.relationType === 'transition' && r.targetLabel === 'Paid')!
    expect(paid.event).toBe(all.find((n) => n.label === 'Payment received')!.id)
    expect((await call('get_issues')).text).toMatch(/^No issues/)
  })

  it('writes a pending test for a scenario drawn from the code, bound in the repository\'s mapping', async () => {
    const { code, call, nodes, json } = await central()
    await call('assay_apply', { plan: C4 })
    const proposed = await call('assay_apply', { plan: { requirements: [{
      key: 'r-pay', label: 'Record a payment', satisfiedBy: 'orders',
      properties: { ears_type: 'event-driven', trigger: 'a payment for an order arrives', action: 'the orders service shall mark the order paid' },
      scenarios: [{ key: 's-pay', label: 'Order marked paid', given: 'a new order', when: 'its payment arrives', then: 'the order is paid', citations: [CODE([9, 11], "order.status = 'paid'")] }],
    }] } })
    expect(proposed.text).toContain('    scenario "Order marked paid": given a new order, when its payment arrives, then the order is paid; drawn from the code (orders/src/orders.ts:9): no test checks it; accepted, a pending vitest test of it is written into orders')
    const accepted = await call('assay_answer', { proposal: 'P1', accept: true })
    expect(accepted.text).toContain('orders/tests/assay/record-a-payment.test.ts (pending tests: write their bodies)')
    const test = readFileSync(join(code, 'orders/tests/assay/record-a-payment.test.ts'), 'utf8')
    expect(test).toContain("import { describe, test } from 'vitest'")
    expect(test).toContain('  // Given a new order, when its payment arrives, then the order is paid. (From src/orders.ts:9-11.)\n  test.todo("Order marked paid")')
    const scenario = (await nodes()).find((n) => n.label === 'Order marked paid')!.id
    expect(json(join(code, 'orders/.radical/radical.json')).verifies).toEqual([{ element: scenario, name: 'Order marked paid', tests: ['tests/assay/record-a-payment.test.ts › Record a payment › Order marked paid'] }])
    expect((await call('assay_finish')).text).toContain('Pending tests written for scenarios drawn from the code: orders/tests/assay/record-a-payment.test.ts.')
  })

  it('writes only the scenario where the unit has no test framework, as a VB6 one', async () => {
    const { code, call, nodes, json } = await central()
    await call('assay_apply', { plan: C4 })
    const proposed = await call('assay_apply', { plan: { requirements: [{
      key: 'r-close', label: 'Close a sale', satisfiedBy: 'pos',
      properties: { ears_type: 'event-driven', trigger: 'the clerk closes a sale', action: 'the point of sale shall mark it closed' },
      scenarios: [{ key: 's-close', label: 'Sale closed', given: 'an open sale', when: 'the clerk presses Close the sale', then: 'the sale is closed', citations: [{ repository: 'pos', file: 'frmSale.frm', lines: [9, 10], text: 'UPDATE sales SET closed = 1' }] }],
    }] } })
    expect(proposed.text).toContain('no test checks it; POS (vb6) has no test framework Assay writes tests for: accepted, the scenario only')
    const accepted = await call('assay_answer', { proposal: 'P1', accept: true })
    expect(accepted.ok).toBe(true)
    expect(accepted.text).toContain('Its scenario from the code has no pending test: POS (vb6) has no test framework Assay writes tests for.')
    expect((await nodes()).some((n) => n.type === 'scenario' && n.label === 'Sale closed')).toBe(true)
    expect(existsSync(join(code, 'pos/tests'))).toBe(false)
    expect(json(join(code, 'pos/.radical/radical.json')).verifies).toBeUndefined()
  })
})
