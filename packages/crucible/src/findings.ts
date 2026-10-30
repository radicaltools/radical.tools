// ─── Crucible: findings ──────────────────────────────────────────────────────
//
// A finding is one way the code breaks a rule, as Crucible recorded it: a
// Markdown file in the project's findings folder (crucible/findings/F-0001.md),
// its fields as front matter (one JSON value per key, as the model folder
// writes them), then the steps and what differs. It starts open; a test bound
// to a scenario makes it hardened, the fix fixed, a decision intended.
// Reading and writing the folder is in findingFiles.ts (Node only).

export type FindingStatus = 'open' | 'question' | 'hardened' | 'fixed' | 'intended'

export interface Finding {
  /** F-0001, F-0002, … */
  id: string
  /** What is wrong, as a user would say it. */
  title: string
  /** fuzz and explore: Crucible's rounds; sense: a metric condition the
   *  nightly measurements break (tools/nightly-findings.ts). */
  source: 'fuzz' | 'explore' | 'sense'
  status: FindingStatus
  rule: string
  signature: string
  /** Where it was found: the fuzz file, its suite and world. */
  file?: string
  suite?: string
  world?: string
  /** Where an exploration found it: the round and the run. */
  round?: string
  run?: number
  /** The script that reproduces an explored finding, copied beside the
   *  finding ("F-0003/f1-undo.mjs 2"), run from its run's folder. */
  script?: string
  /** The screenshot a run took of it, copied beside the finding
   *  ("F-0003/shots/f1.png"). */
  screenshot?: string
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
  /** The shrunk sequence of actions, as JSON, for a fuzz finding: what its
   *  test replays. */
  sequence?: unknown[]
  /** The steps as resolved. */
  steps: string[]
  /** What differs, as the rule reported it. */
  detail: string
  /** Anything written about it since, kept as it is. */
  notes?: string
}

const FIELDS = ['id', 'title', 'source', 'status', 'rule', 'signature', 'file', 'suite', 'world', 'round', 'run', 'script', 'screenshot', 'seed', 'path', 'length', 'commit', 'found', 'scenario', 'test', 'sequence'] as const

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
    source: values.source === 'explore' || values.source === 'sense' ? values.source : 'fuzz',
    status: (values.status as FindingStatus | undefined) ?? 'open',
    rule: String(values.rule ?? ''),
    signature: String(values.signature ?? ''),
    found: String(values.found ?? ''),
    steps,
    detail: detailMatch?.[2] ?? '',
    ...(after ? { notes: after } : {}),
  }
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

/** The findings in `dir` (a path from the working directory), by id; none
 *  when it does not exist. node:fs is loaded only here, so that a fuzz file
 *  in a browser package reads its findings without Node's types. */
export async function loadFindings(dir: string): Promise<Finding[]> {
  const fs = (await import('node:fs' as string)) as { existsSync(p: string): boolean; readdirSync(p: string): string[]; readFileSync(p: string, encoding: 'utf8'): string }
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter((f) => /^F-\d+\.md$/.test(f))
    .sort()
    .map((f) => findingFromMarkdown(fs.readFileSync(`${dir}/${f}`, 'utf8')))
}

/** The test that replays a fuzz finding, as its fuzz file reports it and a
 *  scenario names it: "<file> › <id> stays fixed: <title>". */
export function findingTestName(finding: Pick<Finding, 'id' | 'title'>): string {
  return `${finding.id} stays fixed: ${finding.title}`
}
