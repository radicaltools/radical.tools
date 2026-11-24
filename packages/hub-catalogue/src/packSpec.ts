// ─── Concern pack specs ──────────────────────────────────────────────────────
//
// A concern pack is written as a spec (packs/<group>/<id>.ts, the default
// export) and built into catalogue/concern/<id>.radical by
// scripts/build-packs.ts; tests/concernPacks.test.ts checks that the files
// are what the specs build. The spec keeps the parts of a pack together: its
// questions, the requirements with the scenario that verifies each, the
// decisions per answer and the fitness functions with their tool and
// snippet. `when` names the answers an element is imported for (hubWhen);
// {{KEY}} in a text is filled with an answer. ADR Concern groups and pack
// standard (packages/common/src/concerns.ts checks the result).

import type { HubRadicalDoc, HubSource, TemplateParam } from '@radical/common/hubFormat'
import type { ConcernGroupId } from '@radical/common/concerns'
import { FITNESS_CHARACTERISTICS, FITNESS_TRIGGERS } from '@radical/common/metamodel'
import { parseConditions, parseMeasure } from '@radical/common/check'

/** Answers an element is imported for: every key listed must hold one of its values. */
export type When = Record<string, string[]>

export interface QuestionSpec {
  key: string
  /** A word or two, for the wizard's step. */
  title: string
  /** The question. */
  label: string
  /** Why it matters, shown under the question. */
  hint: string
  default: string
  /** value, label (fills {{KEY}} in texts), and what it means and when to pick it. */
  options: Array<{ value: string; label: string; description: string }>
}

export interface DetailSpec {
  key: string
  label: string
  default: string
  number?: boolean
}

export interface ScenarioSpec {
  label: string
  given: string
  when: string
  then: string
}

export type RequirementSpec = {
  id: string
  label: string
  when?: When
  rationale: string
  scenario: ScenarioSpec
  /** Why no fitness function checks it: only for a requirement the team
   *  keeps by hand (a review, a drill on the calendar). Every other
   *  requirement is named in the `checks` of a fitness function imported
   *  with it. */
  unchecked?: string
} & (
  | { ears_type: 'ubiquitous'; action: string }
  | { ears_type: 'event-driven'; trigger: string; action: string }
  | { ears_type: 'state-driven'; precondition: string; action: string }
  | { ears_type: 'unwanted-behaviour'; unwanted_condition: string; action: string }
)

export interface AdrSpec {
  id: string
  label: string
  when?: When
  /** Defaults to the pack's forces. */
  context?: string
  decision: string
  consequences: string
  alternatives: string
}

export type FitnessCharacteristic = typeof FITNESS_CHARACTERISTICS[number]
export type FitnessTrigger = typeof FITNESS_TRIGGERS[number]
export const FITNESS_SCOPES = ['atomic', 'holistic'] as const
export type FitnessScope = typeof FITNESS_SCOPES[number]
export const FITNESS_CADENCES = ['triggered', 'continual', 'temporal'] as const
export type FitnessCadence = typeof FITNESS_CADENCES[number]
export const FITNESS_INVOCATIONS = ['automated', 'manual'] as const
export type FitnessInvocation = typeof FITNESS_INVOCATIONS[number]

/** The sensors of radical sense a pack's fitness function may name: their
 *  metric names are fixed by the CLI, with no file of the project to read. */
export const PACK_SENSORS = ['github-actions', 'lighthouse', 'machine'] as const

export interface FitnessSpec {
  id: string
  label: string
  when?: When
  /** What it protects: an ISO/IEC 25010:2023 characteristic. */
  characteristic: FitnessCharacteristic
  /** One part in one context (a linter rule, a unit test), or several parts
   *  together at run time (a load test, DAST, chaos, end to end). */
  scope: FitnessScope
  /** On an event, all the time (monitoring), or after a time (a review). */
  cadence: FitnessCadence
  /** The event a triggered one runs on: only when triggered. */
  trigger?: FitnessTrigger
  /** How often a temporal one falls due, as in "90d": only when temporal. */
  every?: string
  /** Run by a sensor, or by a person. */
  invocation: FitnessInvocation
  threshold: string
  /** The built-in sensors that measure it, one a line, by name only
   *  (PACK_SENSORS): their metric names are fixed, so a pack can know them.
   *  A project's own tests and sensors it cannot know. */
  measure?: string
  /** Conditions over what those sensors measure, one a line, filled by the
   *  answers (`ci.pr.duration.p90 <= {{PIPELINE_MINUTES}} min`); never a
   *  test() line, as a pack cannot know the project's tests. */
  metrics?: string
  /** How it is checked, in prose. */
  description: string
  /** The tool that runs it: a name, as in "gitleaks" or "k6". */
  tool: string
  /** A rule, test or config to copy, in `language`. */
  snippet: string
  language: string
  /** The ADRs of the pack it checks. */
  implements: string[]
  /** The requirements of the pack it checks: each must be imported only
   *  with answers that import this function too (or another that checks
   *  it). Spec-level: not written into the document. */
  checks?: string[]
}

export interface PackSpec {
  id: string
  name: string
  group: ConcernGroupId
  description: string
  tags: string[]
  concern: { id: string; trigger: string; applyTo?: 'source' | 'target'; why: string }
  sources: HubSource[]
  questions: QuestionSpec[]
  details?: DetailSpec[]
  need: { label: string; text: string }
  /** The context of every ADR that has none of its own. */
  forces: string
  requirements: RequirementSpec[]
  adrs: AdrSpec[]
  fitness: FitnessSpec[]
}

const COLUMN: Record<string, number> = { need: 0, requirement: 1, scenario: 2, adr: 3, 'fitness-fn': 4 }

/** The .radical document a spec builds. */
export function buildPackDoc(spec: PackSpec): HubRadicalDoc {
  const nodes: Array<Record<string, unknown>> = []
  const relations: Array<Record<string, unknown>> = []
  const rows: Record<number, number> = {}
  const node = (id: string, type: string, label: string, when: When | undefined, props: Record<string, unknown>): void => {
    const col = COLUMN[type]
    const row = rows[col] ?? 0
    rows[col] = row + 1
    nodes.push({ id, type, label, x: col * 260, y: row * 130, ...props, ...(when ? { hubWhen: when } : {}) })
  }
  const rel = (relationType: string, sourceId: string, targetId: string, props: Record<string, unknown> = {}): void => {
    relations.push({ id: `${sourceId}--${relationType}--${targetId}`, sourceId, targetId, relationType, ...props })
  }

  node('need', 'need', spec.need.label, undefined, { kind: 'brief', source: `Hub concern pack: ${spec.name}`, description: spec.need.text })
  for (const r of spec.requirements) {
    const { id, label, when, scenario: _scenario, ...ears } = r
    node(id, 'requirement', label, when, ears)
    // The pack's need is one paragraph that every requirement rests on: each quotes it whole.
    rel('derives', id, 'need', { quote: spec.need.text })
  }
  for (const r of spec.requirements) {
    const id = `sc-${r.id.replace(/^req-/, '')}`
    node(id, 'scenario', r.scenario.label, r.when, { given: r.scenario.given, when: r.scenario.when, then: r.scenario.then })
    rel('verifies', id, r.id)
  }
  for (const a of spec.adrs) {
    node(a.id, 'adr', a.label, a.when, {
      concern: spec.concern.id, status: 'accepted', date: '',
      context: a.context ?? spec.forces, decision: a.decision, consequences: a.consequences, alternatives: a.alternatives,
    })
  }
  for (const f of spec.fitness) {
    node(f.id, 'fitness-fn', f.label, f.when, {
      characteristic: f.characteristic,
      scope: f.scope,
      cadence: f.cadence,
      ...(f.cadence === 'triggered' ? { trigger: f.trigger } : {}),
      ...(f.cadence === 'temporal' ? { every: f.every } : {}),
      invocation: f.invocation,
      ...(f.measure ? { measure: f.measure.trim() } : {}),
      ...(f.metrics ? { metrics: f.metrics.trim() } : {}),
      // The pack cannot know the project's tests or metric names: the
      // criterion goes into the text, for the team to turn into conditions
      // in `metrics` once they have the sensor or the test that checks it.
      description: `${f.description.trim()}\n\nThreshold: ${f.threshold.trim()}\n\nTool: ${f.tool}\n\n\`\`\`${f.language}\n${f.snippet.trim()}\n\`\`\``,
    })
    for (const a of f.implements) rel('implements', f.id, a)
  }

  const templateParams: TemplateParam[] = [
    ...spec.questions.map((q) => ({ key: q.key, title: q.title, label: q.label, hint: q.hint, defaultValue: q.default, options: q.options })),
    ...(spec.details ?? []).map((d) => ({ key: d.key, label: d.label, defaultValue: d.default, ...(d.number ? { type: 'number' as const } : {}) })),
  ]
  return {
    hub: {
      id: spec.id,
      category: 'concern',
      name: spec.name,
      description: spec.description,
      tags: spec.tags,
      requiredMetamodel: 'c4-ddd-governance-builtin',
      concern: { ...spec.concern, group: spec.group },
      sources: spec.sources,
      templateParams,
    },
    nodes,
    relations,
  }
}

/** A .radical file's text, as the catalogue keeps it. */
export const packFileText = (spec: PackSpec): string => `${JSON.stringify(buildPackDoc(spec), null, 2)}\n`

/** Where a spec's built file goes, relative to the catalogue. */
export const packFile = (spec: Pick<PackSpec, 'id'>): string => `concern/${spec.id}.radical`

/** Whether an element with `when` comes in for the answers. */
const importedFor = (when: When | undefined, values: Record<string, string>): boolean =>
  !when || Object.entries(when).every(([key, wanted]) => wanted.includes(values[key] ?? ''))

/** Every combination of the answers to the questions. */
const combinationsOf = (spec: PackSpec): Array<Record<string, string>> =>
  spec.questions.reduce<Array<Record<string, string>>>(
    (all, q) => all.flatMap((answers) => q.options.map((o) => ({ ...answers, [q.key]: o.value }))),
    [{}],
  )

/** What a fitness function lacks of its classification: a characteristic,
 *  scope, cadence and invocation from their lists, the trigger of a
 *  triggered one and the period of a temporal one, and neither where it
 *  does not belong. */
function classificationProblems(f: FitnessSpec): string[] {
  const errors: string[] = []
  const at = `fitness function "${f.id}"`
  const oneOf = (key: 'characteristic' | 'scope' | 'cadence' | 'invocation' | 'trigger', allowed: readonly string[]): void => {
    const v = f[key] as unknown
    if (v === undefined || v === '') errors.push(`${at} states no ${key} (one of ${allowed.join(', ')})`)
    else if (!allowed.includes(String(v))) errors.push(`${at}: ${key} "${String(v)}" is not one of ${allowed.join(', ')}`)
  }
  oneOf('characteristic', FITNESS_CHARACTERISTICS)
  oneOf('scope', FITNESS_SCOPES)
  oneOf('cadence', FITNESS_CADENCES)
  oneOf('invocation', FITNESS_INVOCATIONS)
  // Where the cadence is missing or unknown, that is the one problem: what
  // belongs with it cannot be told.
  if (FITNESS_CADENCES.includes(f.cadence)) {
    if (f.cadence === 'triggered') oneOf('trigger', FITNESS_TRIGGERS)
    else if (f.trigger !== undefined) errors.push(`${at} has a trigger but is not triggered`)
    if (f.cadence === 'temporal') {
      if (!f.every?.trim()) errors.push(`${at} is temporal but states no every (as in "90d")`)
      else if (!/^(\d+|\{\{[A-Z0-9_]+\}\})[dw]$/.test(f.every.trim())) errors.push(`${at}: every "${f.every}" is no period (as in "90d", or "{{DAYS}}d" filled by an answer)`)
    } else if (f.every !== undefined) errors.push(`${at} has an every but is not temporal`)
  }
  if ('category' in f) errors.push(`${at} still has a category: state its characteristic, scope, cadence and invocation instead`)
  for (const line of parseMeasure(f.measure)) {
    if (!(PACK_SENSORS as readonly string[]).includes(line.sensor)) errors.push(`${at} measures with ${line.sensor}: a pack names only the built-in sensors whose metrics it knows (${PACK_SENSORS.join(', ')})`)
    else if (line.args.length) errors.push(`${at}: measure line "${line.raw}" has arguments, which belong to the project's .radical/sensors/sensors.json`)
  }
  if (f.metrics !== undefined) {
    if (f.invocation !== 'automated') errors.push(`${at} states metrics but is not automated`)
    if (!parseMeasure(f.measure).length) errors.push(`${at} states metrics but no measure: name the built-in sensor that measures them`)
    // Filled with a number, as the answers will fill them.
    for (const c of parseConditions(f.metrics.replace(/\{\{[A-Z0-9_]+\}\}/g, '1'))) {
      if (c.kind === 'invalid') errors.push(`${at}: metrics line "${c.raw}": ${c.problem}`)
      else if (c.kind === 'test') errors.push(`${at}: metrics line "${c.raw}" names a test, which a pack cannot know`)
    }
  }
  return errors
}

/** What a spec lacks of the standard beyond what its document shows: every
 *  fitness function is classified; every requirement is checked by a
 *  fitness function imported whenever it is, or says why the team keeps it
 *  by hand; every `checks` and `unchecked` is well-formed. */
export function specProblems(spec: PackSpec): string[] {
  const errors: string[] = []
  const reqIds = new Set(spec.requirements.map((r) => r.id))
  for (const f of spec.fitness) {
    errors.push(...classificationProblems(f))
    for (const id of f.checks ?? []) if (!reqIds.has(id)) errors.push(`fitness function "${f.id}" checks "${id}", which is no requirement of the pack`)
  }
  const combinations = combinationsOf(spec)
  for (const r of spec.requirements) {
    const checkers = spec.fitness.filter((f) => f.checks?.includes(r.id))
    if (r.unchecked !== undefined) {
      if (!r.unchecked.trim()) errors.push(`requirement "${r.id}": unchecked must say why no fitness function checks it`)
      if (checkers.length) errors.push(`requirement "${r.id}" is unchecked yet ${checkers.map((f) => `"${f.id}"`).join(', ')} checks it`)
      continue
    }
    if (!checkers.length) { errors.push(`requirement "${r.id}" is checked by no fitness function (name it in a fitness function's checks, or say in unchecked why the team keeps it by hand)`); continue }
    const alone = combinations.find((values) => importedFor(r.when, values) && !checkers.some((f) => importedFor(f.when, values)))
    if (alone) errors.push(`requirement "${r.id}" is imported without any fitness function that checks it for ${JSON.stringify(alone)}`)
  }
  return errors
}
