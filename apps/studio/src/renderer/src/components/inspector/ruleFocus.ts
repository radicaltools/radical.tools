// ─── Inspector: the rule whose findings are asked for ────────────────────────
//
// A link of the traceability chain, or a goal not met, leads to the
// findings of one rule. Each finding is in one place: in To fix (on the
// Overview) when its rule fails the check, else in Debt. The group of that
// rule opens there and comes into view.

import { create } from 'zustand'
import type { CheckResult } from '@radical/common/check'
import { useInspectorNav } from '../../navigation'
import { toFix } from './toFix'

/** The rule asked for; `n` changes with each ask, also for the same rule. */
export const useRuleFocus = create<{ rule: string | null; n: number }>(() => ({ rule: null, n: 0 }))

/** Shows the findings of `rule` where they are. */
export function showRule(rule: string, check: Pick<CheckResult, 'findings' | 'rules' | 'metrics'>): void {
  const failing = toFix(check).some((item) => item.rule === rule)
  useInspectorNav.setState({ tab: failing ? 'overview' : 'debt', trace: null })
  useRuleFocus.setState((s) => ({ rule, n: s.n + 1 }))
}

/** No rule is asked for any more (the user picked a tab). */
export const clearRuleFocus = (): void => { if (useRuleFocus.getState().rule) useRuleFocus.setState({ rule: null }) }
