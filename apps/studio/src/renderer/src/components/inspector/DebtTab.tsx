// ─── Inspector: Debt ─────────────────────────────────────────────────────────
//
// What the check finds that does not fail it, so that the Overview holds
// only what is to fix: the rules within their baselines (with how far under
// them they are, and the way to lower the baselines), the rules that warn,
// what was read from test results older than the model, and the scenarios
// and fitness functions whose checks nothing ran. Each rule opens to its
// findings, drawn as To fix draws them. The list can be narrowed to the
// elements the branch changed.

import React, { useMemo, useState } from 'react'
import type { CheckResult } from '@radical/common/check'
import type { C4Relation } from '@radical/common/c4'
import { measuredWhen, notRunItems, testsCommand, type AttentionGroup, type NotRunItem } from './attention'
import { Chip, FindingGroup, type Ctx } from './shared'
import { debt } from './toFix'

const SHOWN = 8
const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`
const findingsOf = (groups: AttentionGroup[]): number => groups.reduce((n, g) => n + g.findings.length, 0)

/** What the checks did not run here: the gaps, and in a muted style what
 *  runs on another event and is expected not to have run. */
function NotRun({ items, ctx }: { items: NotRunItem[]; ctx: Ctx }): React.ReactElement {
  const [shown, setShown] = useState(SHOWN)
  return (
    <div className="insp-panel insp-groups insp-notrun" data-rule="not-run">
      <div className="insp-group-items">
        {items.slice(0, shown).map((item) => (
          <div key={item.id} className={`insp-finding${item.expected ? ' expected' : ''}`} data-trigger={item.trigger}>
            <div className="insp-finding-what">
              <Chip id={item.id} ctx={ctx} />
              <span className={`insp-pill ${item.expected ? 'none' : 'warn'}`} title="When it runs">{item.trigger}</span>
              <span className="insp-msg">{item.why.join('; ')}.</span>
              {item.expected && <span className="insp-muted insp-expected">measured {measuredWhen(item.trigger)} — expected here</span>}
            </div>
            <div className="insp-finding-acts">
              <button type="button" className="insp-btn" aria-label={`Open ${item.label}`} onClick={() => ctx.peek(item.id)}>Open</button>
            </div>
          </div>
        ))}
        {items.length > shown && <button type="button" className="insp-more" onClick={() => setShown(items.length)}>Show {items.length - shown} more</button>}
      </div>
    </div>
  )
}

function Part({ label, count, lede, children }: { label: string; count: number; lede: React.ReactNode; children: React.ReactNode }): React.ReactElement {
  return (
    <section className="insp-debt-part" aria-label={label}>
      <h2>{label}<span className="insp-pill none">{count}</span></h2>
      <p className="insp-lede">{lede}</p>
      {children}
    </section>
  )
}

export function DebtTab({ check, ctx, relations, branchIds, noBranch, folder, onSettings }: {
  check: CheckResult; ctx: Ctx; relations: Record<string, C4Relation>
  /** The elements changed on the branch; null without a base. */
  branchIds: ReadonlySet<string> | null
  /** Why This branch cannot narrow the list, when it cannot. */
  noBranch: string
  /** The model folder, as the commands name it. */
  folder: string
  onSettings: () => void
}): React.ReactElement {
  const [onBranch, setOnBranch] = useState(false)
  const only = onBranch && branchIds ? branchIds : undefined
  const d = useMemo(() => debt(check, only), [check, only])
  const notRun = useMemo(() => notRunItems(check.evidence?.nodes, ctx.nodes, relations, check.findings)
    .filter((item) => !only || only.has(item.id) || item.checks.some((id) => only.has(id))), [check, ctx.nodes, relations, only])
  const empty = d.total === 0 && notRun.length === 0
  const groups = (list: AttentionGroup[]): React.ReactElement => (
    <div className="insp-panel insp-groups">{list.map((g) => <FindingGroup key={g.key} g={g} ctx={ctx} branchIds={branchIds} />)}</div>
  )

  return (
    <>
      <div className="insp-sec-head">
        <p className="insp-lede insp-tab-lede">What the check finds that does not fail it. Nothing here has to be settled for the check to pass: it is what the team took on, to pay down when it decides to.</p>
        <span className="insp-seg" role="group" aria-label="Findings about">
          <button type="button" aria-pressed={onBranch} disabled={!branchIds} title={branchIds ? 'Only the findings about elements changed on this branch' : noBranch}
            onClick={() => setOnBranch(true)}>This branch</button>
          <button type="button" aria-pressed={!onBranch} onClick={() => setOnBranch(false)}>All</button>
        </span>
      </div>

      {empty && <p className="insp-panel insp-muted insp-pad">{only ? 'Nothing the check finds is about the elements changed on this branch.' : 'No debt: the check finds nothing that does not fail it.'}</p>}

      {d.baselines.length > 0 && (
        <Part label="Within baselines" count={findingsOf(d.baselines)}
          lede={<>Rules that fail the check only above the count their baseline in <code>check.json</code> allows. One finding more than a baseline, and it is in To fix.
            {d.slack.length > 0 && <> {plural(d.slack.length, 'baseline')} {d.slack.length === 1 ? 'is' : 'are'} above what the check finds now: <button type="button" className="insp-inline-link" onClick={onSettings}>Ratchet in Inspector settings</button> lowers {d.slack.length === 1 ? 'it' : 'them'}.</>}</>}>
          {groups(d.baselines)}
        </Part>
      )}
      {d.warnings.length > 0 && (
        <Part label="Warnings" count={findingsOf(d.warnings)} lede={<>Rules <code>check.json</code> sets to warn: reported, and never failing the check.</>}>
          {groups(d.warnings)}
        </Part>
      )}
      {d.old.length > 0 && (
        <Part label="From old test results" count={findingsOf(d.old)}
          lede={<>Read from test results older than the model, so they may be settled already. Read the results again before acting on them: <code>{testsCommand(folder)}</code></>}>
          {groups(d.old)}
        </Part>
      )}
      {notRun.length > 0 && (
        <Part label="Not run" count={notRun.length} lede="Scenarios and fitness functions whose checks nothing ran in the results and measurements here.">
          <NotRun items={notRun} ctx={ctx} />
        </Part>
      )}
    </>
  )
}
