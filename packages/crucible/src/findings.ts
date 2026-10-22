// ─── Crucible: findings ──────────────────────────────────────────────────────
//
// A finding is one way the code breaks a rule, as Crucible recorded it: a
// Markdown file in the project's findings folder (crucible/findings/F-0001.md),
// its fields as front matter (one JSON value per key, as the model folder
// writes them), then the steps and what differs. It starts open; a test bound
// to a scenario makes it hardened, the fix fixed, a decision intended.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export type FindingStatus = 'open' | 'question' | 'hardened' | 'fixed' | 'intended'

export interface Finding {
  /** F-0001, F-0002, … */
  id: string
  /** What is wrong, as a user would say it. */
  title: string
  source: 'fuzz' | 'explore'
  status: FindingStatus
  rule: string
  signature: string
  /** Where it was found: the fuzz file, its suite and world. */
  file?: string
  suite?: string
  world?: string
  /** What replays it: the seed, the counterexample's path and the longest sequence. */
  seed?: number
  path?: string
  length?: number
  commit?: string
  /** The day it was found (YYYY-MM-DD). */
  found: string
  /** The scenario and the test that hold it, once hardened. */
  scenario?: string
  test?: string
  /** The steps as resolved. */
  steps: string[]
  /** What differs, as the rule reported it. */
  detail: string
  /** Anything written about it since, kept as it is. */
  notes?: string
}

const FIELDS = ['id', 'title', 'source', 'status', 'rule', 'signature', 'file', 'suite', 'world', 'seed', 'path', 'length', 'commit', 'found', 'scenario', 'test'] as const

/** The finding as its Markdown file. */
export function findingToMarkdown(finding: Finding): string {
  const head = FIELDS.filter((k) => finding[k] !== undefined).map((k) => `${k}: ${JSON.stringify(finding[k])}`)
  const steps = finding.steps.map((s, i) => `${i + 1}. ${s.replace(/\n/g, ' ')}`).join('\n')
  const fence = finding.detail.includes('```') ? '~~~' : '```'
  const notes = finding.notes?.trim() ? `\n\n${finding.notes.trim()}` : ''
  return `---\n${head.join('\n')}\n---\n\n## Steps\n\n${steps || '(none)'}\n\n## What differs\n\n${fence}text\n${finding.detail}\n${fence}${notes}\n`
}

/** A finding read from its Markdown file. */
export function findingFromMarkdown(text: string): Finding {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text.replace(/\r\n/g, '\n'))
  if (!m) throw new Error('A finding starts with front matter between --- lines.')
  const values: Record<string, unknown> = {}
  for (const line of m[1].split('\n')) {
    const at = line.indexOf(':')
    if (at <= 0) continue
    const raw = line.slice(at + 1).trim()
    try { values[line.slice(0, at).trim()] = JSON.parse(raw) } catch { values[line.slice(0, at).trim()] = raw }
  }
  const body = m[2]
  const stepsBlock = /## Steps\n\n([\s\S]*?)(?=\n## |\s*$)/.exec(body)?.[1] ?? ''
  const steps = stepsBlock.split('\n').map((l) => /^\d+\.\s(.*)$/.exec(l)?.[1]).filter((s): s is string => s !== undefined)
  const detailMatch = /## What differs\n\n(```|~~~)text\n([\s\S]*?)\n\1/.exec(body)
  const after = detailMatch ? body.slice(body.indexOf(detailMatch[0]) + detailMatch[0].length).trim() : ''
  return {
    ...(values as Partial<Finding>),
    id: String(values.id ?? ''),
    title: String(values.title ?? ''),
    source: values.source === 'explore' ? 'explore' : 'fuzz',
    status: (values.status as FindingStatus | undefined) ?? 'open',
    rule: String(values.rule ?? ''),
    signature: String(values.signature ?? ''),
    found: String(values.found ?? ''),
    steps,
    detail: detailMatch?.[2] ?? '',
    ...(after ? { notes: after } : {}),
  }
}

/** The findings in `dir`, by id; none when it does not exist. */
export function readFindings(dir: string): Finding[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => /^F-\d+\.md$/.test(f))
    .sort()
    .map((f) => findingFromMarkdown(readFileSync(join(dir, f), 'utf8')))
}

/** Writes the finding as `<dir>/<id>.md`; returns the file's path. */
export function writeFinding(dir: string, finding: Finding): string {
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `${finding.id}.md`)
  writeFileSync(file, findingToMarkdown(finding))
  return file
}

/** The id after the highest of `ids` (F-0001 for none). */
export function nextFindingId(ids: Iterable<string>): string {
  let high = 0
  for (const id of ids) {
    const n = /^F-(\d+)$/.exec(id)?.[1]
    if (n) high = Math.max(high, Number(n))
  }
  return `F-${String(high + 1).padStart(4, '0')}`
}
