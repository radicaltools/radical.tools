import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { POLYGLOT, legacy, shop } from '@radical/assay/fixtures'
import { FolderModel } from './folderModel'

/** A central repository beside the fixture's three code repositories, its
 *  model empty; the server bound to it. */
async function central(code: () => string = shop) {
  const dir = code()
  const root = join(dirname(dir), 'architecture')
  mkdirSync(root)
  execFileSync('git', ['init', '-q'], { cwd: root })
  const model = await FolderModel.open(join(root, '.radical', 'model'))
  const call = async (name: string, input: unknown = {}) => model.call(name, input)
  const nodes = async () => JSON.parse((await call('search_model', { query: 'LIST NODES' })).text).rows as Array<{ id: string; type: string; label: string; parentId?: string } & Record<string, unknown>>
  const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'))
  return { dir, root, call, nodes, json }
}

const WEB = 'storefront:unit:apps/web'
const ORDERS = 'orders-service:unit:.'
const SHOWS = 'storefront:test:apps/web/tests/orders.test.js › orders › shows an order'
const PLACES = 'storefront:test:apps/web/tests/orders.test.js › orders › places an order'

const C4 = {
  elements: [
    { key: 'shop', type: 'system', label: 'Shop', facts: [WEB, ORDERS, 'shop-lib:unit:.'], confidence: 'inferred' },
    { key: 'orders', type: 'container', label: 'Orders service', parent: 'shop', technology: 'Express', units: [ORDERS], facts: [ORDERS], confidence: 'observed' },
    { key: 'web', type: 'webapp', label: 'Storefront', parent: 'shop', technology: 'React', units: [WEB], facts: [WEB], confidence: 'observed' },
  ],
  relations: [
    { from: 'web', to: 'orders', relationType: 'interacts', label: 'Reads and places orders', facts: [`link:http:${WEB}->${ORDERS}`], confidence: 'inferred' },
  ],
}

const REQUIREMENTS = {
  requirements: [
    {
      key: 'r-show', label: 'Show an order', satisfiedBy: 'web',
      properties: { ears_type: 'event-driven', trigger: 'a customer opens an order', action: 'the storefront shall show the order' },
      scenarios: [{ key: 's-show', label: 'Order shown', given: 'an order', when: 'the customer opens it', then: 'it is shown', tests: [SHOWS] }],
    },
    {
      key: 'r-place', label: 'Place an order', satisfiedBy: 'web',
      properties: { ears_type: 'event-driven', trigger: 'a customer places an order', action: 'the storefront shall send it to the orders service' },
      // Its test failed in the reports: a scenario rests on tests that pass, so it is checked by the one that does.
      scenarios: [{ key: 's-place', label: 'Order placed', given: 'a basket', when: 'the customer places it', then: 'the order is sent', tests: [SHOWS] }],
    },
  ],
}

describe('Radical Assay over MCP', () => {
  it('starts a run on a directory of repositories: facts per repository, links, the procedure', async () => {
    const { dir, call } = await central()
    const started = await call('assay_start', { directories: ['../shop'] })
    expect(started.ok).toBe(true)
    expect(started.text).toContain('Assay run on 3 repositories; the central model is .radical/model')
    expect(started.text).toContain(`  - ${WEB}: @storefront/web (npm app: it has a dev script; Node.js, React)`)
    expect(started.text).toContain(`link:http:${WEB}->${ORDERS}: ${WEB} → ${ORDERS}, http, inferred: GET /api/orders/{id}, POST /api/orders`)
    expect(started.text).toContain('2. C4 stage.')
    for (const repo of ['orders-service', 'shop-lib', 'storefront']) expect(existsSync(join(dir, repo, '.radical/assay/facts.json'))).toBe(true)

    const tests = JSON.parse((await call('assay_facts', { unit: WEB, kind: 'tests' })).text)
    expect(tests.facts.map((f: { id: string }) => f.id)).toEqual([SHOWS, PLACES])
    expect((await call('assay_facts', { repository: 'nowhere' })).text).toBe('assay_facts: no repository or source nowhere in the run (orders-service, shop-lib, storefront)')
  })

  it('refuses a plan without evidence, or one the metamodel forbids, writing nothing', async () => {
    const { call, nodes } = await central()
    await call('assay_start', { directories: ['../shop'] })
    const bare = await call('assay_apply', { plan: { elements: [{ key: 'x', type: 'container', label: 'X', facts: [], confidence: 'observed' }] } })
    expect(bare).toEqual({ ok: false, text: 'assay_apply: the plan is refused, nothing was written:\n- elements[0] (X): facts must list the ids of the facts it rests on\n- elements[0] (X): observed, but cites no unit, API, service or database fact that states it' })
    const forbidden = await call('assay_apply', { plan: { ...C4, relations: [{ from: 'shop', to: 'orders', relationType: 'part-of', facts: [`link:http:${WEB}->${ORDERS}`], confidence: 'inferred' }] } })
    expect(forbidden.ok).toBe(false)
    expect(forbidden.text).toMatch(/^assay_apply: the plan is refused, nothing was written:\n- relations shop → orders: /)
    const misplaced = await call('assay_apply', { plan: { elements: [
      { key: 'c1', type: 'container', label: 'C1', units: [ORDERS], facts: [], confidence: 'observed' },
      { key: 'c2', type: 'container', label: 'C2', units: [WEB], facts: [], confidence: 'observed' },
    ] } })
    expect(misplaced.ok).toBe(false)
    expect(misplaced.text.split('\n').slice(0, 2)).toEqual(['assay_apply: the plan is refused, nothing was written:', '- elements "c1" (C1): Cannot place Container inside the canvas root. Allowed parents: Software System, Group.'])
    expect(misplaced.text).toContain('- elements "c2" (C2): Cannot place Container')
    expect(await nodes()).toEqual([])
  })

  it('writes a plan into the central model, maps the code repositories, keeps the evidence beside the model', async () => {
    const { dir, root, call, nodes, json } = await central()
    await call('assay_start', { directories: ['../shop'] })
    const applied = await call('assay_apply', { plan: C4 })
    expect(applied.ok).toBe(true)
    expect(applied.text).toContain('Wrote 3 elements and 1 relations into the central model.')
    const written = await nodes()
    expect(written.map((n) => [n.type, n.label]).sort()).toEqual([['container', 'Orders service'], ['system', 'Shop'], ['webapp', 'Storefront']])
    const id = (label: string) => written.find((n) => n.label === label)!.id
    // Nothing of the evidence is in the model.
    expect(JSON.stringify(written)).not.toContain('unit:')

    expect(json(join(dir, 'orders-service/.radical/radical.json'))).toEqual({
      model: { repo: '../../architecture' },
      implements: [{ element: id('Orders service'), name: 'Orders service', paths: ['.'] }],
    })
    expect(json(join(dir, 'storefront/.radical/radical.json')).implements).toEqual([{ element: id('Storefront'), name: 'Storefront', paths: ['apps/web'] }])
    expect(existsSync(join(dir, 'shop-lib/.radical/radical.json'))).toBe(false)

    const run = json(join(root, '.radical/assay/run.json'))
    expect(run.format).toBe('radical-assay-run/1')
    expect(run.repositories.map((r: { name: string; dir: string }) => [r.name, r.dir])).toEqual([['orders-service', '../shop/orders-service'], ['shop-lib', '../shop/shop-lib'], ['storefront', '../shop/storefront']])
    expect(run.written.find((w: { label: string }) => w.label === 'Orders service')).toMatchObject({
      id: id('Orders service'), kind: 'element', confidence: 'observed',
      evidence: [{ fact: ORDERS, repository: 'orders-service', file: 'package.json', line: 2 }],
    })
    expect(run.written.find((w: { kind: string }) => w.kind === 'relation')).toMatchObject({ confidence: 'inferred', facts: [`link:http:${WEB}->${ORDERS}`] })
  })

  it('writes a requirement only when the user accepts it, with its scenarios and their tests', async () => {
    const { dir, call, nodes, json } = await central()
    await call('assay_start', { directories: ['../shop'] })
    await call('assay_apply', { plan: C4 })
    const proposed = await call('assay_apply', { plan: REQUIREMENTS })
    expect(proposed.ok).toBe(true)
    expect(proposed.text).toContain('- P1: requirement "Show an order" (event-driven), satisfied by Storefront: when a customer opens an order, the storefront shall show the order')
    expect(proposed.text).toContain('    scenario "Order shown": given an order, when the customer opens it, then it is shown; tests: apps/web/tests/orders.test.js › orders › shows an order')
    expect((await nodes()).filter((n) => n.type === 'requirement' || n.type === 'scenario')).toEqual([])

    const accepted = await call('assay_answer', { proposal: 'P1', accept: true, changes: { label: 'Show one order' } })
    expect(accepted.ok).toBe(true)
    expect(accepted.text).toMatch(/P1 added: requirement "Show one order" \([\w-]+\) with 1 scenario in Shop\./)
    expect((await call('assay_answer', { proposal: 'P2', accept: false })).text).toBe('P2 left out: nothing of it was written.')
    expect((await call('assay_answer', { proposal: 'P1', accept: true })).text).toBe('assay_answer: P1 was accepted already')

    const all = await nodes()
    const shop = all.find((n) => n.label === 'Shop')!.id
    expect(all.filter((n) => ['need', 'requirement', 'scenario'].includes(n.type)).map((n) => [n.type, n.label, n.parentId === shop]).sort()).toEqual([
      ['need', 'Found in the code', true], ['requirement', 'Show one order', true], ['scenario', 'Order shown', true],
    ])
    const scenario = all.find((n) => n.label === 'Order shown')!.id
    const relations = JSON.parse((await call('search_model', { query: 'LIST RELATIONS' })).text).rows.map((r: { relationType: string; sourceLabel?: string; source?: { label: string } }) => r.relationType).sort()
    expect(relations).toEqual(['derives', 'interacts', 'satisfies', 'verifies'])
    expect(json(join(dir, 'storefront/.radical/radical.json')).verifies).toEqual([{ element: scenario, name: 'Order shown', tests: ['apps/web/tests/orders.test.js › orders › shows an order'] }])
    expect((await call('get_issues')).text).toMatch(/^No issues/)
    expect((await call('assay_finish')).text).toContain('wrote 3 elements and 1 relations between them, 1 requirements, 1 scenarios, 0 needs from documents and the need Found in the code and 0 decisions into .radical/model; each requirement, scenario, need and decision with its own relations (satisfies, verifies, derives, constrains).\nProposals: 1 accepted, 1 left out, 0 waiting.')
  })

  it('needs a run first', async () => {
    const { call } = await central()
    expect((await call('assay_apply', { plan: C4 })).text).toBe('assay_apply: no Assay run; start one with assay_start')
    expect((await call('assay_start', { directories: ['../nowhere'] })).text).toMatch(/^assay_start: \.\.\/nowhere is no directory/)
  })

  it('writes inferred elements of code no extractor reads, on the code the agent quotes, checked', async () => {
    const { dir, root, call, nodes, json } = await central(legacy)
    const started = await call('assay_start', { directories: ['../legacy'] })
    expect(started.text).toContain('billing-vb6 (../legacy/billing-vb6, no commit): 1 unit, 4 dependencies, 1 database, 1 table.')
    expect(started.text).toContain('Code no reader covers (COBOL, Delphi, PowerBuilder')
    const quote = { repository: 'billing-vb6', file: 'Billing.vbp', lines: [1, 8], text: 'ExeName32="Billing.exe"' }
    const plan = (text: string) => ({ plan: {
      elements: [
        { key: 'billing', type: 'system', label: 'Billing', citations: [quote], confidence: 'inferred' },
        { key: 'app', type: 'container', label: 'Billing app', technology: 'VB6', parent: 'billing', paths: [{ repository: 'billing-vb6', path: './' }], citations: [{ ...quote, text }], confidence: 'inferred' },
      ],
    } })
    const wrong = await call('assay_apply', plan('Type=OleDll'))
    expect(wrong).toEqual({ ok: false, text: 'assay_apply: the plan is refused, nothing was written:\n- elements[1] (Billing app): cites billing-vb6/Billing.vbp:1-8, whose lines do not hold "Type=OleDll"' })
    expect(await nodes()).toEqual([])

    expect((await call('assay_apply', plan('Type=Exe'))).ok).toBe(true)
    const app = (await nodes()).find((n) => n.label === 'Billing app')!
    expect(json(join(dir, 'billing-vb6/.radical/radical.json'))).toEqual({
      model: { repo: '../../architecture' },
      implements: [{ element: app.id, name: 'Billing app', paths: ['.'] }],
    })
    expect(json(join(root, '.radical/assay/run.json')).written.find((w: { id: string }) => w.id === app.id)).toMatchObject({
      confidence: 'inferred', facts: [],
      evidence: [{ quote: 'Type=Exe', repository: 'billing-vb6', file: 'Billing.vbp', line: 1, lines: [1, 8] }],
    })
  })

  it('reads the lines of a run\'s file, numbered, and nothing outside the run', async () => {
    const { dir, call } = await central()
    writeFileSync(join(dir, 'outside.txt'), 'secret')
    await call('assay_start', { directories: ['../shop'] })
    const read = await call('assay_read', { repository: 'orders-service', file: 'openapi.yaml', from: 1, to: 5 })
    expect(read.ok).toBe(true)
    const lines = read.text.split('\n')
    expect(lines[0]).toMatch(/^orders-service\/openapi\.yaml, lines 1–5 of \d+ \(next: from 6\):$/)
    expect(lines.slice(1).map((l) => l.slice(0, 3))).toEqual(['1  ', '2  ', '3  ', '4  ', '5  '])
    expect(lines[1]).toBe(`1  ${readFileSync(join(dir, 'orders-service', 'openapi.yaml'), 'utf8').split('\n')[0]}`)
    expect(await call('assay_read', { repository: 'orders-service', file: '../outside.txt' })).toEqual({ ok: false, text: 'assay_read: orders-service has no file ../outside.txt' })
    expect((await call('assay_read', { repository: 'nowhere', file: 'x' })).ok).toBe(false)
    expect(await call('assay_read', { repository: 'orders-service', file: 'openapi.yaml', from: 5, to: 3 })).toEqual({ ok: false, text: 'assay_read: to (3) comes before from (5)' })
    // A folder, or none, lists the files to read, hidden ones aside.
    const listed = (await call('assay_read', { repository: 'storefront' })).text.split('\n')
    expect(listed[0]).toMatch(/^storefront\/: \d+ files, 1–\d+ listed:$/)
    expect(listed).toContain('apps/web/src/orders.js')
    expect(listed.some((l) => l.startsWith('.git'))).toBe(false)
    expect((await call('assay_read', { repository: 'storefront', file: 'apps/web', from: 2 })).text.split('\n')[0]).toMatch(/^storefront\/apps\/web\/: \d+ files, 2–\d+ listed:$/)
  })

  it('reads a folder of code with no repository, and writes no .radical/radical.json into it', async () => {
    const { root, call } = await central()
    const code = join(dirname(root), 'catalog-code')
    cpSync(join(POLYGLOT, 'catalog'), code, { recursive: true })
    const started = await call('assay_start', { directories: ['../catalog-code'] })
    expect(started.text).toContain('catalog-code is no git repository: nothing is written into it (its facts: .radical/assay/facts/catalog-code.json).')
    expect(existsSync(join(root, '.radical/assay/facts/catalog-code.json'))).toBe(true)
    expect(existsSync(join(code, '.radical'))).toBe(false)
    const unit = JSON.parse((await call('assay_facts', { repository: 'catalog-code', kind: 'units' })).text).facts[0]
    const applied = await call('assay_apply', { plan: { elements: [
      { key: 'shop', type: 'system', label: 'Shop', facts: [unit.id], confidence: 'inferred' },
      { key: 'catalog', type: 'container', label: 'Catalog', parent: 'shop', units: [unit.id], facts: [], confidence: 'observed' },
    ] } })
    expect(applied.ok).toBe(true)
    expect(applied.text).toContain('catalog-code is no git repository: its .radical/radical.json is not written')
    expect(existsSync(join(code, '.radical/radical.json'))).toBe(false)
  })

  it('proposes a need and a decision a document states, and writes the requirement that derives from the need', async () => {
    const { dir, root, call, nodes, json } = await central()
    mkdirSync(join(dir, 'handover'))
    writeFileSync(join(dir, 'handover', 'goals.md'), '# Goals\n\nCustomers see their orders at any time.\n\n## Decisions\n\nThe storefront calls the orders service over HTTP.\n')
    const started = await call('assay_start', { directories: ['../shop'], sources: ['../shop/handover'] })
    expect(started.text).toContain('Assay run on 3 repositories and 1 source of documents')
    expect(started.text).toContain('  - handover:doc:goals.md: Goals (2 headings)')
    expect(existsSync(join(root, '.radical/assay/sources/handover/goals.md'))).toBe(true)
    await call('assay_apply', { plan: C4 })
    const goal = { repository: 'handover', file: 'goals.md', lines: [3, 3], text: 'Customers see their orders at any time.' }
    const http = { repository: 'handover', file: 'goals.md', lines: [7, 7], text: 'The storefront calls the orders service over HTTP.' }
    const applied = await call('assay_apply', { plan: {
      needs: [{ key: 'n-see', label: 'See orders', description: 'Customers see their orders at any time.', properties: { kind: 'brief' }, citations: [goal] }],
      decisions: [{ key: 'd-http', label: 'Orders over HTTP', properties: { context: 'The storefront needs orders.', decision: 'The storefront calls the orders service over HTTP.', status: 'accepted' }, constrains: ['web'], citations: [http] }],
      requirements: [{ key: 'r-see', label: 'See orders at any time', satisfiedBy: 'web', need: 'n-see', properties: { ears_type: 'ubiquitous', action: 'the storefront shall show a customer\'s orders at any time' }, citations: [goal] }],
    } })
    expect(applied.ok).toBe(true)
    expect(applied.text).toContain('- P1: need "See orders": Customers see their orders at any time.\n    from handover/goals.md:3: "Customers see their orders at any time."')
    expect(applied.text).toContain('- P2: decision (ADR) "Orders over HTTP", accepted, constrains Storefront: The storefront calls the orders service over HTTP.')
    expect(applied.text).toContain('- P3: requirement "See orders at any time" (ubiquitous), satisfied by Storefront, derived from P1: the storefront shall show a customer\'s orders at any time\n    no scenario: it rests on the code or documents it cites')
    const before = (await nodes()).length
    expect(await call('assay_answer', { proposal: 'P3', accept: true })).toEqual({ ok: false, text: 'assay_answer: P3 derives from P1 ("See orders"); answer P1 first' })
    expect((await nodes()).length).toBe(before)

    expect((await call('assay_answer', { proposal: 'P1', accept: true })).text).toMatch(/^P1 added: need "See orders"/)
    expect((await call('assay_answer', { proposal: 'P2', accept: true, changes: { properties: { status: 'proposed' } } })).text).toMatch(/^P2 added: decision \(ADR\) "Orders over HTTP"/)
    expect((await call('assay_answer', { proposal: 'P3', accept: true })).text).toMatch(/^P3 added: requirement "See orders at any time" \([\w-]+\) with 0 scenarios in Shop\./)
    const all = await nodes()
    const need = all.find((n) => n.label === 'See orders')!
    const adr = all.find((n) => n.label === 'Orders over HTTP')!
    const req = all.find((n) => n.label === 'See orders at any time')!
    expect(need).toMatchObject({ type: 'need', kind: 'brief' })
    expect(adr).toMatchObject({ type: 'adr', status: 'proposed', decision: 'The storefront calls the orders service over HTTP.' })
    expect(all.some((n) => n.label === 'Found in the code')).toBe(false)
    const relations = JSON.parse((await call('search_model', { query: 'LIST RELATIONS' })).text).rows as Array<{ sourceId: string; targetId: string; relationType: string }>
    const web = all.find((n) => n.label === 'Storefront')!.id
    expect(relations).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceId: req.id, targetId: need.id, relationType: 'derives' }),
      expect.objectContaining({ sourceId: adr.id, targetId: web, relationType: 'constrains' }),
      expect.objectContaining({ sourceId: web, targetId: req.id, relationType: 'satisfies' }),
    ]))
    const run = json(join(root, '.radical/assay/run.json'))
    expect(run.sources).toEqual([{ name: 'handover', dir: '.radical/assay/sources/handover', origin: realpathSync(join(dir, 'handover')) }])
    expect(run.written.find((w: { id: string }) => w.id === adr.id)).toMatchObject({ kind: 'decision', confidence: 'hypothesis', accepted: 'changed', evidence: [{ quote: http.text, repository: 'handover', file: 'goals.md', line: 7, lines: [7, 7] }] })
    expect((await call('assay_finish')).text).toContain('1 requirements, 0 scenarios, 1 needs from documents and 1 decisions')
  })

  it('adds sources to a running run, replacing a source given again', async () => {
    const { dir, call } = await central()
    mkdirSync(join(dir, 'notes2'))
    writeFileSync(join(dir, 'notes2', 'a.md'), '# A\n')
    await call('assay_start', { directories: ['../shop'] })
    expect((await call('assay_add_sources', { sources: ['../shop/notes2'] })).text).toContain('  - notes2:doc:a.md: A (1 heading)')
    writeFileSync(join(dir, 'notes2', 'b.md'), '# B\n')
    expect((await call('assay_add_sources', { sources: [join(dir, 'notes2')] })).text).toContain('notes2 (kept in .radical/assay/sources/notes2')
    const docs = JSON.parse((await call('assay_facts', { kind: 'documents', repository: 'notes2' })).text)
    expect(docs.facts.map((f: { id: string }) => f.id)).toEqual(['notes2:doc:a.md', 'notes2:doc:b.md'])
    expect(await call('assay_add_sources', { sources: ['../shop/none'] })).toEqual({ ok: false, text: 'assay_add_sources: no source taken:\n- ../shop/none does not exist' })
  })

  it('finds what a proposal names when it is answered: one naming a proposal still waiting waits for it', async () => {
    const { call, nodes } = await central()
    await call('assay_start', { directories: ['../shop'] })
    await call('assay_apply', { plan: C4 })
    await call('assay_apply', { plan: { requirements: [REQUIREMENTS.requirements[0]] } })
    const decision = await call('assay_apply', { plan: { decisions: [{ key: 'd-show', label: 'Show orders fast', properties: { decision: 'Orders are shown from a cache.' }, constrains: ['r-show'], facts: [WEB] }] } })
    expect(decision.text).toContain('- P2: decision (ADR) "Show orders fast", constrains P1 "Show an order": Orders are shown from a cache.')
    expect(await call('assay_answer', { proposal: 'P2', accept: true })).toEqual({ ok: false, text: 'assay_answer: P2 constrains r-show: it names P1 ("Show an order"); answer P1 first' })
    expect((await call('assay_answer', { proposal: 'P1', accept: true })).ok).toBe(true)
    // The governance metamodel lets a decision constrain C4 elements only: now the metamodel says why.
    expect((await call('assay_answer', { proposal: 'P2', accept: true })).text).toBe('assay_answer: P2 could not be written, nothing was:\n- it constrains Show an order: add_relation: relationType "constrains" does not allow adr → requirement')
    expect((await nodes()).some((n) => n.label === 'Show orders fast')).toBe(false)
  })

  it('derives a requirement from the need of its own plan, though a need left out had that key', async () => {
    const { dir, call, nodes } = await central()
    mkdirSync(join(dir, 'handover'))
    writeFileSync(join(dir, 'handover', 'goals.md'), '# Goals\n\nCustomers see their orders at any time.\n')
    await call('assay_start', { directories: ['../shop'], sources: ['../shop/handover'] })
    await call('assay_apply', { plan: C4 })
    const goal = { repository: 'handover', file: 'goals.md', lines: [3, 3], text: 'Customers see their orders at any time.' }
    await call('assay_apply', { plan: { needs: [{ key: 'n', label: 'First', description: 'First reading.', citations: [goal] }] } })
    await call('assay_answer', { proposal: 'P1', accept: false })
    const again = await call('assay_apply', { plan: {
      needs: [{ key: 'n', label: 'See orders', description: 'Customers see their orders at any time.', citations: [goal] }],
      requirements: [{ key: 'r', label: 'See orders', satisfiedBy: 'web', need: 'n', properties: { ears_type: 'ubiquitous', action: 'the storefront shall show a customer\'s orders' }, citations: [goal] }],
    } })
    expect(again.text).toContain('derived from P2')
    expect(await call('assay_answer', { proposal: 'P3', accept: true })).toEqual({ ok: false, text: 'assay_answer: P3 derives from P2 ("See orders"); answer P2 first' })
    expect((await call('assay_answer', { proposal: 'P2', accept: true })).ok).toBe(true)
    expect((await call('assay_answer', { proposal: 'P3', accept: true })).text).toMatch(/^P3 added: requirement "See orders" \([\w-]+\) with 0 scenarios/)
    const all = await nodes()
    expect(all.filter((n) => n.type === 'need').map((n) => n.label)).toEqual(['See orders'])
    const relations = JSON.parse((await call('search_model', { query: 'LIST RELATIONS WHERE relationType = "derives"' })).text).rows as Array<{ sourceId: string; targetId: string }>
    expect(relations).toEqual([expect.objectContaining({ sourceId: all.find((n) => n.type === 'requirement')!.id, targetId: all.find((n) => n.type === 'need')!.id })])
  })

  it('refuses a plan that builds an element in a source, or derives a requirement from what is no need', async () => {
    const { dir, call, nodes } = await central()
    mkdirSync(join(dir, 'handover'))
    writeFileSync(join(dir, 'handover', 'goals.md'), '# Goals\n\nCustomers see their orders at any time.\n')
    await call('assay_start', { directories: ['../shop'], sources: ['../shop/handover'] })
    await call('assay_apply', { plan: C4 })
    const web = (await nodes()).find((n) => n.label === 'Storefront')!.id
    const goal = { repository: 'handover', file: 'goals.md', lines: [3, 3], text: 'Customers see their orders at any time.' }
    const refused = await call('assay_apply', { plan: {
      elements: [{ key: 'docs', type: 'container', label: 'Docs', parent: 'shop', paths: [{ repository: 'handover', path: 'goals.md' }], citations: [goal], confidence: 'inferred' }],
      requirements: [{ key: 'r', label: 'See orders', satisfiedBy: 'web', need: web, properties: { ears_type: 'ubiquitous', action: 'the storefront shall show orders' }, citations: [goal] }],
    } })
    expect(refused).toEqual({ ok: false, text: [
      'assay_apply: the plan is refused, nothing was written:',
      '- elements[0] (Docs): names handover/goals.md, a source of documents; an element is built in the code',
      `- requirements[0] (See orders): need ${web} is neither a key of the plan's needs, a need waiting for an answer, nor a need of the model`,
    ].join('\n') })
  })

  it('writes a requirement no code satisfies yet, and derives one from the need the user names', async () => {
    const { dir, call, nodes } = await central()
    mkdirSync(join(dir, 'handover'))
    writeFileSync(join(dir, 'handover', 'goals.md'), '# Goals\n\nA customer pays before the order ships.\n')
    await call('assay_start', { directories: ['../shop'], sources: ['../shop/handover'] })
    const c4 = await call('assay_apply', { plan: C4 })
    expect(c4.text).toMatch(/ 1 relations? created\.| Relation ID: /)
    const pay = { repository: 'handover', file: 'goals.md', lines: [3, 3], text: 'A customer pays before the order ships.' }
    await call('assay_apply', { plan: {
      needs: [{ key: 'n-pay', label: 'Pay first', description: 'A customer pays before the order ships.', citations: [pay] }],
      requirements: [
        { key: 'r-pay', label: 'Pay before shipping', parent: 'shop', need: 'n-pay', properties: { ears_type: 'ubiquitous', action: 'the shop shall ship no order before it is paid' }, citations: [pay] },
        REQUIREMENTS.requirements[0],
      ],
    } })
    expect((await call('assay_answer', { proposal: 'P1', accept: true })).ok).toBe(true)
    const unsatisfied = await call('assay_answer', { proposal: 'P2', accept: true })
    expect(unsatisfied.text).toMatch(/^P2 added: requirement "Pay before shipping" \([\w-]+\) with 0 scenarios in Shop\./)
    expect((await call('assay_answer', { proposal: 'P3', accept: true, changes: { need: 'P1' } })).ok).toBe(true)
    const all = await nodes()
    const need = all.find((n) => n.label === 'Pay first')!
    const relations = JSON.parse((await call('search_model', { query: 'LIST RELATIONS' })).text).rows as Array<{ sourceId: string; targetId: string; relationType: string }>
    const payReq = all.find((n) => n.label === 'Pay before shipping')!
    const show = all.find((n) => n.label === 'Show an order')!
    expect(relations.filter((r) => r.targetId === payReq.id && r.relationType === 'satisfies')).toEqual([])
    expect(relations).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceId: payReq.id, targetId: need.id, relationType: 'derives' }),
      expect.objectContaining({ sourceId: show.id, targetId: need.id, relationType: 'derives' }),
    ]))
    expect(all.some((n) => n.label === 'Found in the code')).toBe(false)
    expect(await call('assay_answer', { proposal: 'P9', accept: true })).toMatchObject({ ok: false })
  })
})

