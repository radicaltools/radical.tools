import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkPlan, extractRepository, factIndex, linkRepositories, parsePlan, takeSources } from '../src/index'
import { REPOSITORIES, shop } from './shop'

function run() {
  const dir = shop()
  const repos = REPOSITORIES.map((r) => extractRepository(join(dir, r)))
  const links = linkRepositories(repos)
  return { facts: factIndex(repos, links), links }
}

const SOUND = {
  elements: [
    { key: 'shop', type: 'system', label: 'Shop', facts: ['shop-lib:unit:.', 'orders-service:unit:.', 'storefront:unit:apps/web'], confidence: 'inferred' },
    { key: 'orders', type: 'container', label: 'Orders service', parent: 'shop', units: ['orders-service:unit:.'], facts: ['orders-service:unit:.'], confidence: 'observed' },
    { key: 'web', type: 'webapp', label: 'Storefront', parent: 'shop', units: ['storefront:unit:apps/web'], facts: ['storefront:unit:apps/web'], confidence: 'observed' },
  ],
  relations: [
    { from: 'web', to: 'orders', relationType: 'interacts', label: 'Reads and places orders', facts: ['link:http:storefront:unit:apps/web->orders-service:unit:.'], confidence: 'inferred' },
  ],
  requirements: [{
    key: 'r-show', label: 'Show an order', satisfiedBy: 'web',
    properties: { ears_type: 'event-driven', trigger: 'a customer opens an order', action: 'the storefront shall show the order' },
    scenarios: [{ key: 's-show', label: 'Order shown', given: 'an order', when: 'it is opened', then: 'it is shown', tests: ['storefront:test:apps/web/tests/orders.test.js › orders › shows an order'] }],
  }],
}

describe('radical assay: the plan', () => {
  it('accepts a plan every claim of which cites the run\'s facts', () => {
    const { facts } = run()
    const { plan, problems } = parsePlan(SOUND)
    expect(problems).toEqual([])
    expect(checkPlan(plan, facts, () => false)).toEqual([])
  })

  it('names every claim no fact backs, and every reference to nothing', () => {
    const { facts } = run()
    const { plan } = parsePlan({
      elements: [
        { key: 'orders', type: 'container', label: 'Orders', facts: [], confidence: 'observed' },
        { key: 'ghost', type: 'container', label: 'Ghost', facts: ['shop-lib:unit:nowhere'], confidence: 'inferred', parent: 'nothing' },
        { key: 'lib', type: 'component', label: 'Lib', facts: ['link:package:storefront:unit:apps/web->shop-lib:unit:.'], confidence: 'observed' },
        { key: 'orders', type: 'container', label: 'Twice', facts: ['orders-service:unit:.'], confidence: 'hypothesis' },
      ],
      relations: [
        { from: 'lib', to: 'orders', facts: ['link:http:storefront:unit:apps/web->orders-service:unit:.'], confidence: 'observed' },
      ],
      requirements: [{ key: 'r', label: 'R', satisfiedBy: 'model-id', properties: {}, scenarios: [{ key: 's', label: 'S', given: 'g', when: 'w', then: 't', tests: ['shop-lib:unit:.'] }] }],
    })
    expect(checkPlan(plan, facts, (id) => id === 'model-id')).toEqual([
      'elements[3]: key "orders" is used twice',
      'elements[0] (Orders): facts must list the ids of the facts it rests on',
      'elements[0] (Orders): observed, but cites no unit, API, service, database or stored routine fact that states it',
      'elements[1] (Ghost): cites shop-lib:unit:nowhere, which is no fact of the run',
      'elements[1] (Ghost): parent nothing is neither a key of the plan nor an id of the model',
      'elements[2] (Lib): observed, but cites no unit, API, service, database or stored routine fact that states it',
      'elements[3] (Twice): confidence must be observed or inferred (a hypothesis goes in as a requirement for the user)',
      'relations[0] (lib → orders): observed, but cites no dependency or observed link that states it',
      'requirements[0] (R): properties must hold the EARS action ("the system shall …") and its ears_type',
      'requirements[0] (R), scenario 1 (S): shop-lib:unit:. is no test of the run',
    ])
  })

  it('refuses a relation whose cited link joins other units, or a call the wrong way, and a scenario on a test that failed', () => {
    const { facts } = run()
    const { plan } = parsePlan({
      elements: [
        { key: 'orders', type: 'container', label: 'Orders', units: ['orders-service:unit:.'], facts: [], confidence: 'observed' },
        { key: 'lib', type: 'component', label: 'Lib', units: ['shop-lib:unit:.'], facts: [], confidence: 'observed' },
        { key: 'web', type: 'webapp', label: 'Web', units: ['storefront:unit:apps/web'], facts: [], confidence: 'observed' },
      ],
      relations: [
        // The storefront's dependency on the library, cited for the orders service.
        { from: 'orders', to: 'lib', facts: ['link:package:storefront:unit:apps/web->shop-lib:unit:.'], confidence: 'observed' },
        { from: 'web', to: 'lib', facts: ['link:package:storefront:unit:apps/web->shop-lib:unit:.'], confidence: 'observed' },
        // A library drawn as bundled into what uses it: the package link joins them the other way, and holds.
        { from: 'lib', to: 'web', label: 'bundled into', facts: ['link:package:storefront:unit:apps/web->shop-lib:unit:.'], confidence: 'observed' },
        // A call does not: the orders service does not call the storefront.
        { from: 'orders', to: 'web', facts: ['link:http:storefront:unit:apps/web->orders-service:unit:.'], confidence: 'inferred' },
      ],
      requirements: [{ key: 'r', label: 'Place', satisfiedBy: 'web', properties: { ears_type: 'ubiquitous', action: 'the storefront shall place orders' },
        scenarios: [{ key: 's', label: 'Placed', given: 'g', when: 'w', then: 't', tests: ['storefront:test:apps/web/tests/orders.test.js › orders › places an order'] }] }],
    })
    expect(checkPlan(plan, facts, () => false)).toEqual([
      'relations[0] (orders → lib): the links and dependencies it cites join neither of its ends to the other',
      'relations[0] (orders → lib): observed, but cites no dependency or observed link that states it',
      'relations[3] (orders → web): the links and dependencies it cites join neither of its ends to the other',
      'requirements[0] (Place), scenario 1 (Placed): storefront:test:apps/web/tests/orders.test.js › orders › places an order failed in the reports; a scenario rests on tests that pass: leave the test out of it, or the scenario, and propose the requirement with the code it is drawn from (citations) and no scenarios',
    ])
  })

  it('takes needs, decisions and requirements drawn from documents as hypotheses, and no document for an observed claim', async () => {
    const dir = shop()
    const repos = REPOSITORIES.map((r) => extractRepository(join(dir, r)))
    mkdirSync(join(dir, 'handover'))
    writeFileSync(join(dir, 'handover', 'goals.md'), '# Goals\n\nOrders ship within a day of payment.\n\n## Decisions\n\nWe keep orders in PostgreSQL.\n')
    const { sources } = await takeSources(['handover'], dirname(join(dir, 'handover')), new Set(REPOSITORIES))
    const facts = factIndex([...repos, ...sources], linkRepositories(repos))
    const goal = { repository: 'handover', file: 'goals.md', lines: [3, 3], text: 'Orders ship within a day of payment.' }
    const kept = { repository: 'handover', file: 'goals.md', lines: [7, 7], text: 'We keep orders in PostgreSQL.' }
    const { plan, problems } = parsePlan({
      elements: [{ key: 'orders', type: 'container', label: 'Orders', units: ['orders-service:unit:.'], facts: ['handover:doc:goals.md'], confidence: 'observed' }],
      needs: [
        { key: 'n-fast', label: 'Fast shipping', description: 'Orders ship within a day of payment.', citations: [goal] },
        { key: 'n-bare', label: 'Bare', description: 'Nothing backs it.' },
      ],
      decisions: [{ key: 'd-pg', label: 'Use PostgreSQL', properties: { decision: 'Orders are kept in PostgreSQL.', status: 'accepted' }, constrains: ['orders', 'nowhere'], citations: [kept] }],
      requirements: [
        { key: 'r-ship', label: 'Ship within a day', satisfiedBy: 'orders', need: 'n-fast', properties: { ears_type: 'event-driven', trigger: 'an order is paid', action: 'the system shall ship it within a day' }, citations: [goal] },
        { key: 'r-bare', label: 'Bare', satisfiedBy: 'orders', need: 'n-none', properties: { ears_type: 'ubiquitous', action: 'the system shall do it' } },
      ],
    })
    expect(problems).toEqual([])
    expect(checkPlan(plan, facts, () => false, [...repos, ...sources])).toEqual([
      'elements[0] (Orders): observed, but cites a document; a document backs only an inferred claim',
      'requirements[1] (Bare): need n-none is neither a key of the plan\'s needs, a need waiting for an answer, nor a need of the model',
      'requirements[1] (Bare): needs the scenarios that verify it, or the documents or code it is drawn from (facts, citations)',
      'needs[1] (Bare): facts must list the ids of the facts it rests on, or citations the code or documents it quotes',
      'decisions[0] (Use PostgreSQL): constrains nowhere, which is neither a key of the plan nor an id of the model',
    ])
  })

  it('takes a stored package as a component of its database, observed on its routine fact, and a call of one of its members as a relation to it', () => {
    // A PL/SQL library in one repository, a Java application calling one of its packages in another.
    const dir = mkdtempSync(join(tmpdir(), 'assay-plan-plsql-'))
    const files: Record<string, string> = {
      'lib/ora/pdf.pks': 'CREATE OR REPLACE PACKAGE pdf AS\n  PROCEDURE add_page;\nEND pdf;\n/\n',
      'lib/ora/pdf.pkb': 'CREATE OR REPLACE PACKAGE BODY pdf AS\n  PROCEDURE add_page IS\n  BEGIN\n    INSERT INTO pages (id) VALUES (1);\n  END add_page;\nEND pdf;\n/\n',
      'lib/ora/close_day.prc': 'CREATE OR REPLACE PROCEDURE close_day IS\nBEGIN\n  NULL;\nEND;\n/\n',
      'lib/ora/tables.sql': 'CREATE TABLE pages (id NUMBER(6));\n',
      'app/pom.xml': '<project><groupId>a</groupId><artifactId>app</artifactId></project>\n',
      'app/src/main/java/a/Pages.java': 'package a;\nclass Pages {\n  void add() { conn.prepareCall("{call pdf.add_page}"); }\n  void close() { conn.prepareCall("{call close_day}"); }\n}\n',
    }
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, path)), { recursive: true })
      writeFileSync(join(dir, path), text)
    }
    for (const r of ['lib', 'app']) execFileSync('git', ['init', '-q'], { cwd: join(dir, r) })
    const repos = ['lib', 'app'].map((r) => extractRepository(join(dir, r)))
    const links = linkRepositories(repos)
    const facts = factIndex(repos, links)
    const call = (name: string) => links.find((l) => l.kind === 'routine' && l.to.endsWith(`:${name}`))!.id
    const { plan } = parsePlan({
      elements: [
        { key: 'db', type: 'database', label: 'PDF library', units: ['lib:unit:ora'], facts: ['lib:unit:ora'], confidence: 'observed' },
        { key: 'pdf', type: 'component', label: 'pdf', parent: 'db', technology: 'PL/SQL package', facts: ['lib:routine:ora:pdf'], confidence: 'observed' },
        { key: 'app', type: 'container', label: 'App', units: ['app:unit:.'], facts: ['app:unit:.'], confidence: 'observed' },
      ],
      relations: [
        { from: 'app', to: 'pdf', relationType: 'interacts', label: 'calls add_page', facts: [call('pdf.add_page')], confidence: 'observed' },
        // A procedure outside the package: its call joins the caller to the database, not to the package.
        { from: 'app', to: 'db', relationType: 'interacts', label: 'calls close_day', facts: [call('close_day')], confidence: 'observed' },
        { from: 'app', to: 'pdf', relationType: 'interacts', label: 'calls close_day', facts: [call('close_day')], confidence: 'observed' },
      ],
    })
    expect(checkPlan(plan, facts, () => false)).toEqual([
      'relations[2] (app → pdf): the links and dependencies it cites join neither of its ends to the other',
      'relations[2] (app → pdf): observed, but cites no dependency or observed link that states it',
    ])
  })

  it('refuses what is no plan', () => {
    expect(parsePlan('x').problems).toEqual(['the plan must be an object with elements, relations, requirements, needs, decisions, mockups, entities, processes and stateMachines'])
    expect(parsePlan({}).problems).toEqual(['the plan is empty'])
    expect(parsePlan({ elements: {} }).problems).toEqual(['elements must be a list', 'the plan is empty'])
  })
})
