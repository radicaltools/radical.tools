// ─── Crucible: a broken rule ─────────────────────────────────────────────────

import type { Difference } from './differences'

/** What a fuzz suite does to its system in one step: `a` names the kind of
 *  action, the other fields are its arguments. */
export interface Action {
  a: string
}

/** A rule a step broke. */
export interface Violation {
  /** The rule's name, one of the suite's `rules`. */
  rule: string
  /** What is wrong, for a person: a line, then what differs. */
  detail: string
  /** What differs, when the rule compares two states: known entries match
   *  their paths, and signatures read their shape. */
  differences?: Difference[]
  /** The shape of what is wrong when there are no differences to read it
   *  from (as "overlap"): it goes into the signature. */
  shapes?: string[]
  /** Facts the suite reports for known entries to match ("pinned",
   *  "overlap"…). */
  facts?: Record<string, unknown>
  /** Anything else the suite keeps with the violation. */
  keys?: string[]
}

/** Thrown by a step that broke a rule: the violation, the steps as they
 *  resolved (what each did to the system), and the actions of the run so far. */
export class RuleBroken<A extends Action = Action> extends Error {
  constructor(readonly violation: Violation, readonly trace: string[], readonly actions: A[] = []) {
    super(`[${violation.rule}] ${violation.detail}\n  steps (as resolved):\n${trace.map((t, i) => `    ${i + 1}. ${t}`).join('\n')}`)
  }
}
