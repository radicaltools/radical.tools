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

export interface FitnessSpec {
  id: string
  label: string
  when?: When
  category: 'structural' | 'operational' | 'process' | 'holistic'
  threshold: string
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
  const rel = (relationType: string, sourceId: string, targetId: string): void => {
    relations.push({ id: `${sourceId}--${relationType}--${targetId}`, sourceId, targetId, relationType })
  }

  node('need', 'need', spec.need.label, undefined, { kind: 'brief', source: `Hub concern pack: ${spec.name}`, description: spec.need.text })
  for (const r of spec.requirements) {
    const { id, label, when, scenario: _scenario, ...ears } = r
    node(id, 'requirement', label, when, ears)
    rel('derives', id, 'need')
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
      category: f.category,
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

/** What a spec lacks of the standard beyond what its document shows: every
 *  requirement is checked by a fitness function imported whenever it is, or
 *  says why the team keeps it by hand; every `checks` and `unchecked` is
 *  well-formed. */
export function specProblems(spec: PackSpec): string[] {
  const errors: string[] = []
  const reqIds = new Set(spec.requirements.map((r) => r.id))
  for (const f of spec.fitness) {
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
