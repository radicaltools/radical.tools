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
  f.path ? join(folder, f.path) : f.nodeId ? `node ${f.nodeId}` : f.relationId ? `relation ${f.relationId}` : folder

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

export function formatCheckText(result: CheckResult, options: FormatOptions): string {
  const lines = [`radical check: ${options.folder} (${plural(result.nodeCount, 'element')}, ${plural(result.relationCount, 'relation')})`, '']
  for (const rule of result.rules) {
    if (rule.severity === 'off' || rule.count === 0) {
      if (rule.max !== undefined && rule.severity !== 'off') lines.push(`✓ ${rule.id}  0 (max ${rule.max})`)
      continue
    }
    const mark = rule.failed ? '✖' : '⚠'
    lines.push(`${mark} ${rule.id}  ${rule.count}${rule.max !== undefined ? ` (max ${rule.max})` : ''}`)
    const list = result.findings.filter((f) => f.key === rule.id)
    const shown = options.verbose ? list : list.filter((f, i) => f.severity === 'error' || i < WARNINGS_SHOWN)
    for (const f of shown) lines.push(`    ${f.severity === 'error' ? 'error  ' : 'warning'}  ${where(f, options.folder)}  ${f.message}`)
    if (shown.length < list.length) lines.push(`    … ${list.length - shown.length} more (--verbose shows them)`)
  }
  if (result.unknownRules.length) lines.push('', `⚠ The config names rules that do not exist: ${result.unknownRules.join(', ')}`)
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
    const file = f.path ? `file=${prop(join(options.folder, f.path))},` : ''
    lines.push(`::${f.severity} ${file}title=${prop(`radical check: ${f.rule}${f.code ? `/${f.code}` : ''}`)}::${escape(f.message)}`)
  }
  return [...lines, formatCheckText(result, options)].join('\n')
}

