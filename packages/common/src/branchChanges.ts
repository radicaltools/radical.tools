// ─── The changes of a branch, in Studio ──────────────────────────────────────
//
// Studio compares the open model with the base the CLI or the MCP server
// saved beside it (formats/modelBase) as it is edited: the same report as
// get_changes (modelChanges), the words that changed in a text, and for
// the Inspector how far each changed requirement and ADR has got by what the
// last test report says.

import type { C4Node, C4Relation, DiagramView } from './c4'
import { viewShownNodes } from './viewPipeline'
import type { ModelCopy } from './model'
import type { ModelBase } from './formats/modelBase'
import { modelChangeReport, type ModelChangeReport } from './modelChanges'
import type { Measurement, TestCase } from './check'
import { conditionResults, conditionsOf, linkedNodes, testOutcomes, type ConditionOutcome } from './check/evidence'
import type { Metamodel } from './metamodel'

const byId = <T extends { id: string }>(items: T[]): Record<string, T> => Object.fromEntries(items.map((item) => [item.id, item]))

export const baseCopy = (base: Pick<ModelBase, 'nodes' | 'relations'>): ModelCopy => ({ nodes: byId(base.nodes), relations: byId(base.relations) })

/** How an element or relation differs from the base. */
export type BranchMark = 'new' | 'changed' | 'removed'

export interface BranchChanges {
  report: ModelChangeReport
  /** By element id: new, changed or removed. */
  nodes: Record<string, BranchMark>
  /** By relation id. */
  relations: Record<string, BranchMark>
  /** The removed elements as the base has them, to draw as ghosts. */
  removedNodes: C4Node[]
  removedRelations: C4Relation[]
  /** The elements added, changed and removed, and the relations changed in any way. */
  counts: { added: number; changed: number; removed: number; relations: number }
}

/** What changed from the base to the model now. */
export function branchChanges(base: ModelCopy, nodes: Record<string, C4Node>, relations: Record<string, C4Relation>): BranchChanges {
  const report = modelChangeReport(base, { nodes, relations })
  const marks = (group: ModelChangeReport['elements'] | ModelChangeReport['relations']): Record<string, BranchMark> => ({
    ...Object.fromEntries(group.added.map((c) => [c.id, 'new' as const])),
    ...Object.fromEntries(group.changed.map((c) => [c.id, 'changed' as const])),
    ...Object.fromEntries(group.removed.map((c) => [c.id, 'removed' as const])),
  })
  return {
    report,
    nodes: marks(report.elements),
    relations: marks(report.relations),
    removedNodes: report.elements.removed.map((c) => base.nodes[c.id]),
    removedRelations: report.relations.removed.map((c) => base.relations[c.id]),
    counts: {
      added: report.elements.added.length, changed: report.elements.changed.length, removed: report.elements.removed.length,
      relations: report.relations.added.length + report.relations.changed.length + report.relations.removed.length,
    },
  }
}

/** By view id: how many of the changed elements (`marks`) the view shows.
 *  A removed element counts where its ghost is drawn: in a view that shows
 *  every element, one that still lists it, or one whose chain shows it once
 *  the `removed` elements and relations (as the base has them) are back. */
export function viewChangeCounts(
  views: DiagramView[],
  nodes: Record<string, C4Node>,
  relations: Record<string, C4Relation>,
  marks: Record<string, BranchMark>,
  removed: { nodes: Record<string, C4Node>; relations: Record<string, C4Relation> } = { nodes: {}, relations: {} },
): Record<string, number> {
  const marked = Object.keys(marks)
  const withRemoved = Object.keys(removed.nodes).length || Object.keys(removed.relations).length
  const allNodes = withRemoved ? { ...removed.nodes, ...nodes } : nodes
  const allRelations = withRemoved ? { ...removed.relations, ...relations } : relations
  const counts: Record<string, number> = {}
  for (const view of views) {
    const shown = viewShownNodes(view, allNodes, allRelations)
    counts[view.id] = marked.filter((id) => !shown || shown.has(id)).length
  }
  return counts
}

// ─── Words that changed ──────────────────────────────────────────────────────

export interface WordPart {
  kind: 'same' | 'removed' | 'added'
  text: string
}

/** Above this many token pairs the text is shown as replaced whole. */
const MAX_DIFF_CELLS = 250_000

/** The words removed from `before` and added in `after`, in order, with the
 *  ones they share; whitespace stays with the words around it. */
export function wordDiff(before: string, after: string): WordPart[] {
  const a = before.split(/(\s+)/).filter(Boolean)
  const b = after.split(/(\s+)/).filter(Boolean)
  const parts: WordPart[] = []
  const push = (kind: WordPart['kind'], text: string) => {
    const last = parts[parts.length - 1]
    if (last?.kind === kind) last.text += text
    else parts.push({ kind, text })
  }
  if (a.length * b.length > MAX_DIFF_CELLS) {
    if (before) push('removed', before)
    if (after) push('added', after)
    return parts
  }
  // Longest common subsequence of the tokens, filled from the end.
  const width = b.length + 1
  const lcs = new Uint32Array((a.length + 1) * width)
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i * width + j] = a[i] === b[j] ? lcs[(i + 1) * width + j + 1] + 1 : Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1])
    }
  }
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { push('same', a[i]); i++; j++ }
    else if (lcs[(i + 1) * width + j] >= lcs[i * width + j + 1]) push('removed', a[i++])
    else push('added', b[j++])
  }
  while (i < a.length) push('removed', a[i++])
  while (j < b.length) push('added', b[j++])
  return parts
}

// ─── How far the change got ──────────────────────────────────────────────────

/**
 * What the last test report says of a changed requirement or ADR:
 * - verified: every test its scenarios (fitness functions) name passed;
 * - failing: one of them failed;
 * - test-not-written: a scenario names no test, or a test its file's report lacks;
 * - not-run: no report has a test's file;
 * - no-checker: no scenario verifies it (no fitness function implements it);
 * - no-report: Studio has no test report for the folder;
 * - tests-unchanged: changed and verified, but none of its scenarios changed;
 * - test-still-runs: removed, and a test of its removed scenarios is still in the report;
 * - removed: removed, with nothing left behind.
 */
export type ChangeWorkStatus = 'verified' | 'failing' | 'test-not-written' | 'not-run' | 'no-checker' | 'no-report' | 'tests-unchanged' | 'test-still-runs' | 'removed'

export interface ChangeWorkItem {
  id: string
  type: 'requirement' | 'adr'
  label: string
  kind: 'added' | 'changed' | 'removed'
  status: ChangeWorkStatus
  /** The scenarios or fitness functions behind the status, from the model (the base for a removed item). */
  checkers: Array<{ id: string; type: string; label: string }>
  /** Their conditions (the tests they name, the values they hold to), with
   *  their outcome; those that decide a failing or not-found status come first. */
  tests: Array<{ id: string; outcome: ConditionOutcome }>
  /** The elements that satisfy a requirement. */
  satisfiedBy: Array<{ id: string; type: string; label: string }>
}

export interface ChangeWork {
  items: ChangeWorkItem[]
  /** Requirements added since the base, and how many of them are verified. */
  newRequirements: number
  newVerified: number
}

const WORK_TYPES = { requirement: { relation: 'verifies', checker: 'scenario' }, adr: { relation: 'implements', checker: 'fitness-fn' } } as const

const OUTCOME_ORDER: ConditionOutcome[] = ['failed', 'invalid', 'not-found', 'stale', 'not-run', 'skipped', 'passed']

/** Each requirement and ADR added, changed or removed since the base, with
 *  what the tests (`tests`, undefined without a report) and the measurements
 *  say of it. */
export function changeWork(changes: BranchChanges, base: ModelCopy, now: ModelCopy, metamodel: Metamodel, tests: TestCase[] | undefined, measurements?: Measurement[]): ChangeWork {
  const items: ChangeWorkItem[] = []
  const ref = (n: C4Node) => ({ id: n.id, type: n.type, label: n.label })
  const touched = new Set([...changes.report.elements.added, ...changes.report.elements.changed].map((c) => c.id))
  const kinds: Array<[ChangeWorkItem['kind'], ModelChangeReport['elements']['added']]> = [
    ['added', changes.report.elements.added], ['changed', changes.report.elements.changed], ['removed', changes.report.elements.removed],
  ]
  for (const [kind, group] of kinds) {
    for (const change of group) {
      if (change.type !== 'requirement' && change.type !== 'adr') continue
      const { relation, checker } = WORK_TYPES[change.type]
      const copy = kind === 'removed' ? base : now
      const model = { ...copy, metamodel, tests: tests ?? [], ...(measurements ? { measurements } : {}) }
      const checkers = linkedNodes(model, change.id, relation, 'source', checker)
      const outcomes = checkers.flatMap((c) => conditionResults(c, model).map((r) => ({ id: r.test ?? r.condition, outcome: r.outcome })))
      outcomes.sort((x, y) => OUTCOME_ORDER.indexOf(x.outcome) - OUTCOME_ORDER.indexOf(y.outcome))
      let status: ChangeWorkStatus
      if (kind === 'removed') {
        // Its scenarios went with it, but their tests did not.
        const gone = checkers.filter((c) => !now.nodes[c.id])
        const stillRuns = tests !== undefined && gone.some((c) => testOutcomes(c, model).some((o) => o.outcome === 'passed' || o.outcome === 'failed' || o.outcome === 'skipped'))
        status = stillRuns ? 'test-still-runs' : 'removed'
      } else if (!checkers.length) status = 'no-checker'
      else if (tests === undefined && !measurements) status = 'no-report'
      else if (checkers.some((c) => !conditionsOf(c).length)) status = 'test-not-written'
      else if (outcomes.some((o) => o.outcome === 'failed' || o.outcome === 'invalid')) status = 'failing'
      else if (outcomes.some((o) => o.outcome === 'not-found')) status = 'test-not-written'
      else if (outcomes.some((o) => o.outcome !== 'passed')) status = 'not-run'
      else status = kind === 'changed' && !checkers.some((c) => touched.has(c.id)) ? 'tests-unchanged' : 'verified'
      items.push({
        id: change.id,
        type: change.type,
        label: change.label,
        kind,
        status,
        checkers: checkers.map(ref),
        tests: outcomes,
        satisfiedBy: change.type === 'requirement' ? linkedNodes(model, change.id, 'satisfies', 'source').map(ref) : [],
      })
    }
  }
  const added = items.filter((item) => item.kind === 'added' && item.type === 'requirement')
  return { items, newRequirements: added.length, newVerified: added.filter((item) => item.status === 'verified').length }
}
