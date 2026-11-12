// ─── radical check: the rule catalogue ───────────────────────────────────────
//
// Each rule reads one model and says what in it is wrong or missing. Rules
// that need a type the model's metamodel lacks (a C4-only model has no
// requirements) find nothing. The metamodel rule wraps validateModel, the same
// list Studio's Validation panel and the MCP server's get_issues show; the
// other rules are about completeness, which no editor can enforce while
// someone types (a requirement comes before its scenario).

import type { C4Node, C4Relation } from '../c4'
import { originOf } from '../model'
import { builtIn } from '../repositoryMapping'
import { composeEarsSentence, requirementStatePhrase, validateModel, type Metamodel } from '../metamodel'
import { BOUND_TESTS, conditionResults, conditionsOf, elementConditions, linkedNodes, measuredElements, testIdsOf, testOutcomes, TESTED_TYPES, type ConditionOutcome, type ConditionResult, type TestOutcome } from './evidence'
import { formatAge, parseCombine, parseConditions, parseMaxAge, type Measurement } from './metrics'
import { SENSOR_NAMES, isSensorName, parseMeasure } from './sensors'
import { findTests, globMatch, type TestCase } from './reports'
import type { CheckDimension } from './goals'
import { concernStatuses, holdsConcerns, questionLine, unboundDecisions, type ConcernPack } from '../concerns'
import { REFUSAL, exampleSentences, fragmentWords, needAnswers, needParts, oppositeOrder, plainWords, quoteFound, quoteFragments, readLimits, readOrders, readRoundings, readValues, saysValueOf, wordsAt, type Limit, type Op, type ValueReading } from './words'

export { hardValues, needAnswers, needParts, quoteFragments, readValues } from './words'

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
  /** When the test results it reads were read (ISO time), when they were
   *  kept from an earlier run: the finding is a warning, whatever the rule's
   *  setting, as the tests may have changed since. */
  asOf?: string
}

export interface CheckModel {
  nodes: Record<string, C4Node>
  relations: Record<string, C4Relation>
  metamodel: Metamodel
  /** The test cases of the reports passed in; the test rules run only with them. */
  tests?: TestCase[]
  /** When `tests` were read (ISO time), when they are results kept from an
   *  earlier run (Studio's Inspector) rather than the reports of this one. */
  testsReadAt?: string
  /** The measurements passed in; the metric rules that read values run only
   *  with them. */
  measurements?: Measurement[]
  /** The sensors of the repository's radical.sensors.json (its path and
   *  their names), null when it has none; not given, a measure line may
   *  name any sensor besides the built-in ones. */
  sensors?: { file: string; names: string[] } | null
  /** The repository's .radical/radical.json (its path and entries, each with
   *  the paths the repository lacks); not given, nothing checks it. */
  repository?: RepositoryMapping | null
  /** Earlier measurements a condition against a baseline compares with
   *  (the median of the latest seven of its metric). */
  baseline?: Measurement[]
  /** The time conditions are evaluated at (ms since the epoch), for max_age;
   *  now when not given. */
  now?: number
  /** The config's rule settings, for rules that take options. */
  settings?: Record<string, import('./index').RuleSetting>
  /** By element, the paths from the repository's root its description names
   *  that the repository does not have (the CLI works them out). */
  missingPaths?: Record<string, string[]>
  /** The repository's settings check.json holds (that belong in
   *  .radical/radical.json): "test-unbound include", "ci artifacts". */
  settingsInModel?: string[]
  /** The Hub's concern packs, for concern-unaddressed; without them it
   *  finds nothing. */
  concerns?: ConcernPack[]
  /** By test id as .radical/radical.json binds it, the text of the test's
   *  file, for scenario-value-untested; not given, the rule does not run. */
  testSources?: Record<string, string>
  /** The event the check runs on (pull-request in the gate): a metric
   *  condition of a fitness function that runs on another one, or
   *  continually, is not reported when nothing measured it. */
  trigger?: string
}

/** What a repository's .radical/radical.json maps, as radical check reads it:
 *  each element with its paths and those of them the repository lacks. */
export interface RepositoryMapping {
  file: string
  /** The model the file names, when it lives in a repository of its own:
   *  this repository is then judged on its part of it. */
  model?: { repo: string; ref?: string }
  implements: Array<{ element: string; name?: string; paths: string[]; missing: string[] }>
  /** The tests it binds to scenarios and fitness functions. */
  verifies?: Array<{ element: string; name?: string; tests: string[] }>
  /** The test files test-unbound reads, and CI's artifacts. */
  tests?: { include?: string[]; exclude?: string[] }
  ci?: { artifacts?: string[] }
}

export interface CheckRule {
  id: string
  /** What the rule wants, in one sentence, for `--list-rules` and docs. */
  description: string
  severity: CheckSeverity
  /** Off unless check.json gives it a severity: a rule most models would
   *  break everywhere at first, better followed as a goal in percent. */
  off?: true
  /** What it is about, for the Inspector's grouping. */
  dimension: CheckDimension
  /** It reads the outcomes in test reports: without them it does not run. */
  readsReports?: true
  /** It reads measurements: without them it does not run. */
  readsMeasurements?: true
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

/** The accepted ADRs of the models this one depends on (with an origin),
 *  none of which an accepted ADR of this model waives, each with this
 *  model's own elements it constrains (ADR Inherited decisions bind unless
 *  waived). */
function inheritedDecisions(model: CheckModel): Array<{ adr: C4Node; origin: string; elements: C4Node[] }> {
  const waived = new Set(Object.values(model.relations)
    .filter((r) => r.relationType === 'waives' && !originOf(model.nodes[r.sourceId]) && model.nodes[r.sourceId] && prop(model.nodes[r.sourceId], 'status') === 'accepted')
    .map((r) => r.targetId))
  return nodesOf(model, 'adr')
    .filter((n) => originOf(n) && prop(n, 'status') === 'accepted' && !waived.has(n.id))
    .map((adr) => ({ adr, origin: originOf(adr)!, elements: linkedNodes(model, adr.id, 'constrains', 'target').filter((e) => !originOf(e)) }))
}

/** Whether a fitness function names what checks it: metric conditions, or
 *  tests the repository binds to it (they come in as test conditions). */
const namesCheck = (ff: C4Node): boolean => conditionsOf(ff).some((c) => c.kind !== 'invalid')

const TYPE_NAME: Record<string, string> = { scenario: 'Scenario', 'fitness-fn': 'Fitness function' }
/** A node's type as a message names it: Scenario, Fitness function, else its type. */
const TYPE_LABEL = (node: C4Node): string => TYPE_NAME[node.type] ?? node.type.charAt(0).toUpperCase() + node.type.slice(1)

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

/** A rule over the metric conditions with `outcome`, with measurements. A
 *  failing one names what it leaves unverified as related. */
/** Whether `node` is measured on the check's trigger: a fitness function
 *  triggered on another event, continual or temporal is not; one with no
 *  cadence yet, and every scenario, is. */
const runsOn = (node: C4Node, trigger: string | undefined): boolean => {
  if (!trigger || node.type !== 'fitness-fn') return true
  const cadence = prop(node, 'cadence')
  if (!cadence) return true
  return cadence === 'triggered' && prop(node, 'trigger') === trigger
}

function metricRule(outcome: ConditionOutcome, message: (node: C4Node, condition: string, detail: string, why?: string) => string): (model: CheckModel) => RuleFinding[] {
  return (model) => {
    if (!model.measurements) return []
    return Object.values(model.nodes)
      .filter((n) => (TESTED_TYPES as readonly string[]).includes(n.type))
      .filter((n) => outcome !== 'not-run' || runsOn(n, model.trigger))
      .flatMap((node) => {
        const seen = (r: ConditionResult): string => {
          const m = r.measurement
          return m ? ` (${m.value}${m.unit ? ` ${m.unit}` : ''} from ${m.source}, ${formatAge((model.now ?? Date.now()) - Date.parse(m.at))} ago)` : ''
        }
        const elements = measuredElements(model, node)
        if (elements.length) {
          // Measured for each element its decision constrains: a finding per
          // element, on the element when the fitness function is another
          // model's (a standard its decision makes this model's).
          const origin = originOf(node)
          return elements.flatMap((element) => elementConditions(node, model, element)
            .filter((r) => r.outcome === outcome)
            .map((r) => ({
              nodeId: origin ? element.id : node.id,
              message: `${message(node, r.condition, seen(r), r.detail).replace(/\.$/, '')} for ${TYPE_NAME[element.type] ?? element.type} ${quote(element)}${origin ? ` (a fitness function of ${origin})` : ''}.`,
              ...(origin ? { relatedIds: [node.id] } : outcome === 'failed' ? { relatedIds: [element.id] } : {}),
            })))
        }
        const metricLines = new Set(conditionsOf(node).filter((c) => c.kind === 'metric').map((c) => c.raw))
        return conditionResults(node, model)
          .filter((r) => r.outcome === outcome && metricLines.has(r.condition))
          .map((r) => {
            const related = outcome === 'failed' ? affectedBy(model, node).map((n) => n.id) : []
            return { nodeId: node.id, message: message(node, r.condition, seen(r), r.detail), ...(related.length ? { relatedIds: related } : {}) }
          })
      })
  }
}

/** Whether `scenario` is the repository's to verify: a requirement it
 *  verifies is satisfied by an element .radical/radical.json says the
 *  repository builds (or a part of one). */
export function verifiedHere(model: CheckModel, scenario: C4Node): boolean {
  const mapped = model.repository?.implements
  if (!mapped?.length || originOf(scenario)) return false
  return linkedNodes(model, scenario.id, 'verifies', 'target', 'requirement')
    .some((req) => linkedNodes(model, req.id, 'satisfies', 'source').some((el) => builtIn(mapped, el.id, (id) => model.nodes[id]?.parentId)))
}

/** Where .radical/radical.json and the model or the repository part: an
 *  element the model lacks, another name, a path that is not there. */
function repositoryMapping(model: CheckModel): RuleFinding[] {
  const mapping = model.repository
  if (!mapping) return []
  return mapping.implements.flatMap((entry) => {
    const node = model.nodes[entry.element]
    if (!node) return [{ message: `${mapping.file}: ${entry.name ? `"${entry.name}" (${entry.element})` : entry.element} is no element of the model.` }]
    // On the element, unless it is another model's: that model cannot fix it.
    const on = originOf(node) ? {} : { nodeId: node.id }
    const found: RuleFinding[] = []
    if (entry.name !== undefined && entry.name !== node.label) found.push({ ...on, message: `${mapping.file}: ${entry.element} is named "${entry.name}"; the model calls it ${quote(node)}.` })
    for (const path of entry.missing) found.push({ ...on, message: `${mapping.file}: ${quote(node)} is built in ${path}, which the repository does not have.` })
    return found
  }).concat((mapping.verifies ?? []).flatMap((entry) => {
    const node = model.nodes[entry.element]
    if (!node) return [{ message: `${mapping.file}: tests bound to ${entry.name ? `"${entry.name}" (${entry.element})` : entry.element}, which is no element of the model.` }]
    const on = originOf(node) ? {} : { nodeId: node.id }
    const found: RuleFinding[] = []
    if (!(TESTED_TYPES as readonly string[]).includes(node.type)) found.push({ ...on, message: `${mapping.file}: tests bound to ${node.type} ${quote(node)}; only a scenario or a fitness function is checked by tests.` })
    if (entry.name !== undefined && entry.name !== node.label) found.push({ ...on, message: `${mapping.file}: ${entry.element} is named "${entry.name}"; the model calls it ${quote(node)}.` })
    return found
  }))
}

/** What in a node's checks cannot be read: lines that are no condition,
 *  units that do not convert, a combine or max_age that is none. */
function invalidChecks(model: CheckModel): RuleFinding[] {
  return Object.values(model.nodes)
    .filter((n) => (TESTED_TYPES as readonly string[]).includes(n.type))
    .flatMap((node) => {
      const what = `${TYPE_NAME[node.type]} ${quote(node)}`
      const found: RuleFinding[] = conditionsOf(node).flatMap((c) => c.kind === 'invalid' ? [{ nodeId: node.id, message: `${what}: "${c.raw}" cannot be read: ${c.problem}.` }] : [])
      if (model.measurements) {
        for (const r of conditionResults(node, model)) {
          if (r.outcome === 'invalid' && r.measurement) found.push({ nodeId: node.id, message: `${what}: "${r.condition}" cannot be evaluated: ${r.detail}.` })
        }
      }
      if (!parseCombine(prop(node, 'combine'))) found.push({ nodeId: node.id, message: `${what}: combine "${prop(node, 'combine')}" is none of all, any, at least N.` })
      if (parseMaxAge(prop(node, 'max_age')) === null) found.push({ nodeId: node.id, message: `${what}: max_age "${prop(node, 'max_age')}" is no age such as 7d, 12h or 30min.` })
      return found
    })
}


// ─── Quotes on derives: a requirement and the words of its need ────────────
// (ADR Agents check requirements against the person's words; the reading of
// the words is in words.ts)

type RelationIndex = { from: Map<string, C4Relation[]>; to: Map<string, C4Relation[]> }
const RELATION_INDEX = new WeakMap<object, Map<string, RelationIndex>>()

/** The relations of one type by their source and by their target, built once
 *  for a model's relations (rules that walk them per element stay linear). */
export function relationsOf(model: Pick<CheckModel, 'relations'>, type: string): RelationIndex {
  let byType = RELATION_INDEX.get(model.relations)
  if (!byType) { byType = new Map(); RELATION_INDEX.set(model.relations, byType) }
  let index = byType.get(type)
  if (!index) {
    index = { from: new Map(), to: new Map() }
    for (const r of Object.values(model.relations)) {
      if (r.relationType !== type) continue
      const from = index.from.get(r.sourceId); if (from) from.push(r); else index.from.set(r.sourceId, [r])
      const to = index.to.get(r.targetId); if (to) to.push(r); else index.to.set(r.targetId, [r])
    }
    byType.set(type, index)
  }
  return index
}

const READINGS = new Map<string, ValueReading>()
/** A text's values, read once. */
export function reading(text: string): ValueReading {
  let found = READINGS.get(text)
  if (!found) {
    if (READINGS.size > 20000) READINGS.clear()
    found = readValues(text); READINGS.set(text, found)
  }
  return found
}

const relationQuote = (r: C4Relation): string => {
  const q = (r as unknown as Props).quote
  return typeof q === 'string' ? q : ''
}

/** The derives relations from a requirement to a need of this model. */
const requirementToNeed = (model: CheckModel): C4Relation[] => Object.values(model.relations).filter((r) => r.relationType === 'derives'
  && model.nodes[r.sourceId]?.type === 'requirement' && model.nodes[r.targetId]?.type === 'need' && !originOf(model.nodes[r.targetId]))

/** What a requirement says, field by field as its EARS sentence reads them. */
const CONDITION_FIELDS = ['trigger', 'precondition', 'unwanted_condition']
const RESPONSE_FIELDS = ['feature', 'action']
const requirementText = (n: C4Node): string => [...CONDITION_FIELDS, ...RESPONSE_FIELDS].map((k) => prop(n, k)).join(' \n ')
const scenarioText = (n: C4Node): string => ['given', 'when', 'then', 'gherkin'].map((k) => prop(n, k)).join(' \n ')

/** The words a derives relation quotes, as the value rules read them: only a
 *  need holds a person's words, and a quote of a need's whole text that holds
 *  no answer of a person (a brief, a concern pack's paragraph) points at
 *  nothing in particular. On a need with answers the whole text is still
 *  checked. */
function quoteOf(model: Pick<CheckModel, 'nodes'>, r: C4Relation): string {
  const q = relationQuote(r)
  const need = model.nodes[r.targetId]
  if (!q || need?.type !== 'need') return ''
  const text = need.description ?? ''
  return plainWords(q) === plainWords(text) && !needAnswers(text).length ? '' : q
}

const GAPS = new WeakMap<object, WeakMap<object, Map<string, ReturnType<typeof computeGaps>>>>()

/** For a requirement: the values its quotes hold that it does not say, by
 *  the derives relation that quotes them; the values it says that none of
 *  its quotes, those of the requirements it derives from, or its rationale
 *  hold; and the values it takes from its quotes. Empty when nothing of it
 *  is quoted. A value counts as said in another form too: 20 percent as
 *  20%, 15 minutes as 900 seconds, 12.30 € as 1230 cents, "one" as 1. */
export function quoteValueGaps(model: Pick<CheckModel, 'nodes' | 'relations'>, req: C4Node): { missing: Array<{ value: string; relationId: string }>; unsupported: string[]; carried: string[] } {
  let byRelations = GAPS.get(model.nodes)
  if (!byRelations) { byRelations = new WeakMap(); GAPS.set(model.nodes, byRelations) }
  let byReq = byRelations.get(model.relations)
  if (!byReq) { byReq = new Map(); byRelations.set(model.relations, byReq) }
  let gaps = byReq.get(req.id)
  if (!gaps) { gaps = computeGaps(model, req); byReq.set(req.id, gaps) }
  return gaps
}

function computeGaps(model: Pick<CheckModel, 'nodes' | 'relations'>, req: C4Node): { missing: Array<{ value: string; relationId: string }>; unsupported: string[]; carried: string[] } {
  const derives = relationsOf(model, 'derives')
  const own = reading(requirementText(req))
  const missing: Array<{ value: string; relationId: string }> = []
  // The values the person said that the requirement says too: what its scenarios must name.
  const carried = new Set<string>()
  for (const r of derives.from.get(req.id) ?? []) {
    const q = reading(quoteOf(model, r))
    for (const value of q.values) { if (saysValueOf(q, value, own)) carried.add(value); else missing.push({ value, relationId: r.id }) }
  }
  // The words this requirement may rest on: its quotes, and those up its chain of requirements.
  const allowed: ValueReading[] = []
  const seen = new Set<string>([req.id]); const queue = [req.id]
  while (queue.length) {
    const id = queue.shift()!
    for (const r of derives.from.get(id) ?? []) {
      const q = quoteOf(model, r)
      if (q) allowed.push(reading(q))
      if (!seen.has(r.targetId) && model.nodes[r.targetId]?.type === 'requirement') { seen.add(r.targetId); queue.push(r.targetId) }
    }
  }
  if (!allowed.length) return { missing, unsupported: [], carried: [...carried] }
  allowed.push(reading(prop(req, 'rationale')))
  return { missing, unsupported: [...own.values].filter((v) => !allowed.some((a) => saysValueOf(own, v, a))), carried: [...carried] }
}

const OP_TEXT: Record<Op, string> = { '<=': 'up to and with', '<': 'below', '>=': 'from and with', '>': 'above' }
const allows = (l: { value: string; op: Op }): string => `${OP_TEXT[l.op]} ${l.value}`

/** The limits a requirement puts on numbers, each as the side it allows: a
 *  limit in its condition (trigger, precondition, unwanted condition) of a
 *  requirement that refuses is the refused side. */
function requirementLimits(req: C4Node): Limit[] {
  const response = RESPONSE_FIELDS.map((k) => prop(req, k)).join(' \n ')
  const refuses = REFUSAL.test(plainWords(response))
  return [
    ...CONDITION_FIELDS.flatMap((k) => readLimits(prop(req, k), refuses)),
    ...readLimits(response),
  ]
}

/** Where a requirement gives a value it quotes another sense: a limit on the
 *  other side of the number, another unit, the opposite order, another
 *  rounding. */
export function quoteSenseGaps(model: Pick<CheckModel, 'nodes' | 'relations'>, req: C4Node): Array<{ relationId: string; message: string }> {
  const out: Array<{ relationId: string; message: string }> = []
  const text = requirementText(req)
  const limits = requirementLimits(req)
  const own = reading(text)
  const orders = readOrders(text)
  const roundings = readRoundings(text)
  for (const r of relationsOf(model, 'derives').from.get(req.id) ?? []) {
    const q = quoteOf(model, r)
    if (!q) continue
    const need = quoteLabel(model.nodes[r.targetId])
    for (const l of readLimits(q)) {
      const same = limits.filter((m) => m.value === l.value)
      if (same.length && !same.some((m) => m.op === l.op)) {
        out.push({ relationId: r.id, message: `Requirement ${quoteLabel(req)} allows ${same.map(allows).join(' and ')} ("${same[0].text}") where the words it quotes from ${need} allow ${allows(l)} ("${l.text}"): check on which side of ${l.value} the limit is.` })
      }
    }
    for (const qty of reading(q).quantities) {
      if (own.quantities.some((m) => m.dimension === qty.dimension && m.base === qty.base)) continue
      const other = own.quantities.find((m) => m.dimension === qty.dimension && m.value === qty.value)
      if (other) out.push({ relationId: r.id, message: `Requirement ${quoteLabel(req)} says "${other.text}" where the words it quotes from ${need} say "${qty.text}".` })
    }
    for (const o of readOrders(q)) {
      if (!orders.has(o) && orders.has(oppositeOrder(o))) out.push({ relationId: r.id, message: `Requirement ${quoteLabel(req)} lists ${oppositeOrder(o).replace('-', ' ')} where the words it quotes from ${need} say ${o.replace('-', ' ')}.` })
    }
    const said = readRoundings(q)
    if (said.size && roundings.size && ![...said].some((x) => roundings.has(x))) {
      out.push({ relationId: r.id, message: `Requirement ${quoteLabel(req)} rounds ${[...roundings].join(', ')} where the words it quotes from ${need} say ${[...said].join(', ')}.` })
    }
  }
  return out
}

const quoteLabel = (n: C4Node): string => `"${n.label}"`

/** The requirements a need leads to: those that derive from it, and those
 *  that derive from them. */
function requirementsOfNeed(model: CheckModel, needId: string): C4Node[] {
  const derives = relationsOf(model, 'derives')
  const found = new Map<string, C4Node>(); const queue = [needId]
  while (queue.length) {
    for (const r of derives.to.get(queue.shift()!) ?? []) {
      const n = model.nodes[r.sourceId]
      if (n?.type === 'requirement' && !found.has(n.id)) { found.set(n.id, n); queue.push(n.id) }
    }
  }
  return [...found.values()]
}

/** The scenarios that verify a requirement. */
const scenariosOf = (model: CheckModel, reqId: string): C4Node[] => (relationsOf(model, 'verifies').to.get(reqId) ?? [])
  .map((r) => model.nodes[r.sourceId]).filter((n): n is C4Node => n?.type === 'scenario')

/** A test source's values, read leniently: numbers inside identifiers and
 *  strings ("14T18:00", 1_000, K/2026/0001) and toBeNull's null count. */
/** A value that tells a case apart: not a small count (2 rows, 3 steps),
 *  which a test writes in many ways, nor a date or a time of day, which a
 *  scenario gives as an illustration a test may choose otherwise. */
const telling = (v: string): boolean => !/^\d$/.test(v) && !(/^[a-z]+$/.test(v) && v.length < 3) && !/^\d{4}-\d{2}-\d{2}$|^\d{2}:\d{2}$/.test(v)

const sourceReading = (text: string): ValueReading => reading(text
  .replace(/(\d)_(?=\d)/g, '$1')
  .replace(/\b(?:toBe|is|assert)(Null|True|False)\b/g, ' $1 ')
  .replace(/(\d)([a-z])/gi, '$1 $2')
  .replace(/([a-z/])(\d)/gi, '$1 $2'))

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
    id: 'derives-quote-missing',
    description: 'A requirement\'s derives relation to a need quotes the words of the need it rests on (property quote, one verbatim fragment per line). Off unless check.json turns it on; the goal requirements-quoting-need follows it in percent.',
    severity: 'warning',
    off: true,
    dimension: 'traceability',
    run: (model) => requirementToNeed(model).filter((r) => !quoteFragments(relationQuote(r)).length)
      .map((r) => ({ nodeId: r.sourceId, message: `Requirement ${quote(model.nodes[r.sourceId])} derives from need ${quote(model.nodes[r.targetId])} without quoting the words it rests on.` })),
  },
  {
    id: 'derives-quote-not-in-need',
    description: 'Every fragment a derives relation quotes is in the need\'s text, as whole words (case, white space, Markdown marks, dashes and quotation marks aside; an ellipsis joins pieces that must be there in that order, within one question, answer or the text before the questions), and holds at least two words; only a relation to a need quotes.',
    severity: 'error',
    dimension: 'traceability',
    run: (model) => Object.values(model.relations).filter((r) => r.relationType === 'derives' && relationQuote(r).trim()
      && model.nodes[r.sourceId]?.type === 'requirement' && !originOf(model.nodes[r.sourceId])).flatMap((r) => {
      const req = model.nodes[r.sourceId]; const target = model.nodes[r.targetId]
      if (!target) return []
      if (target.type !== 'need') return [{ relationId: r.id, message: `Requirement ${quote(req)} quotes words on its relation to ${target.type} ${quote(target)}: only a need holds a person's words. Quote them on the requirement's relation to the need.` }]
      if (originOf(target)) return []
      const text = target.description ?? ''
      return quoteFragments(relationQuote(r)).flatMap((pieces) => fragmentWords(pieces) < 2
        ? [{ relationId: r.id, message: `Requirement ${quote(req)} quotes "${pieces.join(' … ')}", too short to say which words of need ${quote(target)} it rests on: quote the words around it.` }]
        : quoteFound(text, pieces) ? []
        : [{ relationId: r.id, message: `Requirement ${quote(req)} quotes "${pieces.join(' … ')}", which need ${quote(target)} does not say${pieces.length > 1 ? ' in that order within one answer' : ''}.` }])
    }),
  },
  {
    id: 'quote-value-missing',
    description: 'Every hard value a derives relation quotes (a number, null, true or false, a date or time, an identifier in backticks or quotation marks) is in the requirement\'s sentence, in that form or another (20 percent as 20%, 15 minutes as 900 seconds, 12.30 € as 1230 cents).',
    severity: 'warning',
    dimension: 'traceability',
    run: (model) => nodesOf(model, 'requirement').filter((n) => !originOf(n)).flatMap((req) => {
      const byRelation = new Map<string, string[]>()
      for (const g of quoteValueGaps(model, req).missing) byRelation.set(g.relationId, [...byRelation.get(g.relationId) ?? [], g.value])
      return [...byRelation].map(([relationId, values]) => ({ relationId, message: `Requirement ${quote(req)} does not say ${values.map((v) => `"${v}"`).join(', ')}, which the words it quotes from ${quote(model.nodes[model.relations[relationId].targetId])} say.` }))
    }),
  },
  {
    id: 'quote-value-differs',
    description: 'A requirement keeps the sense the words it quotes give a value: the same side of a limit (at most, more than, from … to; a refusal speaks of the other side), the same unit, the same order of a list, the same rounding.',
    severity: 'warning',
    dimension: 'traceability',
    run: (model) => nodesOf(model, 'requirement').filter((n) => !originOf(n)).flatMap((req) => quoteSenseGaps(model, req)),
  },
  {
    id: 'requirement-value-unquoted',
    description: 'Every hard value a requirement states that quotes its need is in those quotes (or in those of the requirements it derives from), in that form or another, or its rationale names it as a decision of the model.',
    severity: 'warning',
    dimension: 'traceability',
    run: (model) => nodesOf(model, 'requirement').filter((n) => !originOf(n)).flatMap((req) => {
      const { unsupported } = quoteValueGaps(model, req)
      return unsupported.length ? [{ nodeId: req.id, message: `Requirement ${quote(req)} says ${unsupported.map((v) => `"${v}"`).join(', ')}, which none of the words it quotes say: correct it to what the person said, or say in its rationale that ${unsupported.length === 1 ? 'it is' : 'they are'} the model's decision.` }] : []
    }),
  },
  {
    id: 'scenario-value-missing',
    description: 'Every hard value a requirement takes from the words it quotes is in a scenario that verifies it (its given, when, then or Gherkin text): what the person said reaches a check.',
    severity: 'warning',
    dimension: 'traceability',
    run: (model) => nodesOf(model, 'requirement').filter((n) => !originOf(n)).flatMap((req) => {
      const scenarios = scenariosOf(model, req.id)
      if (!scenarios.length) return []
      const gaps = quoteValueGaps(model, req)
      if (!gaps.carried.length) return []
      const quoted = relationsOf(model, 'derives').from.get(req.id) ?? []
      const from = quoted.map((r) => reading(quoteOf(model, r)))
      const readings = scenarios.map((sc) => reading(scenarioText(sc)))
      const missing = gaps.carried.filter((v) => !readings.some((sc) => from.some((q) => q.values.has(v) && saysValueOf(q, v, sc))))
      return missing.length ? [{ nodeId: req.id, relatedIds: scenarios.map((sc) => sc.id), message: `Requirement ${quote(req)} takes ${missing.map((v) => `"${v}"`).join(', ')} from the words it quotes, which ${scenarios.length === 1 ? `its scenario ${quote(scenarios[0])} does not say` : `none of its ${scenarios.length} scenarios says`}: a scenario that checks the requirement names the values the person gave.` }] : []
    }),
  },
  {
    id: 'example-not-in-scenario',
    description: 'Every example a need gives with values ("for example", "e.g.", "Example:") is whole in one scenario of the requirements derived from the need: the person\'s own case checks what they meant.',
    severity: 'warning',
    dimension: 'traceability',
    run: (model) => nodesOf(model, 'need').filter((n) => !originOf(n)).flatMap((need) => {
      const scenarios = [...new Map(requirementsOfNeed(model, need.id).flatMap((req) => scenariosOf(model, req.id)).map((sc) => [sc.id, sc])).values()]
      if (!scenarios.length) return []
      const readings = scenarios.map((sc) => ({ sc, reading: reading(scenarioText(sc)) }))
      return needParts(need.description ?? '').filter((part) => part.kind !== 'question' && !/\(no requirement\)/i.test(part.text))
        .flatMap((part) => exampleSentences(part.text)).flatMap((example) => {
          const ex = reading(example)
          const closest = readings.map(({ sc, reading: r }) => ({ sc, missing: [...ex.values].filter((v) => !saysValueOf(ex, v, r)) }))
            .sort((x, y) => x.missing.length - y.missing.length)[0]
          if (!closest.missing.length) return []
          const shown = example.length > 140 ? `${example.slice(0, 139)}…` : example
          return [{ nodeId: need.id, relatedIds: [closest.sc.id], message: `Need ${quote(need)} gives the example "${shown}", which no scenario of its requirements holds whole: the closest, ${quote(closest.sc)}, does not say ${closest.missing.map((v) => `"${v}"`).join(', ')}. A scenario with the person's own example checks what they meant.` }]
        })
    }),
  },
  {
    id: 'scenario-value-untested',
    description: 'With the test sources (radical check reads the files of the tests .radical/radical.json binds): every hard value a scenario names that tells a case apart (not a count below 10) is in the file of a test bound to it.',
    severity: 'warning',
    dimension: 'traceability',
    run: (model) => {
      const sources = model.testSources
      if (!sources) return []
      return nodesOf(model, 'scenario').filter((n) => !originOf(n)).flatMap((sc) => {
        const bound = (sc as unknown as Props)[BOUND_TESTS]
        const tests = Array.isArray(bound) ? (bound as string[]).filter((id) => typeof sources[id] === 'string') : []
        if (!tests.length) return []
        const said = reading(scenarioText(sc))
        const source = sourceReading(tests.map((id) => sources[id]).join('\n'))
        const text = tests.map((id) => sources[id]).join('\n').toLowerCase()
        // A name the scenario quotes counts anywhere in the file, in any case (typeOfBroker).
        const missing = [...said.values].filter((v) => telling(v) && !saysValueOf(said, v, source) && !(/[a-z]/.test(v) && text.includes(v)))
        return missing.length ? [{ nodeId: sc.id, details: tests, message: `Scenario ${quote(sc)} names ${missing.map((v) => `"${v}"`).join(', ')}, which ${tests.length === 1 ? 'the file of the test bound to it does not use' : `the files of the ${tests.length} tests bound to it do not use`}: a test that checks the scenario uses the values it names, or the scenario says what the test checks.` }] : []
      })
    },
  },
  {
    id: 'need-answer-unquoted',
    description: 'Every answer of a person in a need (from a line that starts with A:, Answer: or A1:, or an answer on its question\'s line) is quoted by a requirement that derives from the need, or marked (no requirement).',
    severity: 'warning',
    dimension: 'traceability',
    run: (model) => {
      const quotes = new Map<string, string[][]>()
      for (const r of requirementToNeed(model)) quotes.set(r.targetId, [...quotes.get(r.targetId) ?? [], ...quoteFragments(relationQuote(r))])
      return nodesOf(model, 'need').filter((n) => !originOf(n)).flatMap((need) => needAnswers(need.description ?? '')
        .filter((answer) => !/\(no requirement\)/i.test(answer))
        .filter((answer) => { const text = plainWords(answer); return !(quotes.get(need.id) ?? []).some((pieces) => pieces.some((piece) => wordsAt(text, piece) >= 0)) })
        .map((answer) => ({ nodeId: need.id, message: `No requirement quotes this answer in need ${quote(need)}: "${answer.replace(/\s+/g, ' ').slice(0, 90)}${answer.length > 90 ? '…' : ''}" Quote it on a requirement's derives relation, or mark it (no requirement).` })))
    },
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
        // A waiver says why another model's decision does not apply: nothing to check.
        .filter((n) => !Object.values(model.relations).some((r) => r.relationType === 'waives' && r.sourceId === n.id))
        .map((n) => ({ nodeId: n.id, message: `No fitness function implements accepted ADR ${quote(n)}.` }))
      : [],
  },
  {
    id: 'inherited-adr-unapplied',
    description: 'Every accepted ADR of a model this one depends on (deps.json) binds it: it constrains at least one of this model\'s elements, or an accepted ADR of this model waives it and says why.',
    severity: 'error',
    dimension: 'decisions',
    run: (model) => inheritedDecisions(model).filter((d) => !d.elements.length).map(({ adr, origin }) => ({
      relatedIds: [adr.id],
      message: `ADR ${quote(adr)} of ${origin} binds this model and applies to none of its elements: link it with constrains to the elements it governs, or record an accepted ADR of this model that waives it and says why.`,
    })),
  },
  {
    id: 'inherited-adr-unchecked',
    description: 'Every element an accepted ADR of a model this one depends on constrains is checked: a fitness function implements the ADR (this model\'s or the other\'s) and names its check (metric conditions, or tests .radical/radical.json binds to it).',
    severity: 'error',
    dimension: 'decisions',
    run: (model) => inheritedDecisions(model).flatMap(({ adr, origin, elements }) => {
      if (!model.metamodel.nodeTypes['fitness-fn'] || linkedNodes(model, adr.id, 'implements', 'source', 'fitness-fn').some(namesCheck)) return []
      return elements.map((e) => ({
        nodeId: e.id,
        relatedIds: [adr.id],
        message: `Nothing checks ADR ${quote(adr)} of ${origin} on ${e.type} ${quote(e)}: add a fitness function that implements the ADR and names its check (metrics, or tests .radical/radical.json binds to it).`,
      }))
    }),
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
    run: (model) => unboundDecisions(model.concerns ?? [], model.nodes, model.relations, model.metamodel)
      .map(({ adr, concern, checks, bindTo }) => ({
        nodeId: adr.id,
        ...(checks.length ? { relatedIds: checks } : {}),
        code: concern,
        message: `ADR ${quote(adr)} settles the concern "${concern}" but constrains no element, so it settles it for nothing.${bindTo.length ? ` Bind it to ${bindTo.map((id) => quote(model.nodes[id])).join(', ')}, which the concern applies to.` : ''}`,
      })),
  },
  {
    id: 'scenario-without-metrics',
    description: 'Every scenario has what checks it: tests the repository\'s .radical/radical.json binds to it, or metric conditions (property `metrics`, one per line: `<metric>{<labels>} <op> <number> [unit]`). One the repository must verify is scenario-not-verified-here\'s.',
    severity: 'warning',
    dimension: 'traceability',
    run: (model) => nodesOf(model, 'scenario').filter((n) => !conditionsOf(n).length && !verifiedHere(model, n))
      .map((n) => ({ nodeId: n.id, message: `Scenario ${quote(n)} names no check.` })),
  },
  {
    id: 'scenario-not-verified-here',
    description: 'With the repository\'s .radical/radical.json (the CLI): every scenario of a requirement an element the repository builds satisfies has tests the file binds to it, or metric conditions.',
    severity: 'warning',
    dimension: 'traceability',
    run: (model) => nodesOf(model, 'scenario').filter((n) => !conditionsOf(n).length && verifiedHere(model, n))
      .map((n) => ({ nodeId: n.id, message: `Scenario ${quote(n)} is this repository's to verify (an element it builds satisfies its requirement), and ${model.repository!.file} binds no test to it: radical verify ${n.id} --test "<file> › <title>".` })),
  },
  {
    id: 'model-names-tests',
    description: 'A scenario or fitness function names no test in its Metrics: the repository binds its tests in .radical/radical.json (radical setup moves them there). A test named in Metrics still counts.',
    severity: 'warning',
    dimension: 'traceability',
    run: (model) => Object.values(model.nodes).filter((n) => (TESTED_TYPES as readonly string[]).includes(n.type) && !originOf(n))
      .flatMap((n) => {
        const named = parseConditions((n as unknown as Props).metrics).filter((c) => c.kind === 'test').length
        return named ? [{ nodeId: n.id, message: `${TYPE_NAME[n.type]} ${quote(n)} names ${named} test${named === 1 ? '' : 's'} in its Metrics; ${named === 1 ? 'it belongs' : 'they belong'} in .radical/radical.json (radical setup moves them).` }] : []
      }),
  },
  {
    id: 'fitness-fn-without-metrics',
    description: 'Every fitness function states what checks it and when it passes (property `metrics`, one condition per line).',
    severity: 'warning',
    dimension: 'decisions',
    run: (model) => nodesOf(model, 'fitness-fn').filter((n) => !conditionsOf(n).length)
      .map((n) => ({ nodeId: n.id, message: `Fitness function ${quote(n)} names no check.` })),
  },
  {
    id: 'fitness-fn-unclassified',
    description: 'Every fitness function states its characteristic (ISO/IEC 25010), scope, cadence (with the event it is triggered on, or how often a temporal one falls due) and invocation.',
    severity: 'warning',
    dimension: 'decisions',
    run: (model) => nodesOf(model, 'fitness-fn').flatMap((n) => {
      const missing = ['characteristic', 'scope', 'cadence'].filter((k) => !prop(n, k))
      if (prop(n, 'cadence') === 'triggered' && !prop(n, 'trigger')) missing.push('trigger')
      if (prop(n, 'cadence') === 'temporal' && !prop(n, 'every')) missing.push('every')
      if (!prop(n, 'invocation')) missing.push('invocation')
      return missing.length ? [{ nodeId: n.id, message: `Fitness function ${quote(n)} states no ${missing.join(', ')}.` }] : []
    }),
  },
  {
    id: 'fitness-fn-measure-invalid',
    description: `Every line of a fitness function's \`measure\` names a sensor of radical sense (${SENSOR_NAMES.join(', ')}) or, run by the CLI, one of the repository's .radical/sensors/sensors.json.`,
    severity: 'error',
    dimension: 'completeness',
    run: (model) => model.sensors === undefined ? [] : nodesOf(model, 'fitness-fn').flatMap((n) => parseMeasure((n as unknown as Props).measure)
      .filter((line) => !isSensorName(line.sensor) && !model.sensors?.names.includes(line.sensor))
      .map((line) => ({
        nodeId: n.id,
        message: `Fitness function ${quote(n)}: measure "${line.raw}" names no sensor; radical sense has ${SENSOR_NAMES.join(', ')}, ${model.sensors
          ? `${model.sensors.file} ${model.sensors.names.length ? model.sensors.names.join(', ') : 'none'}`
          : 'and the repository has no .radical/sensors/sensors.json'}.`,
      }))),
  },
  {
    id: 'repository-mapping',
    description: 'With the repository\'s .radical/radical.json (the CLI): each entry names an element of the model, its own or another model\'s of the federation, under the element\'s name, with paths the repository has; tests are bound to scenarios and fitness functions.',
    severity: 'warning',
    dimension: 'traceability',
    run: repositoryMapping,
  },
  {
    id: 'repository-settings-in-model',
    description: 'The model\'s check.json holds the model\'s rules and goals; the repository\'s test files (test-unbound\'s include and exclude) and CI\'s artifacts belong in .radical/radical.json ("tests", "ci"). Those in check.json are still read.',
    severity: 'warning',
    dimension: 'completeness',
    run: (model) => (model.settingsInModel ?? []).map((what) => ({
      path: 'check.json',
      message: `check.json holds the repository's ${what}; ${what.startsWith('ci') ? 'they belong in .radical/radical.json ("ci": { "artifacts": [...] })' : 'it belongs in .radical/radical.json ("tests": { "include": [...], "exclude": [...] })'}.`,
    })),
  },
  {
    id: 'description-path-missing',
    description: 'With the repository (the CLI): a path from the repository\'s root an element\'s description names (apps/cli/src/sense.ts) is in the repository; one that is gone tells of code that moved.',
    severity: 'warning',
    dimension: 'consistency',
    run: (model) => Object.entries(model.missingPaths ?? {}).flatMap(([id, paths]) => {
      const node = model.nodes[id]
      return node && paths.length ? [{ nodeId: id, message: `${TYPE_LABEL(node)} ${quote(node)} names ${paths.join(', ')}, which the repository does not have.` }] : []
    }),
  },
  {
    id: 'measure-with-arguments',
    description: 'A fitness function\'s measure lines name sensors only: an adapter\'s arguments (files, options of the repository) belong to a sensor of .radical/sensors/sensors.json ({ "adapter": "playwright", "args": [...] }). A line with arguments still runs.',
    severity: 'warning',
    dimension: 'completeness',
    run: (model) => nodesOf(model, 'fitness-fn').flatMap((n) => parseMeasure((n as unknown as Props).measure)
      .filter((line) => line.args.length > 0)
      .map((line) => ({ nodeId: n.id, message: `Fitness function ${quote(n)}: measure "${line.raw}" has the repository's arguments; name a sensor of .radical/sensors/sensors.json that holds them ({ "adapter": "${line.sensor}", "args": [...] }).` }))),
  },
  {
    id: 'metric-invalid',
    description: 'Every line of a scenario\'s or fitness function\'s `metrics` reads as a condition, its unit converts to the unit of the measurement it matches, and `combine` and `max_age` read.',
    severity: 'error',
    dimension: 'completeness',
    run: invalidChecks,
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
    run: (model) => testRule('not-found', (node, id) => model.testsReadAt
      ? `${TYPE_NAME[node.type]} ${quote(node)}: no test ${id} in the test results read ${model.testsReadAt.slice(0, 10)}, ${formatAge((model.now ?? Date.now()) - Date.parse(model.testsReadAt))} ago; added since, renamed or deleted? radical check --report reads the tests again.`
      : `${TYPE_NAME[node.type]} ${quote(node)}: no test ${id} in the reports, though its file ran; renamed or deleted?${brokenWith(model, node)}`)(model)
      .map((f) => (model.testsReadAt ? { ...f, asOf: model.testsReadAt } : f)),
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
    id: 'metric-failed',
    description: 'With measurements: every metric condition a scenario or fitness function states holds for the latest measurement it matches.',
    severity: 'error',
    dimension: 'tests',
    readsMeasurements: true,
    run: metricRule('failed', (node, condition, seen, why) => `${TYPE_NAME[node.type]} ${quote(node)}: ${condition} does not hold${seen}${why ? `; ${why}` : ''}.`),
  },
  {
    id: 'metric-stale',
    description: 'With measurements: the latest measurement each metric condition matches is no older than the element\'s max_age (a stale one never passes).',
    severity: 'warning',
    dimension: 'tests',
    readsMeasurements: true,
    run: metricRule('stale', (node, condition, seen) => `${TYPE_NAME[node.type]} ${quote(node)}: ${condition} has only a stale measurement${seen}.`),
  },
  {
    id: 'metric-not-measured',
    description: 'With measurements: a measurement matches every metric condition a scenario or fitness function states.',
    severity: 'warning',
    dimension: 'tests',
    readsMeasurements: true,
    run: metricRule('not-run', (node, condition, seen, why) => why
      ? `${TYPE_NAME[node.type]} ${quote(node)}: ${condition} was not evaluated: ${why}${seen}.`
      : `${TYPE_NAME[node.type]} ${quote(node)}: nothing measured ${condition}.`),
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


/** The rules about the person's words: a write through the MCP server tells
 *  the agent at once what it brings in of them (ADR Agents check
 *  requirements against the person's words). */
export const WORD_RULES: ReadonlySet<string> = new Set(['derives-quote-not-in-need', 'quote-value-missing', 'quote-value-differs', 'requirement-value-unquoted', 'scenario-value-missing', 'example-not-in-scenario', 'need-answer-unquoted'])

/** What the word rules find in a model, each with its rule and severity;
 *  `off`, the rules check.json turns off. */
export function wordFindings(model: CheckModel, off: ReadonlySet<string> = new Set()): Array<{ rule: string; severity: CheckSeverity; message: string }> {
  return CHECK_RULES.filter((r) => WORD_RULES.has(r.id) && !off.has(r.id))
    .flatMap((rule) => rule.run(model).map((f) => ({ rule: rule.id, severity: f.severity ?? rule.severity, message: f.message })))
}
