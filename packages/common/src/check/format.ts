// ─── radical check: output ───────────────────────────────────────────────────

import type { CheckFinding, CheckResult } from './index'

export interface FormatOptions {
  /** The model folder as the user named it; finding paths are joined to it. */
  folder: string
  /** Every warning, not the first few of each rule. */
  verbose?: boolean
}

/** Warnings shown per rule unless verbose. */
const WARNINGS_SHOWN = 5

const join = (folder: string, path: string): string =>
  folder === '.' || folder === '' ? path : `${folder.replace(/\/+$/, '')}/${path}`

const where = (f: CheckFinding, folder: string): string =>
  f.testFile ?? (f.path ? join(folder, f.path) : f.nodeId ? `node ${f.nodeId}` : f.relationId ? `relation ${f.relationId}` : folder)

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

export function formatCheckText(result: CheckResult, options: FormatOptions): string {
  const lines = [`radical check: ${options.folder} (${plural(result.nodeCount, 'element')}, ${plural(result.relationCount, 'relation')})`, '']
  for (const rule of result.rules) {
    if (rule.notRun) {
      // Not ✓: it found nothing because it did not look.
      if (rule.max !== undefined && rule.severity !== 'off') lines.push(`– ${rule.id}  not run: ${rule.notRun === 'no-report' ? 'no test report' : rule.notRun === 'no-measurements' ? 'no measurements' : rule.notRun === 'no-folder' ? 'no model folder' : 'the folder is no model'} (max ${rule.max})`)
      continue
    }
    if (rule.severity === 'off' || rule.count === 0) {
      if (rule.max !== undefined && rule.severity !== 'off') lines.push(`✓ ${rule.id}  0 (max ${rule.max})`)
      continue
    }
    const mark = rule.failed ? '✖' : '⚠'
    lines.push(`${mark} ${rule.id}  ${rule.count}${rule.max !== undefined ? ` (max ${rule.max})` : ''}`)
    const list = result.findings.filter((f) => f.key === rule.id)
    const shown = options.verbose ? list : list.filter((f, i) => f.severity === 'error' || i < WARNINGS_SHOWN)
    for (const f of shown) {
      // A finding about a test file names it at the start of its message.
      const at = f.testFile ? '' : `${where(f, options.folder)}  `
      lines.push(`    ${f.severity === 'error' ? 'error  ' : 'warning'}  ${at}${f.message}`)
      if (options.verbose) for (const detail of f.details ?? []) lines.push(`               ${detail}`)
    }
    if (shown.length < list.length) lines.push(`    … ${list.length - shown.length} more (--verbose shows them)`)
  }
  const goals = result.metrics.filter((m) => m.min !== undefined)
  if (goals.length || result.goalsNotRun.length) {
    lines.push('', 'Goals:')
    for (const m of goals) lines.push(`  ${m.met ? '✓' : '✖'} ${m.id}  ${m.percent}% (${m.count} of ${m.total}, min ${m.min}%)`)
    // Not ✓: it was not measured.
    for (const g of result.goalsNotRun) lines.push(`  – ${g.id}  not run: ${g.notRun === 'no-report' ? 'no test report' : 'the folder is no model'} (min ${g.min}%)`)
  }
  if (result.evidence) lines.push('', ...evidenceSummary(result))
  if (result.unknownRules.length) lines.push('', `⚠ The config names rules that do not exist: ${result.unknownRules.join(', ')}`)
  if (result.unknownGoals.length) lines.push('', `⚠ The config sets goals for metrics that do not exist: ${result.unknownGoals.join(', ')}`)
  lines.push('', `${result.ok ? '✓' : '✖'} ${plural(result.errors, 'error')}, ${plural(result.warnings, 'warning')}`)
  return lines.join('\n')
}

/** GitHub Actions workflow commands: an annotation per error, the first
 *  warnings, and the text summary. */
export function formatCheckGithub(result: CheckResult, options: FormatOptions): string {
  const escape = (s: string): string => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
  const prop = (s: string): string => escape(s).replace(/:/g, '%3A').replace(/,/g, '%2C')
  const lines: string[] = []
  let warnings = 0
  for (const f of result.findings) {
    if (f.severity === 'warning' && ++warnings > 10) continue
    const path = f.testFile ?? (f.path ? join(options.folder, f.path) : undefined)
    const file = path ? `file=${prop(path)},` : ''
    lines.push(`::${f.severity} ${file}title=${prop(`radical check: ${f.rule}${f.code ? `/${f.code}` : ''}`)}::${escape(f.message)}`)
  }
  return [...lines, formatCheckText(result, options)].join('\n')
}

const STATUS_ORDER = ['verified', 'passed', 'broken', 'failed', 'stale', 'not-run', 'unverified', 'no-checks']
const SUMMARY_TYPES: Array<[string, string]> = [['requirement', 'Requirements'], ['scenario', 'Scenarios'], ['adr', 'ADRs'], ['fitness-fn', 'Fitness functions']]

/** One line per type: how many have each status in the evidence. */
function evidenceSummary(result: CheckResult): string[] {
  const entries = Object.values(result.evidence!.nodes)
  const measured = result.evidence!.measurements
  const lines = [`Test reports: ${plural(result.evidence!.testCases, 'test case')}${measured !== undefined ? `; measurements: ${measured}` : ''}`]
  for (const [type, name] of SUMMARY_TYPES) {
    const ofType = entries.filter((e) => e.type === type)
    if (!ofType.length) continue
    const counts = new Map<string, number>()
    for (const e of ofType) counts.set(e.status, (counts.get(e.status) ?? 0) + 1)
    const ordered = STATUS_ORDER.filter((status) => counts.has(status))
    lines.push(`  ${name}: ${ordered.map((status) => `${counts.get(status)} ${status}`).join(', ')}`)
  }
  return lines
}

