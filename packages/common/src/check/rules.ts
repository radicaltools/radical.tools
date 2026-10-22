// ─── radical check: the rule catalogue ───────────────────────────────────────
//
// Each rule reads one model and says what in it is wrong or missing. Rules
// that need a type the model's metamodel lacks (a C4-only model has no
// requirements) find nothing. The metamodel rule wraps validateModel, the same
// list Studio's Validation panel and the MCP server's get_issues show; the
// other rules are about completeness, which no editor can enforce while
// someone types (a requirement comes before its scenario).

import type { C4Node, C4Relation } from '../c4'
import { composeEarsSentence, requirementStatePhrase, validateModel, type Metamodel } from '../metamodel'
import { linkedNodes, testIdsOf, testOutcomes, TESTED_TYPES, type TestOutcome } from './evidence'
import { findTests, globMatch, type TestCase } from './reports'
import type { CheckDimension } from './goals'
import { bindSuggestions, concernStatuses, holdsConcerns, questionLine, suggestedCover, type ConcernPack } from '../concerns'

export type CheckSeverity = 'error' | 'warning'

/** One thing a rule found. `nodeId` or `relationId` point at the element. */
export interface RuleFinding {
  message: string
  nodeId?: string
  relationId?: string
  /** File in the model folder, when the finding is about a file. */
  path?: string
  /** Sub-rule, e.g. the validator's issue kind under `metamodel`. */
  code?: string
  /** Overrides the rule's severity (the validator rates each issue). */
  severity?: CheckSeverity
  /** Other elements the finding is about: what a failed test leaves
   *  unverified. Studio links them. */
  relatedIds?: string[]
  /** A test file the finding is about, as the reports name it but cut to
   *  the repository path the rule's `include` matched. */
  testFile?: string
  /** Lines that belong to the finding, such as the titles of the tests it
   *  counts. */
  details?: string[]
}

export interface CheckModel {
  nodes: Record<string, C4Node>
  relations: Record<string, C4Relation>
  metamodel: Metamodel
  /** The test cases of the reports passed in; the test rules run only with them. */
  tests?: TestCase[]
  /** The config's rule settings, for rules that take options. */
  settings?: Record<string, import('./index').RuleSetting>
  /** The Hub's concern packs, for concern-unaddressed; without them it
   *  finds nothing. */
  concerns?: ConcernPack[]
}

export interface CheckRule {
  id: string
  /** What the rule wants, in one sentence, for `--list-rules` and docs. */
  description: string
  severity: CheckSeverity
  /** What it is about, for the Inspector's grouping. */
  dimension: CheckDimension
  /** It reads the outcomes in test reports: without them it does not run. */
  readsReports?: true
  run(model: CheckModel): RuleFinding[]
}

type Props = Record<string, unknown>
export const prop = (node: C4Node, key: string): string => {
  const value = (node as unknown as Props)[key]
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value)
}

/** Relations of `type` ending (in) or starting (out) at each node. */
function linked(model: CheckModel, type: string, end: 'in' | 'out'): Map<string, C4Relation[]> {
  const map = new Map<string, C4Relation[]>()
  for (const r of Object.values(model.relations)) {
    if (r.relationType !== type) continue
    const id = end === 'in' ? r.targetId : r.sourceId
    map.set(id, [...(map.get(id) ?? []), r])
  }
  return map
}

export const nodesOf = (model: CheckModel, type: string): C4Node[] =>
  model.metamodel.nodeTypes[type] ? Object.values(model.nodes).filter((n) => n.type === type) : []

const hasRelationType = (model: CheckModel, type: string): boolean =>
  !!model.metamodel.relationTypes[type]

/** Nodes of `type` with no `relation` at the given end, from or to a node of
 *  one of `otherTypes` (any type when omitted). */
function unlinked(model: CheckModel, type: string, relation: string, end: 'in' | 'out', otherTypes?: string[]): C4Node[] {
  if (!hasRelationType(model, relation)) return []
  const map = linked(model, relation, end)
  return nodesOf(model, type).filter((n) => !(map.get(n.id) ?? []).some((r) => {
    const other = model.nodes[end === 'in' ? r.sourceId : r.targetId]
    return other && (!otherTypes || otherTypes.includes(other.type))
  }))
}

const quote = (n: C4Node): string => `"${n.label}"`

const TYPE_NAME: Record<string, string> = { scenario: 'Scenario', 'fitness-fn': 'Fitness function' }

/** What a failing check of `node` takes down with it: the requirements a
 *  scenario verifies, the ADRs a fitness function implements. */
const affectedBy = (model: CheckModel, node: C4Node): C4Node[] => node.type === 'scenario'
  ? linkedNodes(model, node.id, 'verifies', 'target', 'requirement')
  : linkedNodes(model, node.id, 'implements', 'target', 'adr')

function brokenWith(model: CheckModel, node: C4Node): string {
  const affected = affectedBy(model, node)
  if (!affected.length) return ''
  const what = node.type === 'scenario' ? 'requirement' : 'ADR'
  return ` Not verified now: ${what}${affected.length === 1 ? '' : 's'} ${affected.map(quote).join(', ')}.`
}

/** A rule over the outcome of each test id the model names, with reports.
 *  A failing outcome names what it leaves unverified as related. */
function testRule(outcome: TestOutcome, message: (node: C4Node, id: string, model: CheckModel) => string): (model: CheckModel) => RuleFinding[] {
  const failing = outcome === 'failed' || outcome === 'not-found'
  return (model) => {
    if (!model.tests) return []
    return Object.values(model.nodes)
      .filter((n) => (TESTED_TYPES as readonly string[]).includes(n.type))
      .flatMap((node) => testOutcomes(node, model)
        .filter((o) => o.outcome === outcome)
        .map((o) => {
          const related = failing ? affectedBy(model, node).map((n) => n.id) : []
          return { nodeId: node.id, message: message(node, o.id.raw, model), ...(related.length ? { relatedIds: related } : {}) }
        }))
  }
}

export const CHECK_RULES: CheckRule[] = [
  {
    id: 'metamodel',
    description: 'The model follows its metamodel: types, parents, relation pairs, required properties, references and the state machine rules. The Validation list in Studio and get_issues over MCP, with their severities: an unknown type or a relation to no element is an error, a relation pair the metamodel does not allow a warning (`"metamodel": "error"` makes every issue one).',
    severity: 'error',
    dimension: 'consistency',
    run: (model) => validateModel(model.nodes, model.relations, model.metamodel).map((issue) => ({
      message: issue.message,
      code: issue.id.split(':')[0],
      severity: issue.severity,
      ...(issue.nodeId ? { nodeId: issue.nodeId } : {}),
      ...(issue.relationId ? { relationId: issue.relationId } : {}),
    })),
  },
  {
    id: 'requirement-incomplete',
    description: 'A requirement has an action and every field its EARS type reads (an event-driven one a trigger, a state-driven one a precondition, …).',
    severity: 'warning',
    dimension: 'completeness',
    run: (model) => nodesOf(model, 'requirement')
      .filter((n) => !composeEarsSentence(n as unknown as Props, undefined, requirementStatePhrase(n, model.nodes, model.relations)).complete)
      .map((n) => ({ nodeId: n.id, message: `Requirement ${quote(n)} (${prop(n, 'ears_type') || 'ubiquitous'}) misses the action or a field its EARS type needs.` })),
  },
  {
    id: 'requirement-without-scenario',
    description: 'Every requirement is verified by at least one scenario.',
    severity: 'warning',
    dimension: 'traceability',
    run: (model) => model.metamodel.nodeTypes.scenario
      ? unlinked(model, 'requirement', 'verifies', 'in', ['scenario'])
        .map((n) => ({ nodeId: n.id, message: `No scenario verifies requirement ${quote(n)}.` }))
      : [],
  },
  {
    id: 'requirement-unsatisfied',
    description: 'Every requirement is satisfied by an element of the architecture.',
    severity: 'warning',
    dimension: 'traceability',
    run: (model) => unlinked(model, 'requirement', 'satisfies', 'in')
      .map((n) => ({ nodeId: n.id, message: `Nothing satisfies requirement ${quote(n)}.` })),
  },
  {
    id: 'requirement-without-origin',
    description: 'Every requirement derives from a need or from another requirement.',
    severity: 'warning',
    dimension: 'traceability',
    run: (model) => unlinked(model, 'requirement', 'derives', 'out', ['need', 'requirement'])
      .map((n) => ({ nodeId: n.id, message: `Requirement ${quote(n)} derives from no need and no other requirement.` })),
  },
  {
    id: 'need-without-requirement',
    description: 'Every need has at least one requirement derived from it.',
    severity: 'warning',
    dimension: 'traceability',
    run: (model) => unlinked(model, 'need', 'derives', 'in', ['requirement'])
      .map((n) => ({ nodeId: n.id, message: `No requirement derives from need ${quote(n)}.` })),
  },
  {
    id: 'scenario-verifies-nothing',
    description: 'Every scenario verifies a requirement or a state machine.',
    severity: 'warning',
    dimension: 'traceability',
    run: (model) => unlinked(model, 'scenario', 'verifies', 'out')
      .map((n) => ({ nodeId: n.id, message: `Scenario ${quote(n)} verifies no requirement and no state machine.` })),
  },
  {
    id: 'adr-without-fitness-fn',
    description: 'Every accepted ADR is implemented by a fitness function that checks it.',
    severity: 'warning',
    dimension: 'decisions',
    run: (model) => model.metamodel.nodeTypes['fitness-fn']
      ? unlinked(model, 'adr', 'implements', 'in', ['fitness-fn'])
        .filter((n) => prop(n, 'status') === 'accepted')
        .map((n) => ({ nodeId: n.id, message: `No fitness function implements accepted ADR ${quote(n)}.` }))
      : [],
  },
  {
    id: 'adr-incomplete',
    description: 'An accepted ADR records its date, context, decision and consequences.',
    severity: 'warning',
    dimension: 'completeness',
    run: (model) => nodesOf(model, 'adr')
      .filter((n) => prop(n, 'status') === 'accepted')
      .flatMap((n) => {
        const missing = ['date', 'context', 'decision', 'consequences'].filter((key) => !prop(n, key))
        return missing.length ? [{ nodeId: n.id, message: `Accepted ADR ${quote(n)} has no ${missing.join(', ')}.` }] : []
      }),
  },
  {
    id: 'adr-superseded-unlinked',
    description: 'An ADR is superseded exactly when a newer ADR supersedes it.',
    severity: 'warning',
    dimension: 'consistency',
    run: (model) => {
      if (!hasRelationType(model, 'supersedes')) return []
      const by = linked(model, 'supersedes', 'in')
      return nodesOf(model, 'adr').flatMap((n) => {
        const superseded = prop(n, 'status') === 'superseded'
        const hasSuccessor = (by.get(n.id) ?? []).length > 0
        if (superseded && !hasSuccessor) return [{ nodeId: n.id, message: `ADR ${quote(n)} is superseded, but no ADR supersedes it.` }]
        if (!superseded && hasSuccessor) return [{ nodeId: n.id, message: `ADR ${quote(n)} is superseded by another ADR, but its status is ${prop(n, 'status') || 'not set'}.` }]
        return []
      })
    },
  },
  {
    id: 'fitness-fn-unlinked',
    description: 'Every fitness function implements an ADR or constrains an element.',
    severity: 'warning',
    dimension: 'decisions',
    run: (model) => {
      const out = [...linked(model, 'implements', 'out').keys(), ...linked(model, 'constrains', 'out').keys()]
      const linkedIds = new Set(out)
      return nodesOf(model, 'fitness-fn').filter((n) => !linkedIds.has(n.id))
        .map((n) => ({ nodeId: n.id, message: `Fitness function ${quote(n)} implements no ADR and constrains no element.` }))
    },
  },
  {
    id: 'concern-unaddressed',
    description: 'Every concern a Hub concern pack finds in the model is settled by an accepted ADR marked with it (property `concern`) that constrains the elements it applies to, or what contains them.',
    severity: 'warning',
    dimension: 'decisions',
    run: (model) => holdsConcerns(model.metamodel)
      ? concernStatuses(model.concerns ?? [], model.nodes, model.relations).filter((s) => s.open.length).map(({ pack, open, pending }) => {
        const names = open.map((id) => quote(model.nodes[id])).join(', ')
        const being = pending.length ? ` ${pending.map(quote).join(', ')} ${pending.length === 1 ? 'is' : 'are'} proposed: the decision is being made.` : ''
        return {
          nodeId: open[0],
          ...(open.length > 1 ? { relatedIds: open.slice(1) } : {}),
          code: pack.id,
          message: `${pack.name}: ${pack.concern.why} No accepted ADR marked "${pack.concern.id}" settles it for ${names}.${being}`,
          details: (pack.templateParams ?? []).map(questionLine),
        }
      })
      : [],
  },
  {
    id: 'concern-unbound',
    description: 'Every accepted ADR marked with a concern (property `concern`, set by a Hub concern pack) constrains the elements it settles the concern for.',
    severity: 'warning',
    dimension: 'decisions',
    run: (model) => {
      if (!holdsConcerns(model.metamodel)) return []
      const constraining = new Set(linked(model, 'constrains', 'out').keys())
      const implementedBy = linked(model, 'implements', 'in')
      return nodesOf(model, 'adr')
        .filter((n) => prop(n, 'concern') && prop(n, 'status') === 'accepted' && !constraining.has(n.id))
        .map((n) => {
          const checks = (implementedBy.get(n.id) ?? []).map((r) => r.sourceId).filter((id) => model.nodes[id]?.type === 'fitness-fn')
          const pack = model.concerns?.find((p) => p.concern.id === prop(n, 'concern'))
          const where = pack ? suggestedCover(bindSuggestions(pack, model.nodes, model.relations, model.metamodel)) : []
          return {
            nodeId: n.id,
            ...(checks.length ? { relatedIds: checks } : {}),
            code: prop(n, 'concern'),
            message: `ADR ${quote(n)} settles the concern "${prop(n, 'concern')}" but constrains no element, so it settles it for nothing.${where.length ? ` Bind it to ${where.map((id) => quote(model.nodes[id])).join(', ')}, which the concern applies to.` : ''}`,
          }
        })
    },
  },
  {
    id: 'fitness-fn-without-threshold',
    description: 'Every fitness function states its threshold or success criteria.',
    severity: 'warning',
    dimension: 'completeness',
    run: (model) => nodesOf(model, 'fitness-fn').filter((n) => !prop(n, 'threshold'))
      .map((n) => ({ nodeId: n.id, message: `Fitness function ${quote(n)} states no threshold.` })),
  },
  {
    id: 'scenario-without-tests',
    description: 'Every scenario names the automated tests that run it (property `tests`, one `file › title` per line).',
    severity: 'warning',
    dimension: 'traceability',
    run: (model) => nodesOf(model, 'scenario').filter((n) => !testIdsOf(n).length)
      .map((n) => ({ nodeId: n.id, message: `Scenario ${quote(n)} names no test.` })),
  },
  {
    id: 'fitness-fn-without-tests',
    description: 'Every fitness function names the automated checks that run it (property `tests`).',
    severity: 'warning',
    dimension: 'decisions',
    run: (model) => nodesOf(model, 'fitness-fn').filter((n) => !testIdsOf(n).length)
      .map((n) => ({ nodeId: n.id, message: `Fitness function ${quote(n)} names no test.` })),
  },
  {
    id: 'test-failed',
    description: 'With --report: every test a scenario or fitness function names passed.',
    severity: 'error',
    dimension: 'tests',
    readsReports: true,
    run: testRule('failed', (node, id, model) => `${TYPE_NAME[node.type]} ${quote(node)}: test ${id} failed.${brokenWith(model, node)}`),
  },
  {
    id: 'test-not-found',
    description: 'With --report: every test a scenario or fitness function names is in the report of its file (a renamed or deleted test is not).',
    severity: 'error',
    dimension: 'tests',
    readsReports: true,
    run: testRule('not-found', (node, id, model) => `${TYPE_NAME[node.type]} ${quote(node)}: no test ${id} in the reports, though its file ran; renamed or deleted?${brokenWith(model, node)}`),
  },
  {
    id: 'test-skipped',
    description: 'With --report: no test a scenario or fitness function names was skipped.',
    severity: 'warning',
    dimension: 'tests',
    readsReports: true,
    run: testRule('skipped', (node, id) => `${TYPE_NAME[node.type]} ${quote(node)}: test ${id} was skipped.`),
  },
  {
    id: 'test-not-run',
    description: 'With --report: every file a scenario or fitness function names a test in is in the reports.',
    severity: 'warning',
    dimension: 'tests',
    readsReports: true,
    run: testRule('not-run', (node, id) => `${TYPE_NAME[node.type]} ${quote(node)}: no report has the file of test ${id}.`),
  },
  {
    id: 'test-unbound',
    description: 'With --report and an include in check.json: every test in the files it includes is named by a scenario or a fitness function, by its title or its describe block (a whole file or directory does not count). One finding per test file.',
    severity: 'warning',
    dimension: 'tests',
    readsReports: true,
    run: unboundTests,
  },
]

/** The tests in the files a project includes that no scenario or fitness
 *  function names precisely. A file or directory a fitness function names
 *  as a whole (`apps/e2e/tests`) is an umbrella over many behaviours and
 *  covers none of them. */
function unboundTests(model: CheckModel): RuleFinding[] {
  return [...testBinding(model) ?? []].filter(([, e]) => e.unbound.length).sort(([a], [b]) => a.localeCompare(b)).map(([file, e]) => ({
    testFile: file,
    message: `${file}: ${e.unbound.length} of ${e.total} test${e.total === 1 ? '' : 's'} named by no scenario or fitness function.`,
    details: e.unbound,
  }))
}

/** By test file the project includes for test-unbound: how many tests it
 *  has, and the titles of those no scenario or fitness function names.
 *  Null without reports or without an `include`. */
export function testBinding(model: CheckModel): Map<string, { total: number; unbound: string[] }> | null {
  const setting = model.settings?.['test-unbound']
  if (!model.tests || typeof setting !== 'object' || !setting.include?.length) return null
  const include = setting.include
  const exclude = setting.exclude ?? []
  const bound = new Set<TestCase>()
  for (const node of Object.values(model.nodes)) {
    if (!(TESTED_TYPES as readonly string[]).includes(node.type)) continue
    for (const id of testIdsOf(node)) if (id.title.length) findTests(id, model.tests).matches.forEach((c) => bound.add(c))
  }
  const byFile = new Map<string, { total: number; unbound: string[] }>()
  for (const c of model.tests) {
    const file = include.map((g) => globMatch(g, c.file)).find((m) => m !== null)
    if (file === undefined || exclude.some((g) => globMatch(g, c.file) !== null)) continue
    const entry = byFile.get(file) ?? { total: 0, unbound: [] }
    entry.total++
    if (!bound.has(c)) entry.unbound.push(c.title.join(' › '))
    byFile.set(file, entry)
  }
  return byFile
}

