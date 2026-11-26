// ─── Inspector: To fix ───────────────────────────────────────────────────────
//
// Under the Overview's scores: only what fails the check, as what the user
// has to settle for it to pass. A rule over its baseline says how many
// findings over it it is, shows the findings about the elements changed on
// this branch first, and folds the others: any of them settles it too. A
// goal not met says how many more elements reach it and leads to those that
// miss it. With nothing to fix it says so in one line. Warnings are not
// listed here: they are the Debt tab's.

import React, { useEffect, useRef, useState } from 'react'
import type { CheckResult } from '@radical/common/check'
import { RuleText } from '@radical/ui/components/FindingText'
import { showRule } from './ruleFocus'
import { DIMENSIONS, FindingList, RULE_INFO, useRuleAsked, type Ctx } from './shared'
import { settleCount, type FixItem } from './toFix'

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

/** A goal not met: how far it is, how many more reach it, and the way to
 *  the elements that miss it. */
function Goal({ item, check, onTab }: { item: FixItem; check: CheckResult; onTab: (tab: 'model' | 'implementation') => void }): React.ReactElement {
  const { metric, needed } = item.goal!
  const { ref, asked } = useRuleAsked(item.key, () => {})
  const perspective = DIMENSIONS.get(metric.dimension)?.perspective ?? 'model'
  return (
    <details ref={ref} className={`insp-group error${asked ? ' asked' : ''}`} open data-rule={item.key}>
      <summary>
        <span className="insp-sev error" aria-label="Error">✖</span>
        <span><b className="insp-group-name">{item.name}</b><span className="insp-rdesc">A goal of check.json: the share of the model that meets it may not fall under it.</span></span>
        <span className="insp-rcount">{metric.percent}%<small> · goal ≥ {metric.min}%</small></span>
      </summary>
      <div className="insp-group-items">
        <div className="insp-finding" data-rule={item.rule}>
          <div className="insp-finding-what">
            <span className="insp-msg"><b>{needed} more</b> {needed === 1 ? 'reaches' : 'reach'} the goal: {metric.count} of {metric.total} meet it now.</span>
          </div>
          <div className="insp-finding-acts">
            <button type="button" className="insp-btn" onClick={() => metric.rule ? showRule(metric.rule, check) : onTab(perspective)}>
              {metric.rule ? 'Show what misses it' : `Show in ${perspective === 'model' ? 'Model' : 'Implementation'}`}
            </button>
          </div>
        </div>
      </div>
    </details>
  )
}

/** A rule that fails the check, with how many of its findings are to be settled. */
function Rule({ item, ctx, branchIds }: { item: FixItem; ctx: Ctx; branchIds: ReadonlySet<string> | null }): React.ReactElement {
  const [open, setOpen] = useState(true)
  const { ref, asked } = useRuleAsked(item.rule, () => setOpen(true))
  const over = item.max !== undefined
  const mine = item.findings.slice(0, item.onBranch)
  const others = item.findings.slice(item.onBranch)
  // Over a baseline with findings of the branch: those are the ones to look
  // at; the rest were there before and wait folded.
  const fold = over && mine.length > 0 && others.length > 0
  return (
    <details ref={ref} className={`insp-group error${asked ? ' asked' : ''}`} open={open} onToggle={(e) => setOpen(e.currentTarget.open)} data-rule={item.key}>
      <summary>
        <span className="insp-sev error" aria-label="Error">✖</span>
        <span><b className="insp-group-name">{item.name}</b><RuleText className="insp-rdesc" text={RULE_INFO.get(item.rule) ?? ''} /></span>
        <span className="insp-rcount" title={over ? `radical check counts every finding of a rule over its baseline as an error: ${item.findings.length}` : undefined}>
          {over ? <>{item.toSettle} over<small> · {item.count} · max {item.max}</small></> : item.toSettle}
        </span>
      </summary>
      {open && (
        <div className="insp-group-items">
          {over && (
            <p className="insp-settle">
              <b>{item.toSettle} over its baseline of {item.max}</b>: settling any {item.toSettle === 1 ? 'one' : item.toSettle} of its {plural(item.count, 'finding')} passes the check.
              {mine.length > 0 && <> {mine.length === 1 ? 'One is' : `${mine.length} are`} about what this branch changed.</>}
            </p>
          )}
          {fold ? (
            <>
              <FindingList findings={mine} ctx={ctx} branchIds={branchIds} />
              <details className="insp-others">
                <summary>Any of the other {others.length} settles it too</summary>
                <FindingList findings={others} ctx={ctx} />
              </details>
            </>
          ) : <FindingList findings={item.findings} ctx={ctx} branchIds={branchIds} />}
        </div>
      )}
    </details>
  )
}

export function ToFix({ items, check, ctx, branchIds, debt, onTab, onDebt, focus }: {
  items: FixItem[]
  check: CheckResult
  ctx: Ctx
  /** The elements changed on the branch; null without a base. */
  branchIds: ReadonlySet<string> | null
  /** How many findings do not fail the check. */
  debt: number
  onTab: (tab: 'model' | 'implementation') => void
  onDebt: () => void
  /** Changes each time To fix is to be brought into view. */
  focus: number
}): React.ReactElement {
  const section = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!focus) return
    section.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    section.current?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
  }, [focus])
  const count = settleCount(items)
  return (
    <section ref={section} className="insp-tofix" aria-label="To fix">
      <h2 tabIndex={-1}>To fix{count > 0 && <span className="insp-pill bad">{count}</span>}</h2>
      {items.length === 0 ? (
        <div className="insp-panel insp-clear" role="status">
          <span className="insp-sev ok" aria-hidden="true">✓</span>
          <span><b>Nothing to fix.</b> The check passes: nothing it finds fails it in CI.</span>
        </div>
      ) : (
        <>
          <p className="insp-lede">What fails the check in CI, and how much of it has to be settled for the check to pass. What this branch changed comes first.</p>
          <div className="insp-panel insp-groups">
            {items.map((item) => item.goal
              ? <Goal key={item.key} item={item} check={check} onTab={onTab} />
              : <Rule key={item.key} item={item} ctx={ctx} branchIds={branchIds} />)}
          </div>
        </>
      )}
      {debt > 0 && (
        <p className="insp-muted insp-debt-line">
          {plural(debt, 'more finding')} {debt === 1 ? 'does' : 'do'} not fail the check: <button type="button" className="insp-inline-link" onClick={onDebt}>see Debt</button>
        </p>
      )}
    </section>
  )
}
