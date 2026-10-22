// ─── Crucible: the findings folder ───────────────────────────────────────────

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { findingFromMarkdown, findingToMarkdown, type Finding } from './findings'

export * from './findings'

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
