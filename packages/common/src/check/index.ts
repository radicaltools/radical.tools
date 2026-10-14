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

import type { C4Node, C4Relation, DiagramData, DiagramSequence, DiagramView, Presentation } from '../c4'
import { MD_FOLDER_JSON_FILES, MD_MANIFEST_FILE, deserializeFromMdFolder, isValidMdFolderManifest, mdFolderNodeFiles, type FolderFiles } from '../formats/mdFolder'
import { documentMetamodel } from '../model'
import { CHECK_RULES, type CheckSeverity, type RuleFinding } from './rules'
import { computeEvidence, type Evidence } from './evidence'
import type { TestCase } from './reports'

export { CHECK_RULES, type CheckRule, type CheckSeverity, type CheckModel, type RuleFinding } from './rules'
export { parseTestReport, parseTestIds, type TestCase, type TestId, type TestStatus } from './reports'
export { CHECK_CONFIG_FILE, TEST_RESULTS_FILE, parseCheckConfig, parseTestResults, serializeTestResults, type TestResults } from './files'
export { computeEvidence, type Evidence, type EvidenceEntry, type CheckedStatus, type VerifiedStatus, type TestOutcome } from './evidence'

/** Rules about the folder's files and its views, sequences and slides. */
export const FOLDER_RULES: ReadonlyArray<{ id: string; description: string; severity: CheckSeverity }> = [
  { id: 'folder-manifest', description: 'The folder has a radical.md manifest of the Markdown-folder format, version 1.', severity: 'error' },
  { id: 'folder-json', description: 'Every JSON sidecar (relations.json, views.json, …) parses.', severity: 'error' },
  { id: 'folder-conflict', description: 'No node file holds git conflict markers.', severity: 'error' },
  { id: 'folder-not-a-node', description: 'A node file with frontmatter has an id and a type (one without them is skipped on loading, and its element is gone).', severity: 'error' },
  { id: 'folder-duplicate-id', description: 'No two node files hold the same id.', severity: 'error' },
  { id: 'stale-reference', description: 'Views, sequences and slides point only at elements, relations and views the model has.', severity: 'warning' },
]

/** Rules whose findings stop the check: nothing else can be read. */
const FATAL = new Set(['folder-manifest', 'folder-json', 'folder-conflict'])

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
}

export interface CheckRuleResult {
  /** The rule id, or the `rule/code` key the config set. */
  id: string
  count: number
  severity: CheckSeverity | 'off'
  max?: number
  /** Findings above the baseline, or any finding of an error rule without one. */
  failed: boolean
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
  nodeCount: number
  relationCount: number
  /** With test reports: what they say about each scenario, fitness
   *  function, requirement and ADR. */
  evidence?: Evidence
}

export interface CheckOptions {
  /** Test cases from the reports (parseTestReport). Without them the rules
   *  that read test outcomes find nothing and there is no evidence. */
  tests?: TestCase[]
}

const byId = <T extends { id: string }>(items: T[]): Record<string, T> =>
  Object.fromEntries(items.map((item) => [item.id, item]))

const RULE_IDS = new Set([...FOLDER_RULES.map((r) => r.id), ...CHECK_RULES.map((r) => r.id)])
const DEFAULT_SEVERITY = new Map([...FOLDER_RULES, ...CHECK_RULES].map((r) => [r.id, r.severity]))

/** Checks the model in `files` (paths relative to the model folder). */
export function runCheck(files: FolderFiles, config: CheckConfig = {}, options: CheckOptions = {}): CheckResult {
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

  let model: ModelCheck = { found: [], nodeCount: 0, relationCount: 0 }
  if (!found.some((f) => FATAL.has(f.rule))) model = checkData(deserializeFromMdFolder(files).data, options, config)

  const result = settle([...found, ...model.found].map((f) => ({
    ...f,
    ...(!f.path && f.nodeId && pathOf.has(f.nodeId) ? { path: pathOf.get(f.nodeId) } : {}),
    ...(!f.path && f.relationId ? { path: 'relations.json' } : {}),
  })), config, model.nodeCount, model.relationCount)
  return model.evidence ? { ...result, evidence: model.evidence } : result
}

interface ModelCheck {
  found: Array<RuleFinding & { rule: string }>
  nodeCount: number
  relationCount: number
  evidence?: Evidence
}

function checkData(data: DiagramData, options: CheckOptions, config: CheckConfig): ModelCheck {
  const found: Array<RuleFinding & { rule: string }> = []
  const nodes = byId(data.nodes)
  const relations = byId(data.relations)
  staleReferences(data.views ?? [], data.sequences ?? [], data.presentations ?? [], nodes, relations)
    .forEach((finding) => found.push({ rule: 'stale-reference', ...finding }))
  const model = {
    nodes, relations, metamodel: documentMetamodel(data.metamodel, data.nodes), settings: config.rules ?? {},
    ...(options.tests ? { tests: options.tests } : {}),
  }
  for (const rule of CHECK_RULES) rule.run(model).forEach((finding) => found.push({ rule: rule.id, ...finding }))
  return {
    found,
    nodeCount: Object.keys(nodes).length,
    relationCount: Object.keys(relations).length,
    ...(options.tests ? { evidence: computeEvidence(model) } : {}),
  }
}

/** Checks a model already in memory, as Studio holds it: every rule but the
 *  ones about the folder's files, which only a folder has. */
export function checkModel(data: DiagramData, config: CheckConfig = {}, options: CheckOptions = {}): CheckResult {
  const model = checkData(data, options, config)
  const result = settle(model.found, config, model.nodeCount, model.relationCount)
  return model.evidence ? { ...result, evidence: model.evidence } : result
}

function staleReferences(
  views: DiagramView[],
  sequences: DiagramSequence[],
  presentations: Presentation[],
  nodes: Record<string, C4Node>,
  relations: Record<string, C4Relation>,
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
      if (slide.viewId && !viewIds.has(slide.viewId)) findings.push({ path: 'presentations.json', message: `Slide "${slide.name}" of "${presentation.name}" shows view ${slide.viewId}, which the model does not have.` })
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

function settle(found: Array<RuleFinding & { rule: string }>, config: CheckConfig, nodeCount: number, relationCount: number): CheckResult {
  const rules = config.rules ?? {}
  const groups = new Map<string, Array<RuleFinding & { rule: string }>>()
  for (const f of found) {
    const key = keyOf(f, rules)
    groups.set(key, [...(groups.get(key) ?? []), f])
  }
  const order = [...FOLDER_RULES.map((r) => r.id), ...CHECK_RULES.map((r) => r.id)]
  const keys = [...new Set([...groups.keys(), ...Object.keys(rules).filter((k) => RULE_IDS.has(k.split('/')[0]))])]
    .sort((a, b) => order.indexOf(a.split('/')[0]) - order.indexOf(b.split('/')[0]) || a.localeCompare(b))

  const findings: CheckFinding[] = []
  const results: CheckRuleResult[] = []
  for (const key of keys) {
    const list = groups.get(key) ?? []
    const { severity: set, max } = settingOf(rules[key])
    const ruleSeverity = DEFAULT_SEVERITY.get(key.split('/')[0]) ?? 'error'
    if (set === 'off') {
      results.push({ id: key, count: list.length, severity: 'off', failed: false })
      continue
    }
    const withinBaseline = max !== undefined && list.length <= max
    const settled = list.map((f): CheckFinding => ({
      ...f,
      key,
      severity: withinBaseline ? 'warning' : set ?? f.severity ?? ruleSeverity,
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
    nodeCount,
    relationCount,
  }
}

/** The config with each baseline lowered to the count found now: a rule
 *  that got better cannot get worse again. A count above its baseline is
 *  left failing, never raised into it. */
export function ratchetConfig(config: CheckConfig, result: CheckResult): { config: CheckConfig; lowered: Array<{ id: string; from: number; to: number }> } {
  const rules = { ...(config.rules ?? {}) }
  const lowered: Array<{ id: string; from: number; to: number }> = []
  for (const r of result.rules) {
    const setting = rules[r.id]
    if (typeof setting !== 'object' || setting.max === undefined || r.count >= setting.max) continue
    rules[r.id] = { ...setting, max: r.count }
    lowered.push({ id: r.id, from: setting.max, to: r.count })
  }
  return { config: { ...config, rules }, lowered }
}

export { formatCheckText, formatCheckGithub, type FormatOptions } from './format'
