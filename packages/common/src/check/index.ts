// ─── radical check ───────────────────────────────────────────────────────────
//
// Checks one Markdown model folder: that its files read as a model, that the
// model follows its metamodel, and that it is complete (requirements have
// scenarios, accepted ADRs have fitness functions, …). Studio and the MCP
// server keep the metamodel while the model is edited through them; this
// finds what came in another way (a hand edit, a git merge, a changed
// metamodel) and what no editor can demand while someone is still writing.
//
// Pure: it takes the folder's files and a config, and returns findings. The
// `radical` CLI (apps/cli) reads the files and prints the result.

import type { C4Node, C4Relation, DiagramData, DiagramSequence, DiagramSnapshot, DiagramView, Presentation } from '../c4'
import { MD_FOLDER_JSON_FILES, MD_MANIFEST_FILE, deserializeFromMdFolder, isValidMdFolderManifest, mdFolderNodeFiles, type FolderFiles } from '../formats/mdFolder'
import { documentMetamodel, milestoneViews } from '../model'
import { CHECK_RULES, type CheckSeverity, type RuleFinding } from './rules'
import { computeEvidence, type Evidence } from './evidence'
import { GOAL_RULE, isMetricId, measureGoals, type CheckDimension, type CheckMetricResult, type GoalSetting } from './goals'
import type { TestCase } from './reports'
import type { Measurement } from './metrics'
import type { ConcernPack } from '../concerns'

export { CHECK_RULES, type CheckRule, type CheckSeverity, type CheckModel, type RuleFinding } from './rules'
export { parseTestReport, parseTestIds, type TestCase, type TestId, type TestStatus } from './reports'
export { CHECK_CONFIG_FILE, MEASUREMENTS_FILE, TEST_RESULTS_FILE, parseCheckConfig, parseTestResults, serializeTestResults, testsRanAt, type CiRun, type CiSource, type TestResults } from './files'
export { computeEvidence, conditionResults, conditionsOf, type Evidence, type EvidenceEntry, type CheckedStatus, type VerifiedStatus, type TestOutcome, type ConditionOutcome, type ConditionResult } from './evidence'
export { METRICS_FORMAT, REVIEW_METRIC, convertUnit, evaluateMetric, fitnessResult, formatAge, mergeMeasurements, metricsFileProblems, parseCombine, parseCondition, parseConditions, parseMaxAge, parseMeasurementStore, parseMetricsFile, serializeMeasurementStore, serializeMetricsFile, type Combine, type Condition, type Measurement, type MeasurementStore, type MetricsFile } from './metrics'
export { REVIEWS_FILE, REVIEWS_FORMAT, addReview, parseReviewsFile, reviewMeasurements, type Review, type ReviewsFile } from './reviews'
export { SENSOR_NAMES, commandWords, isSensorName, parseMeasure, type MeasureLine } from './sensors'
export { CHECK_DIMENSIONS, CHECK_METRICS, GOAL_RULE, type CheckDimension, type CheckPerspective, type CheckMetric, type CheckMetricResult, type GoalSetting } from './goals'

/** Rules about the folder's files and its views, sequences and slides. */
export const FOLDER_RULES: ReadonlyArray<{ id: string; description: string; severity: CheckSeverity; dimension: CheckDimension }> = [
  { id: 'folder-manifest', description: 'The folder has a radical.md manifest of the Markdown-folder format, version 1.', severity: 'error', dimension: 'consistency' },
  { id: 'folder-json', description: 'Every JSON sidecar (relations.json, views.json, …) parses.', severity: 'error', dimension: 'consistency' },
  { id: 'folder-conflict', description: 'No node file holds git conflict markers.', severity: 'error', dimension: 'consistency' },
  { id: 'folder-not-a-node', description: 'A node file with frontmatter has an id and a type (one without them is skipped on loading, and its element is gone).', severity: 'error', dimension: 'consistency' },
  { id: 'folder-duplicate-id', description: 'No two node files hold the same id.', severity: 'error', dimension: 'consistency' },
  { id: 'stale-reference', description: 'Views, sequences and slides point only at elements, relations and views the model has.', severity: 'warning', dimension: 'consistency' },
]

/** Rules whose findings stop the check: nothing else can be read. */
const FATAL = new Set(['folder-manifest', 'folder-json', 'folder-conflict'])

/** The folder rule that reads the model, not its files: it runs wherever the
 *  model does. */
const STALE_REFERENCE = 'stale-reference'

/** The rules that read the model (checkData), whether it is in a folder or
 *  in memory. */
const MODEL_RULE_IDS = new Set([STALE_REFERENCE, ...CHECK_RULES.map((r) => r.id), GOAL_RULE.id])

export interface CheckFinding extends RuleFinding {
  rule: string
  severity: CheckSeverity
  /** The key it counts under: the rule, or `rule/code` when the config sets that. */
  key: string
}

/** A rule's setting in the config: a severity, `off`, or a severity with a
 *  baseline: up to `max` findings are reported as warnings and pass. */
export type RuleSetting = CheckSeverity | 'off' | {
  severity?: CheckSeverity | 'off'
  max?: number
  /** For rules about test files (test-unbound): the files they look at, as
   *  globs over repository paths (`apps/e2e/**`). */
  include?: string[]
  /** Files left out of `include`. */
  exclude?: string[]
}

export interface CheckConfig {
  /** By rule id, or `rule/code` for one kind of finding (`metamodel/sm-unreachable`). */
  rules?: Record<string, RuleSetting>
  /** By metric id (CHECK_METRICS): the least share in percent. */
  goals?: Record<string, GoalSetting>
  /** Where radical check --from-ci finds the test reports: the names of the
   *  CI artifacts that hold them (default: every artifact of the run). */
  ci?: { artifacts?: string[] }
}

export interface CheckRuleResult {
  /** The rule id, or the `rule/code` key the config set. */
  id: string
  count: number
  severity: CheckSeverity | 'off'
  max?: number
  /** Findings above the baseline, or any finding of an error rule without one. */
  failed: boolean
  /** The rule did not run: it reads test reports and none was given
   *  ('no-report'), the folder could not be read as a model ('no-model'), or
   *  it reads a folder's files and the model was checked in memory
   *  (checkModel, 'no-folder'), or it reads measurements and none were
   *  given ('no-measurements'). Its count says nothing. */
  notRun?: 'no-report' | 'no-model' | 'no-folder' | 'no-measurements'
}

export interface CheckResult {
  ok: boolean
  errors: number
  warnings: number
  findings: CheckFinding[]
  /** Every rule that ran or that the config names, in catalogue order. */
  rules: CheckRuleResult[]
  /** Config keys that name no rule. */
  unknownRules: string[]
  /** Goal keys that name no metric. */
  unknownGoals: string[]
  /** Each metric the model has something to count for, with its goal. */
  metrics: CheckMetricResult[]
  /** The goals that were not measured, and why: they read test reports and
   *  none was given, or the folder could not be read as a model. */
  goalsNotRun: Array<{ id: string; min: number; notRun: 'no-report' | 'no-model' }>
  nodeCount: number
  relationCount: number
  /** With test reports or measurements: what they say about each scenario,
   *  fitness function, requirement and ADR. */
  evidence?: Evidence
}

export interface CheckOptions {
  /** Test cases from the reports (parseTestReport). Without them the rules
   *  that read test outcomes find nothing and there is no evidence. */
  tests?: TestCase[]
  /** When `tests` were read, when they are results kept from an earlier
   *  run (.radical/test-results.json): a test they lack, and a goal they
   *  leave unmet, are warnings naming that time. */
  testsReadAt?: string
  /** The Hub's concern packs (concerns.ts), for concern-unaddressed. */
  concerns?: ConcernPack[]
  /** What sensors measured (radical-metrics/1 files, the store beside the
   *  model). Without them the rules that read values find nothing. */
  measurements?: Measurement[]
  /** When the conditions are evaluated, for max_age (ms since the epoch). */
  now?: number
  /** Earlier measurements a condition against a baseline compares with. */
  baseline?: Measurement[]
  /** The event the check runs on (pull-request in the gate): what runs on
   *  another one is not reported unmeasured. */
  trigger?: string
}

const byId = <T extends { id: string }>(items: T[]): Record<string, T> =>
  Object.fromEntries(items.map((item) => [item.id, item]))

const ALL_RULES = [...FOLDER_RULES, ...CHECK_RULES, GOAL_RULE]

/** Rule and metric ids a check.json may still hold from before `metrics`
 *  replaced `tests` and `threshold`: the id each counts as now, or null for
 *  one that is gone (a threshold is a condition now). */
const RENAMED_RULES: Record<string, string | null> = {
  'scenario-without-tests': 'scenario-without-metrics',
  'fitness-fn-without-tests': 'fitness-fn-without-metrics',
  'fitness-fn-without-threshold': null,
}
const RENAMED_METRICS: Record<string, string | null> = {
  'scenarios-with-tests': 'scenarios-with-metrics',
  'fitness-fns-with-tests': 'fitness-fns-with-metrics',
  'fitness-fns-with-threshold': null,
}

const renamed = <T>(entries: Record<string, T> | undefined, names: Record<string, string | null>): Record<string, T> | undefined => {
  if (!entries) return entries
  const out: Record<string, T> = {}
  for (const [key, value] of Object.entries(entries)) {
    const [rule, ...code] = key.split('/')
    if (!(rule in names)) { out[key] = value; continue }
    const now = names[rule]
    if (now && !(now in entries)) out[[now, ...code].join('/')] = value
  }
  return out
}

/** `config` with the ids it names from before `metrics` brought up to date. */
export function upgradeCheckConfig(config: CheckConfig): CheckConfig {
  const rules = renamed(config.rules, RENAMED_RULES)
  const goals = renamed(config.goals, RENAMED_METRICS)
  return { ...config, ...(rules ? { rules } : {}), ...(goals ? { goals } : {}) }
}
const RULE_IDS = new Set(ALL_RULES.map((r) => r.id))
const DEFAULT_SEVERITY = new Map(ALL_RULES.map((r) => [r.id, r.severity]))

/** Checks the model in `files` (paths relative to the model folder). */
export function runCheck(files: FolderFiles, given: CheckConfig = {}, options: CheckOptions = {}): CheckResult {
  const config = upgradeCheckConfig(given)
  const found: Array<RuleFinding & { rule: string }> = []
  const add = (rule: string, finding: RuleFinding): void => { found.push({ rule, ...finding }) }

  if (!isValidMdFolderManifest(files[MD_MANIFEST_FILE])) {
    add('folder-manifest', { path: MD_MANIFEST_FILE, message: `${MD_MANIFEST_FILE} is missing or is no Markdown-folder manifest of version 1.` })
  }
  for (const path of MD_FOLDER_JSON_FILES) {
    if (!(path in files)) continue
    try { JSON.parse(files[path]) } catch (error) {
      add('folder-json', { path, message: `${path} does not parse: ${(error as Error).message}` })
    }
  }
  const nodeFiles = mdFolderNodeFiles(files)
  const pathOf = new Map<string, string>()
  for (const file of nodeFiles) {
    if (file.conflict) add('folder-conflict', { path: file.path, message: `${file.path} holds git conflict markers.` })
    else if (file.frontmatter && (!file.id || !file.type)) {
      add('folder-not-a-node', { path: file.path, message: `${file.path} has frontmatter but no ${file.id ? 'type' : file.type ? 'id' : 'id and type'}; it is not loaded as an element.` })
    } else if (file.id) {
      const first = pathOf.get(file.id)
      if (first) add('folder-duplicate-id', { path: file.path, message: `${file.path} holds id ${file.id}, which ${first} holds too.` })
      else pathOf.set(file.id, file.path)
    }
  }

  let model: ModelCheck = {
    found: [], nodeCount: 0, relationCount: 0, metrics: [], notRun: new Map([...MODEL_RULE_IDS].map((id) => [id, 'no-model'])),
    goalsNotRun: Object.keys(config.goals ?? {}).filter(isMetricId).map((id) => ({ id, notRun: 'no-model' })),
  }
  if (!found.some((f) => FATAL.has(f.rule))) model = checkData(deserializeFromMdFolder(files).data, options, config)

  const result = settle([...found, ...model.found].map((f) => ({
    ...f,
    ...(!f.path && f.nodeId && pathOf.has(f.nodeId) ? { path: pathOf.get(f.nodeId) } : {}),
    ...(!f.path && f.relationId ? { path: 'relations.json' } : {}),
  })), config, model)
  return model.evidence ? { ...result, evidence: model.evidence } : result
}

interface ModelCheck {
  found: Array<RuleFinding & { rule: string }>
  nodeCount: number
  relationCount: number
  metrics: CheckMetricResult[]
  evidence?: Evidence
  /** The rules that did not run, and why. */
  notRun: Map<string, NonNullable<CheckRuleResult['notRun']>>
  /** The goals that were not measured, and why. */
  goalsNotRun: Array<{ id: string; notRun: 'no-report' | 'no-model' }>
}

function checkData(data: DiagramData, options: CheckOptions, config: CheckConfig): ModelCheck {
  const found: Array<RuleFinding & { rule: string }> = []
  const nodes = byId(data.nodes)
  const relations = byId(data.relations)
  staleReferences(data.views ?? [], data.sequences ?? [], data.presentations ?? [], nodes, relations, data.snapshots ?? [])
    .forEach((finding) => found.push({ rule: STALE_REFERENCE, ...finding }))
  const model = {
    nodes, relations, metamodel: documentMetamodel(data.metamodel, data.nodes), settings: config.rules ?? {},
    ...(options.tests ? { tests: options.tests } : {}),
    ...(options.tests && options.testsReadAt ? { testsReadAt: options.testsReadAt } : {}),
    ...(options.concerns ? { concerns: options.concerns } : {}),
    ...(options.measurements ? { measurements: options.measurements } : {}),
    ...(options.baseline ? { baseline: options.baseline } : {}),
    ...(options.trigger ? { trigger: options.trigger } : {}),
    ...(options.now !== undefined ? { now: options.now } : {}),
  }
  for (const rule of CHECK_RULES) rule.run(model).forEach((finding) => found.push({ rule: rule.id, ...finding }))
  const evidence = options.tests || options.measurements ? computeEvidence(model) : undefined
  const goals = measureGoals({ model, found, ...(evidence ? { evidence } : {}) }, config.goals ?? {})
  goals.findings.forEach((finding) => found.push({ rule: GOAL_RULE.id, ...finding }))
  return {
    found,
    nodeCount: Object.keys(nodes).length,
    relationCount: Object.keys(relations).length,
    metrics: goals.metrics,
    ...(evidence ? { evidence } : {}),
    notRun: new Map([
      ...(options.tests ? [] : CHECK_RULES.filter((r) => r.readsReports).map((r) => [r.id, 'no-report'] as const)),
      ...(options.measurements ? [] : CHECK_RULES.filter((r) => r.readsMeasurements).map((r) => [r.id, 'no-measurements'] as const)),
    ]),
    goalsNotRun: goals.notRun.map((id) => ({ id, notRun: 'no-report' })),
  }
}

/** Checks a model already in memory, as Studio holds it: every rule but the
 *  ones about the folder's files, which only a folder has. Those are not
 *  run, so a count of 0 lowers no baseline the CLI still counts against. */
export function checkModel(data: DiagramData, given: CheckConfig = {}, options: CheckOptions = {}): CheckResult {
  const config = upgradeCheckConfig(given)
  const model = checkData(data, options, config)
  for (const rule of FOLDER_RULES) if (!MODEL_RULE_IDS.has(rule.id)) model.notRun.set(rule.id, 'no-folder')
  const result = settle(model.found, config, model)
  return model.evidence ? { ...result, evidence: model.evidence } : result
}

function staleReferences(
  views: DiagramView[],
  sequences: DiagramSequence[],
  presentations: Presentation[],
  nodes: Record<string, C4Node>,
  relations: Record<string, C4Relation>,
  milestones: DiagramSnapshot[] = [],
): RuleFinding[] {
  const findings: RuleFinding[] = []
  const sequenceIds = new Set(sequences.map((s) => s.id))
  const viewIds = new Set(views.map((v) => v.id))
  for (const view of views) {
    const missing = (view.nodeIds ?? []).filter((id) => !nodes[id])
    if (missing.length) findings.push({ path: 'views.json', message: `View "${view.name}" lists ${missing.length} element(s) the model does not have: ${missing.join(', ')}.` })
    if (view.sequenceId && !sequenceIds.has(view.sequenceId)) findings.push({ path: 'views.json', message: `View "${view.name}" plays sequence ${view.sequenceId}, which the model does not have.` })
  }
  for (const sequence of sequences) {
    const missing = sequence.relationIds.filter((id) => !relations[id])
    if (missing.length) findings.push({ path: 'sequences.json', message: `Sequence "${sequence.name}" has ${missing.length} step(s) on relations the model does not have: ${missing.join(', ')}.` })
  }
  for (const presentation of presentations) {
    for (const slide of presentation.slides) {
      // A milestone has the views of elements the live model deleted since.
      const milestone = slide.snapshotId ? milestones.find((m) => m.id === slide.snapshotId) : undefined
      const shownIds = milestone?.views ? new Set(Object.keys(milestoneViews(Object.fromEntries(views.map((v) => [v.id, v])), milestone, nodes))) : viewIds
      if (slide.viewId && !shownIds.has(slide.viewId)) findings.push({ path: 'presentations.json', message: `Slide "${slide.name}" of "${presentation.name}" shows view ${slide.viewId}, which the model does not have.` })
      // The model the slide shows: its milestone's, the copy taken when it
      // was added in Studio, else the current one.
      const shown = (slide.snapshotId ? milestones.find((m) => m.id === slide.snapshotId)?.nodes : undefined) ?? slide.modelSnapshot?.nodes ?? nodes
      const lost = (slide.focusNodeIds ?? []).filter((id) => !shown[id])
      if (lost.length) findings.push({ path: 'presentations.json', message: `Slide "${slide.name}" of "${presentation.name}" focuses on ${lost.length} element(s) the model it shows does not have: ${lost.join(', ')}.` })
    }
  }
  return findings
}

/** The config key a finding counts under: `rule/code` when the config names
 *  it, otherwise the rule. */
const keyOf = (f: { rule: string; code?: string }, rules: Record<string, RuleSetting>): string =>
  f.code && rules[`${f.rule}/${f.code}`] !== undefined ? `${f.rule}/${f.code}` : f.rule

const settingOf = (setting: RuleSetting | undefined): Exclude<RuleSetting, string> =>
  setting === undefined ? {} : typeof setting === 'string' ? { severity: setting } : setting

function settle(found: Array<RuleFinding & { rule: string }>, config: CheckConfig, { nodeCount, relationCount, metrics, notRun, goalsNotRun }: ModelCheck): CheckResult {
  const rules = config.rules ?? {}
  const groups = new Map<string, Array<RuleFinding & { rule: string }>>()
  for (const f of found) {
    const key = keyOf(f, rules)
    groups.set(key, [...(groups.get(key) ?? []), f])
  }
  const order = ALL_RULES.map((r) => r.id)
  const keys = [...new Set([...groups.keys(), ...Object.keys(rules).filter((k) => RULE_IDS.has(k.split('/')[0]))])]
    .sort((a, b) => order.indexOf(a.split('/')[0]) - order.indexOf(b.split('/')[0]) || a.localeCompare(b))

  const findings: CheckFinding[] = []
  const results: CheckRuleResult[] = []
  for (const key of keys) {
    const list = groups.get(key) ?? []
    const { severity: set, max } = settingOf(rules[key])
    const ruleSeverity = DEFAULT_SEVERITY.get(key.split('/')[0]) ?? 'error'
    const why = notRun.get(key.split('/')[0])
    if (why) {
      results.push({ id: key, count: 0, severity: set ?? ruleSeverity, ...(max !== undefined ? { max } : {}), failed: false, notRun: why })
      continue
    }
    if (set === 'off') {
      results.push({ id: key, count: list.length, severity: 'off', failed: false })
      continue
    }
    const withinBaseline = max !== undefined && list.length <= max
    const settled = list.map((f): CheckFinding => ({
      ...f,
      key,
      severity: withinBaseline || f.asOf ? 'warning' : set ?? f.severity ?? ruleSeverity,
    }))
    findings.push(...settled)
    results.push({
      id: key,
      count: list.length,
      severity: set ?? ruleSeverity,
      ...(max !== undefined ? { max } : {}),
      failed: settled.some((f) => f.severity === 'error'),
    })
  }
  const errors = findings.filter((f) => f.severity === 'error').length
  return {
    ok: errors === 0,
    errors,
    warnings: findings.length - errors,
    findings,
    rules: results,
    unknownRules: Object.keys(rules).filter((k) => !RULE_IDS.has(k.split('/')[0])),
    unknownGoals: Object.keys(config.goals ?? {}).filter((k) => !isMetricId(k)),
    metrics,
    goalsNotRun: goalsNotRun.map((g) => ({ ...g, min: config.goals![g.id].min })),
    nodeCount,
    relationCount,
  }
}

/** The config with each baseline lowered to the count found now: a rule
 *  that got better cannot get worse again. A count above its baseline is
 *  left failing, never raised into it, and a rule that did not run (no
 *  test report) keeps its baseline. */
export function ratchetConfig(config: CheckConfig, result: CheckResult): { config: CheckConfig; lowered: Array<{ id: string; from: number; to: number }> } {
  const rules = { ...(config.rules ?? {}) }
  const lowered: Array<{ id: string; from: number; to: number }> = []
  for (const r of result.rules) {
    const setting = rules[r.id]
    if (r.notRun || typeof setting !== 'object' || setting.max === undefined || r.count >= setting.max) continue
    rules[r.id] = { ...setting, max: r.count }
    lowered.push({ id: r.id, from: setting.max, to: r.count })
  }
  return { config: { ...config, rules }, lowered }
}

export { formatCheckText, formatCheckGithub, type FormatOptions } from './format'
export { compareCheckConfig, type CheckConfigChange } from './configChanges'

/** A rule's severity when the config does not set it. */
export const defaultSeverity = (rule: string): CheckSeverity => DEFAULT_SEVERITY.get(rule) ?? 'error'
