import { describe, expect, it } from 'vitest'
import { CHECK_RULES, FOLDER_RULES, checkModel, formatCheckGithub, formatCheckText, ratchetConfig, runCheck, type CheckConfig } from '../src/check'
import { serializeToMdFolderWithPaths, type FolderFiles } from '../src/formats/mdFolder'
import { builtInC4Metamodel, builtInGovernanceMetamodel } from '../src/metamodel'
import type { C4Node, C4Relation, DiagramData } from '../src/c4'

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
