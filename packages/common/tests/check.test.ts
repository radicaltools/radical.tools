import { describe, expect, it } from 'vitest'
import { CHECK_RULES, FOLDER_RULES, checkModel, formatCheckGithub, formatCheckText, ratchetConfig, runCheck, type CheckConfig } from '../src/check'
import { serializeToMdFolderWithPaths, type FolderFiles } from '../src/formats/mdFolder'
import { builtInC4Metamodel, builtInGovernanceMetamodel } from '../src/metamodel'
import type { C4Node, C4Relation, DiagramData } from '../src/c4'
import { bindSuggestions, buildConcernInsert, suggestedCover, type ConcernPack } from '../src/concerns'

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node
const rel = (id: string, relationType: string, sourceId: string, targetId: string): C4Relation =>
  ({ id, relationType, sourceId, targetId })

const ACCEPTED_ADR = { status: 'accepted', date: '2026-10-14', context: 'c', decision: 'd', consequences: 'q' }

/** A governance model where every completeness rule holds. */
function complete(): DiagramData {
  return {
    metamodel: builtInGovernanceMetamodel(),
    nodes: [
      node('sys', 'system', 'Shop'),
      node('need', 'need', 'Brief'),
      node('req', 'requirement', 'Pay', { ears_type: 'event-driven', trigger: 'the user pays', action: 'take the payment' }),
      node('sc', 'scenario', 'Paying', { given: 'a cart', when: 'paying', then: 'paid', tests: 'tests/pay.test.ts › pays' }),
      node('adr', 'adr', 'Use cards', ACCEPTED_ADR),
      node('ff', 'fitness-fn', 'Card check', { threshold: 'passes', tests: 'tests/cards.test.ts › only cards' }),
    ],
    relations: [
      rel('r1', 'derives', 'req', 'need'),
      rel('r2', 'verifies', 'sc', 'req'),
      rel('r3', 'satisfies', 'sys', 'req'),
      rel('r4', 'implements', 'ff', 'adr'),
    ],
  }
}

const filesOf = (data: DiagramData): FolderFiles => serializeToMdFolderWithPaths(data, 'Test').files
const check = (data: DiagramData, config?: CheckConfig) => runCheck(filesOf(data), config)
const rulesFound = (data: DiagramData) => [...new Set(check(data).findings.map((f) => f.rule))]

describe('radical check', () => {
  it('passes a complete model with no findings', () => {
    const result = check(complete())
    expect(result.findings).toEqual([])
    expect(result.ok).toBe(true)
    expect(result.nodeCount).toBe(6)
    expect(result.relationCount).toBe(4)
  })

  it('finds what each completeness rule is about, and points at the node file', () => {
    const data = complete()
    data.relations = []
    data.nodes.push(node('adr2', 'adr', 'Old', { status: 'superseded' }), node('adr3', 'adr', 'Half', { status: 'accepted' }))
    Object.assign(data.nodes.find((n) => n.id === 'ff')!, { threshold: '' })
    Object.assign(data.nodes.find((n) => n.id === 'req')!, { trigger: '' })
    const result = check(data)
    expect([...new Set(result.findings.map((f) => f.rule))].sort()).toEqual([
      'adr-incomplete', 'adr-superseded-unlinked', 'adr-without-fitness-fn', 'fitness-fn-unlinked', 'fitness-fn-without-threshold',
      'need-without-requirement', 'requirement-incomplete', 'requirement-unsatisfied', 'requirement-without-origin',
      'requirement-without-scenario', 'scenario-verifies-nothing',
    ])
    const req = result.findings.find((f) => f.rule === 'requirement-without-scenario')!
    expect(req).toMatchObject({ nodeId: 'req', severity: 'warning', key: 'requirement-without-scenario' })
    expect(req.path).toMatch(/^nodes\/.*\.md$/)
    expect(result.findings.find((f) => f.rule === 'adr-incomplete')!.message).toContain('has no date, context, decision, consequences')
    // Warnings alone pass.
    expect(result.ok).toBe(true)
  })

  it('reads a state the requirement points at as its precondition', () => {
    const data = complete()
    data.nodes.push(
      node('sm', 'state-machine', 'Order'),
      node('st', 'state', 'Open', { parentId: 'sm' }),
      node('req2', 'requirement', 'Hold', { ears_type: 'state-driven', precondition_state: 'st', action: 'hold stock' }),
    )
    expect(check(data).findings.filter((f) => f.rule === 'requirement-incomplete')).toEqual([])
  })

  it('flags an ADR marked superseded only through the other ADR as well', () => {
    const data = complete()
    data.nodes.push(node('adr0', 'adr', 'Cash only', { ...ACCEPTED_ADR }))
    data.relations.push(rel('r5', 'supersedes', 'adr', 'adr0'), rel('r6', 'implements', 'ff', 'adr0'))
    expect(check(data).findings.map((f) => f.message)).toEqual(['ADR "Cash only" is superseded by another ADR, but its status is accepted.'])
  })

  it('finds nothing to complete in a C4 model', () => {
    expect(rulesFound({ metamodel: builtInC4Metamodel(), nodes: [node('s', 'system', 'S')], relations: [] })).toEqual([])
  })

  it('reports the metamodel issues as errors with their kind as code', () => {
    const data = complete()
    data.relations.push(rel('bad', 'verifies', 'sc', 'ghost'))
    const result = check(data)
    const issue = result.findings.find((f) => f.rule === 'metamodel')!
    expect(issue).toMatchObject({ severity: 'error', relationId: 'bad', path: 'relations.json' })
    expect(issue.code).toBeTruthy()
    expect(result.ok).toBe(false)
  })

  it('lists stale references in views, sequences and slides', () => {
    const data = complete()
    data.views = [{ id: 'v', name: 'Main', nodeIds: ['sys', 'gone'], sequenceId: 'nope', positions: {} }]
    data.sequences = [{ id: 'seq', name: 'Flow', relationIds: ['r1', 'lost'] }]
    data.presentations = [{ id: 'p', name: 'Deck', slides: [{ id: 's', name: 'Intro', snapshotId: null, viewId: 'missing', viewport: { x: 0, y: 0, zoom: 1 } }] }]
    expect(check(data).findings.filter((f) => f.rule === 'stale-reference').map((f) => f.message)).toEqual([
      'View "Main" lists 1 element(s) the model does not have: gone.',
      'View "Main" plays sequence nope, which the model does not have.',
      'Sequence "Flow" has 1 step(s) on relations the model does not have: lost.',
      'Slide "Intro" of "Deck" shows view missing, which the model does not have.',
    ])
  })

  // A slide's focus kept an element deleted since, and nothing said so.
  it('lists a slide focus on an element the model it shows does not have', () => {
    const data = complete()
    data.snapshots = [{ id: 'm', name: 'As-is', savedAt: '2026-01-01', nodes: { old: { id: 'old', type: 'system', label: 'Old', x: 0, y: 0, width: 1, height: 1, collapsed: false } }, relations: {} } as never]
    const slide = { snapshotId: null, viewId: null, viewport: { x: 0, y: 0, zoom: 0 } }
    data.presentations = [{ id: 'p', name: 'Deck', slides: [
      { ...slide, id: 'a', name: 'Now', focusNodeIds: ['sys', 'gone'] },
      // Shown with its milestone, which holds the element.
      { ...slide, id: 'b', name: 'Then', snapshotId: 'm', focusNodeIds: ['old'] },
    ] }]
    expect(check(data).findings.filter((f) => f.rule === 'stale-reference').map((f) => f.message)).toEqual([
      'Slide "Now" of "Deck" focuses on 1 element(s) the model it shows does not have: gone.',
    ])
  })

  // F-0104: a slide Studio added of a milestone's view of an element the
  // live model deleted since was reported as showing a view the model lacks.
  it('takes a slide of a view its milestone has alone as a view the model has', () => {
    const data = complete()
    const sm = { id: 'sm', type: 'system', label: 'Lifecycle', x: 0, y: 0, width: 1, height: 1, collapsed: false }
    data.snapshots = [{ id: 'm', name: 'As-is', timestamp: 0, nodes: { sm }, relations: {}, views: { pl: { id: 'pl', name: 'Payment lifecycle', subject: 'sm', nodeIds: ['sm'], positions: {} } } } as never]
    const slide = { snapshotId: 'm', viewport: { x: 0, y: 0, zoom: 0 } }
    data.presentations = [{ id: 'p', name: 'Deck', slides: [
      { ...slide, id: 'a', name: 'Then', viewId: 'pl' },
      { ...slide, id: 'b', name: 'Now', snapshotId: null, viewId: 'pl' },
    ] }]
    expect(check(data).findings.filter((f) => f.rule === 'stale-reference').map((f) => f.message)).toEqual([
      'Slide "Now" of "Deck" shows view pl, which the model does not have.',
    ])
  })
})

describe('radical check: the folder', () => {
  it('stops at a missing manifest, malformed JSON or conflict markers', () => {
    const files = filesOf(complete())
    const nodePath = Object.keys(files).find((p) => p.startsWith('nodes/'))!
    const broken = { ...files, 'relations.json': '[{,}]', [nodePath]: `${files[nodePath]}\n<<<<<<< HEAD\n=======\n>>>>>>> other\n` }
    delete broken['radical.md']
    const result = runCheck(broken)
    expect(result.findings.map((f) => [f.rule, f.path])).toEqual([
      ['folder-manifest', 'radical.md'],
      ['folder-json', 'relations.json'],
      ['folder-conflict', nodePath],
    ])
    expect(result.nodeCount).toBe(0)
    expect(result.ok).toBe(false)
  })

  it('finds a node file without id or type and a duplicated id, but not a README', () => {
    const files = filesOf(complete())
    const reqPath = Object.keys(files).find((p) => files[p].includes('id: "req"'))!
    const result = runCheck({
      ...files,
      'nodes/README.md': '# Notes\n',
      'nodes/typo.md': '---\nid: "x"\nlabel: "No type"\n---\n',
      'nodes/copy.md': files[reqPath],
    })
    expect(result.findings.map((f) => [f.rule, f.path])).toEqual([
      ['folder-not-a-node', 'nodes/typo.md'],
      ['folder-duplicate-id', expect.stringMatching(/^nodes\//)],
    ])
    expect(result.findings[0].message).toBe('nodes/typo.md has frontmatter but no type; it is not loaded as an element.')
  })
})

describe('radical check: config', () => {
  const incomplete = (): DiagramData => {
    const data = complete()
    data.nodes.push(
      node('a', 'requirement', 'A', { action: 'a' }),
      node('b', 'requirement', 'B', { action: 'b' }),
    )
    data.relations.push(rel('ra', 'derives', 'a', 'need'), rel('rb', 'derives', 'b', 'need'), rel('sa', 'satisfies', 'sys', 'a'), rel('sb', 'satisfies', 'sys', 'b'))
    return data
  }

  it('turns a rule off or into an error', () => {
    expect(check(incomplete(), { rules: { 'requirement-without-scenario': 'off' } }).findings).toEqual([])
    const result = check(incomplete(), { rules: { 'requirement-without-scenario': 'error' } })
    expect(result.errors).toBe(2)
    expect(result.rules).toEqual([{ id: 'requirement-without-scenario', count: 2, severity: 'error', failed: true }])
  })

  it('passes findings up to the baseline as warnings and fails above it', () => {
    const at = check(incomplete(), { rules: { 'requirement-without-scenario': { severity: 'error', max: 2 } } })
    expect(at.ok).toBe(true)
    expect(at.findings.every((f) => f.severity === 'warning')).toBe(true)
    const above = check(incomplete(), { rules: { 'requirement-without-scenario': { severity: 'error', max: 1 } } })
    expect(above.ok).toBe(false)
    expect(above.rules[0]).toMatchObject({ count: 2, max: 1, failed: true })
  })

  it('sets one kind of metamodel issue apart with rule/code', () => {
    const data = complete()
    data.relations.push(rel('bad', 'verifies', 'sc', 'ghost'))
    const code = check(data).findings[0].code!
    const result = check(data, { rules: { [`metamodel/${code}`]: 'warning' } })
    expect(result.ok).toBe(true)
    expect(result.findings[0].key).toBe(`metamodel/${code}`)
  })

  it('names config keys that are no rule', () => {
    expect(check(complete(), { rules: { 'requirement-without-scenarios': 'off' } }).unknownRules).toEqual(['requirement-without-scenarios'])
  })

  it('ratchets a baseline down, never up', () => {
    const config: CheckConfig = { rules: { 'requirement-without-scenario': { severity: 'error', max: 5 }, 'adr-incomplete': { max: 0 } } }
    const { config: next, lowered } = ratchetConfig(config, check(incomplete(), config))
    expect(lowered).toEqual([{ id: 'requirement-without-scenario', from: 5, to: 2 }])
    expect(next.rules!['requirement-without-scenario']).toEqual({ severity: 'error', max: 2 })
    const tight: CheckConfig = { rules: { 'requirement-without-scenario': { max: 1 } } }
    expect(ratchetConfig(tight, check(incomplete(), tight)).lowered).toEqual([])
  })

  it('ratchets no baseline of a rule that did not run on a folder that is no model', () => {
    const config: CheckConfig = { rules: { 'requirement-without-scenario': { severity: 'error', max: 5 } } }
    const files = filesOf(incomplete())
    delete files['radical.md']
    const result = runCheck(files, config)
    expect(result.rules.find((r) => r.id === 'requirement-without-scenario')).toMatchObject({ count: 0, notRun: 'no-model' })
    expect(ratchetConfig(config, result).lowered).toEqual([])
    expect(formatCheckText(result, { folder: 'm' })).toContain('– requirement-without-scenario  not run: the folder is no model (max 5)')
  })

  it('ratchets no stale-reference baseline on a folder that is no model', () => {
    const config: CheckConfig = { rules: { 'stale-reference': { max: 1 } } }
    const files = filesOf(complete())
    files['relations.json'] = '<<<<<<< HEAD\n[]\n=======\n[]\n>>>>>>> other\n'
    const result = runCheck(files, config)
    expect(result.rules.find((r) => r.id === 'stale-reference')).toMatchObject({ count: 0, notRun: 'no-model' })
    expect(ratchetConfig(config, result).lowered).toEqual([])
  })

  it('counts no folder rule on a model in memory, so neither Ratchet lowers its baseline', () => {
    const config: CheckConfig = { rules: { 'folder-not-a-node': { severity: 'error', max: 1 }, 'stale-reference': { max: 3 } } }
    const result = checkModel(complete(), config)
    expect(result.rules.find((r) => r.id === 'folder-not-a-node')).toMatchObject({ count: 0, notRun: 'no-folder', failed: false })
    // Views, sequences and slides are in memory too: that one is counted.
    expect(result.rules.find((r) => r.id === 'stale-reference')?.notRun).toBeUndefined()
    expect(ratchetConfig(config, result).lowered).toEqual([{ id: 'stale-reference', from: 3, to: 0 }])
  })

  it('has unique rule ids', () => {
    const ids = [...FOLDER_RULES, ...CHECK_RULES].map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('radical check: output', () => {
  const many = (): DiagramData => {
    const data = complete()
    for (let i = 0; i < 7; i++) {
      data.nodes.push(node(`n${i}`, 'requirement', `R${i}`, { action: 'x' }))
      data.relations.push(rel(`d${i}`, 'derives', `n${i}`, 'need'), rel(`s${i}`, 'satisfies', 'sys', `n${i}`))
    }
    return data
  }

  it('shows the first warnings of a rule and how many more there are', () => {
    const text = formatCheckText(check(many()), { folder: 'architecture' })
    expect(text).toContain('⚠ requirement-without-scenario  7')
    expect(text).toContain('    … 2 more (--verbose shows them)')
    expect(text).toMatch(/warning {2}architecture\/nodes\/.*\.md {2}No scenario verifies requirement "R0"\./)
    expect(text.trim().split('\n').at(-1)).toBe('✓ 0 errors, 7 warnings')
    expect(formatCheckText(check(many()), { folder: 'architecture', verbose: true })).not.toContain('more (--verbose')
  })

  it('writes GitHub annotations with escaped properties', () => {
    const data = complete()
    data.relations.push(rel('bad', 'verifies', 'sc', 'ghost'))
    const out = formatCheckGithub(check(data), { folder: 'my,model' })
    expect(out.split('\n')[0]).toMatch(/^::error file=my%2Cmodel\/relations.json,title=radical check%3A metamodel\/[\w-]+::/)
  })
})

describe('radical check: concerns', () => {
  const pack: ConcernPack = {
    id: 'concern-authentication', name: 'Authentication', description: 'd',
    concern: {
      id: 'authentication',
      trigger: 'LIST RELATIONS WHERE (source.type = "person" OR source.external = true) AND target.external != true',
      applyTo: 'target',
      why: 'people reach these elements.',
      group: 'identity',
    },
    templateParams: [{ key: 'IDENTITY', label: 'How do people sign in?', options: [{ value: 'idp', label: 'an identity provider' }, { value: 'none', label: 'nobody signs in' }] }],
  }
  /** A person uses the shop's web app, and nothing decides who they are. */
  const shop = (): DiagramData => ({
    metamodel: builtInGovernanceMetamodel(),
    nodes: [node('user', 'person', 'Customer'), node('sys', 'system', 'Shop'), node('web', 'webapp', 'Storefront', { parentId: 'sys' }), node('db', 'database', 'Orders', { parentId: 'sys' })],
    relations: [rel('u', 'interacts', 'user', 'web'), rel('w', 'interacts', 'web', 'db')],
  })
  const concerns = (data: DiagramData) => checkModel(data, {}, { concerns: [pack] }).findings.filter((f) => f.rule === 'concern-unaddressed')
  const decide = (data: DiagramData, on: string, props: Record<string, unknown>): DiagramData => {
    data.nodes.push(node('adr', 'adr', 'Who signs in', { ...ACCEPTED_ADR, concern: 'authentication', ...props }))
    data.relations.push(rel('c', 'constrains', 'adr', on))
    return data
  }

  it('reports a concern its trigger finds and no ADR addresses', () => {
    const [finding, ...more] = concerns(shop())
    expect(more).toEqual([])
    expect(finding).toMatchObject({ nodeId: 'web', code: 'concern-authentication', severity: 'warning' })
    expect(finding.message).toContain('Authentication: people reach these elements.')
    expect(finding.message).toContain('"Storefront"')
    expect(finding.details).toEqual(['How do people sign in? (idp: an identity provider | none: nobody signs in)'])
    expect(CHECK_RULES.find((r) => r.id === 'concern-unaddressed')).toMatchObject({ severity: 'warning', dimension: 'decisions' })
    // Without the packs, and on a metamodel whose ADRs hold no concern, there is nothing to report.
    expect(checkModel(shop()).findings.filter((f) => f.rule === 'concern-unaddressed')).toEqual([])
    expect(concerns({ ...shop(), metamodel: builtInC4Metamodel() })).toEqual([])
  })

  it('counts an accepted ADR marked with the concern on the element or what contains it, whatever it decides', () => {
    expect(concerns(decide(shop(), 'web', { decision: 'An identity provider.' }))).toEqual([])
    expect(concerns(decide(shop(), 'sys', { decision: 'Nobody signs in: everything is public.' }))).toEqual([])
  })

  it('names a proposed ADR and ignores a superseded or deprecated one and one on another element', () => {
    const [pending] = concerns(decide(shop(), 'web', { status: 'proposed' }))
    expect(pending.message).toContain('"Who signs in" is proposed: the decision is being made.')
    for (const status of ['superseded', 'deprecated']) expect(concerns(decide(shop(), 'web', { status }))).toHaveLength(1)
    expect(concerns(decide(shop(), 'db', {}))).toHaveLength(1)
    const unmarked = decide(shop(), 'web', { concern: '' })
    expect(concerns(unmarked)).toHaveLength(1)
  })

  it('reports an accepted concern decision that constrains nothing, with where to bind it', () => {
    const unbound = (data: DiagramData) => checkModel(data, {}, { concerns: [pack] }).findings.filter((f) => f.rule === 'concern-unbound')
    const data = shop()
    data.nodes.push(
      node('adr', 'adr', 'Who signs in', { ...ACCEPTED_ADR, concern: 'authentication' }),
      node('ff', 'fitness-fn', 'Calls refused', { threshold: '401' }),
      node('plain', 'adr', 'Use cards', ACCEPTED_ADR),
    )
    data.relations.push(rel('i', 'implements', 'ff', 'adr'))
    const [finding, ...more] = unbound(data)
    expect(more).toEqual([])
    expect(finding).toMatchObject({ nodeId: 'adr', relatedIds: ['ff'], code: 'authentication', severity: 'warning' })
    expect(finding.message).toBe('ADR "Who signs in" settles the concern "authentication" but constrains no element, so it settles it for nothing. Bind it to "Storefront", which the concern applies to.')
    expect(CHECK_RULES.find((r) => r.id === 'concern-unbound')).toMatchObject({ severity: 'warning', dimension: 'decisions' })
    // Without the pack it still says so, without where.
    expect(checkModel(data).findings.find((f) => f.rule === 'concern-unbound')?.message).toMatch(/so it settles it for nothing\.$/)
    const bound = { ...data, relations: [...data.relations, rel('b', 'constrains', 'adr', 'web')] }
    expect(unbound(bound)).toEqual([])
    const superseded = { ...data, nodes: data.nodes.map((n) => (n.id === 'adr' ? { ...n, status: 'superseded' } as C4Node : n)) }
    expect(unbound(superseded)).toEqual([])
  })

  it('an imported pack gets a view of its own, with what it is bound to', () => {
    const concept = {
      ...pack, category: 'concern' as const, tags: [],
      nodes: [
        { id: 'need', type: 'need', label: 'N', x: 0, y: 0 },
        { id: 'req', type: 'requirement', label: 'R', ears_type: 'ubiquitous', action: 'do', x: 260, y: 0 },
        { id: 'adr', type: 'adr', label: 'D', concern: 'authentication', status: 'accepted', x: 780, y: 0 },
      ],
      relations: [{ id: 'd', relationType: 'derives', sourceId: 'req', targetId: 'need' }],
    }
    const data = shop()
    const nodes = Object.fromEntries(data.nodes.map((n) => [n.id, n]))
    let n = 0
    const options = { answers: {}, metamodel: data.metamodel, today: '2026-10-22', newId: () => `id${++n}`, place: () => ({ x: 500, y: 500 }), nodes, takenNames: { views: ['Authentication', 'Authentication 2'] } }
    const bound = buildConcernInsert(concept, { ...options, elements: [nodes.web] })
    const [view] = bound.views
    expect(view).toMatchObject({ name: 'Authentication 3', kind: 'static', folder: 'Concerns' })
    expect(view.nodeIds).toEqual([...Object.keys(bound.nodes), 'sys', 'web'])
    // The pack in its columns from 0, the decision right of the requirement; the shop holding the web app on their left.
    const at = (label: string) => view.positions[Object.values(bound.nodes).find((x) => x.label === label)!.id]
    expect(at('N')).toMatchObject({ x: 0, y: 0 })
    expect(at('D').x).toBeGreaterThan(at('R').x)
    expect(view.positions.sys.x).toBeLessThan(0)
    expect(view.positions.web).toMatchObject({ x: nodes.web.x, y: nodes.web.y })
    const unbound = buildConcernInsert(concept, { ...options, elements: [] })
    expect(unbound.views[0].nodeIds).toEqual(Object.keys(unbound.nodes))
  })

  it('suggests where to bind a pack: the smallest element that settles the most, and the fewest that settle all', () => {
    const data = shop()
    data.nodes.push(node('admin', 'webapp', 'Back office', { parentId: 'sys' }), node('cli', 'container', 'CLI'), node('order', 'entity', 'Order'))
    data.relations.push(rel('ua', 'interacts', 'user', 'admin'), rel('uc', 'interacts', 'user', 'cli'))
    const byId = <T extends { id: string }>(xs: T[]) => Object.fromEntries(xs.map((x) => [x.id, x]))
    const suggest = (d: DiagramData) => bindSuggestions(pack, byId(d.nodes), byId(d.relations), d.metamodel)
    // The shop holds two of the three: first; then each element for itself,
    // those inside a system before the CLI, which is in none.
    expect(suggest(data)).toEqual([
      { id: 'sys', covers: ['admin', 'web'], recommended: true },
      { id: 'admin', covers: ['admin'], recommended: false },
      { id: 'web', covers: ['web'], recommended: false },
      { id: 'cli', covers: ['cli'], recommended: false },
    ])
    // To begin with, the fewest that cover all: the shop and the CLI.
    expect(suggestedCover(suggest(data))).toEqual(['sys', 'cli'])
    // With the shop settled, the CLI is what is left; the shop, holding none of it, is not offered.
    expect(suggest(decide(data, 'sys', {})).map((b) => b.id)).toEqual(['cli'])
  })
})
