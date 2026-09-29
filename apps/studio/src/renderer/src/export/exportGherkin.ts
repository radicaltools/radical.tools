// ─── Gherkin (.feature) export ──────────────────────────────────────────────
// Walks every `scenario` node and the `requirement` it `verifies`, and emits
// one Cucumber `.feature` file per requirement (Gherkin only allows a single
// `Feature:` per file). Scenarios with no `verifies` relation land in a
// single "Ungrouped scenarios" file rather than being dropped silently.

import type { C4Node, C4Relation } from '../types/c4'
import { composeEarsSentence } from '../types/metamodel'

export interface GherkinFile {
  filename: string
  content: string
}

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'feature'
}

/** Indents every non-empty line of `text` by `spaces` spaces, leaving blank
 *  lines untouched and normalizing CRLF. */
function indentBlock(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces)
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => (line.trim() ? pad + line.trim() : ''))
    .filter(Boolean)
    .join('\n')
}

function scenarioSteps(scenario: Record<string, unknown>): string {
  const given = String(scenario.given ?? '').trim()
  const when = String(scenario.when ?? '').trim()
  const then = String(scenario.then ?? '').trim()
  const extra = String(scenario.gherkin ?? '').trim()
  const lines: string[] = []
  if (given) lines.push(`Given ${given}`)
  if (when) lines.push(`When ${when}`)
  if (then) lines.push(`Then ${then}`)
  const body = lines.join('\n')
  return extra ? [body, extra].filter(Boolean).join('\n') : body
}

/** Builds one `.feature` file per requirement that has at least one linked
 *  scenario, plus one "ungrouped" file for scenarios with no `verifies`
 *  relation. Returns an empty array when there are no scenario nodes. */
export function buildGherkinFiles(
  nodes: Record<string, C4Node>,
  relations: Record<string, C4Relation>,
): GherkinFile[] {
  const scenarios = Object.values(nodes).filter((n) => n.type === 'scenario')
  if (scenarios.length === 0) return []

  const verifiedRequirementId = new Map<string, string>()
  for (const rel of Object.values(relations)) {
    if (rel.relationType === 'verifies' && nodes[rel.sourceId]?.type === 'scenario') {
      verifiedRequirementId.set(rel.sourceId, rel.targetId)
    }
  }

  const byRequirement = new Map<string, C4Node[]>()
  const ungrouped: C4Node[] = []
  for (const scenario of scenarios) {
    const reqId = verifiedRequirementId.get(scenario.id)
    if (reqId && nodes[reqId]) {
      const list = byRequirement.get(reqId) ?? []
      list.push(scenario)
      byRequirement.set(reqId, list)
    } else {
      ungrouped.push(scenario)
    }
  }

  const files: GherkinFile[] = []

  for (const [reqId, list] of byRequirement) {
    const req = nodes[reqId]
    const { sentence } = composeEarsSentence(req as unknown as Record<string, unknown>)
    const lines = [`Feature: ${req.label}`]
    if (sentence) lines.push(indentBlock(sentence, 2))
    lines.push('')
    for (const scenario of list) {
      lines.push(`  Scenario: ${scenario.label}`)
      lines.push(indentBlock(scenarioSteps(scenario as unknown as Record<string, unknown>), 4))
      lines.push('')
    }
    files.push({ filename: `${slugify(req.label)}.feature`, content: lines.join('\n').trimEnd() + '\n' })
  }

  if (ungrouped.length > 0) {
    const lines = ['Feature: Ungrouped scenarios', '']
    for (const scenario of ungrouped) {
      lines.push(`  Scenario: ${scenario.label}`)
      lines.push(indentBlock(scenarioSteps(scenario as unknown as Record<string, unknown>), 4))
      lines.push('')
    }
    files.push({ filename: 'ungrouped.feature', content: lines.join('\n').trimEnd() + '\n' })
  }

  return files
}

/** Triggers a browser download for each file, staggered so Safari/Firefox
 *  don't drop downloads fired in the same tick (mirrors the pattern in
 *  documentStore.ts's defaultWebDownloader). */
export function downloadGherkinFiles(files: GherkinFile[]): void {
  files.forEach((file, i) => {
    setTimeout(() => {
      const blob = new Blob([file.content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.filename
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        try { document.body.removeChild(a) } catch { /* already gone */ }
        URL.revokeObjectURL(url)
      }, 1000)
    }, i * 250)
  })
}
