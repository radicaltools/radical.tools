// ─── Inspector: This change ──────────────────────────────────────────────────
//
// With the model changed first, the change is the work to do. The
// requirements and ADRs added, changed and removed since the base the CLI
// or the MCP server saved beside the model, each with what the last test
// report says of it (changeWork in @radical/common), and how many of the
// new requirements are verified.

import React, { useState } from 'react'
import type { ChangeWork, ChangeWorkItem, ChangeWorkStatus, BranchChanges } from '@radical/common/branchChanges'
import type { ModelBase } from '@radical/common/formats/modelBase'
import type { ModelCopy } from '@radical/common/model'
import { isBaseOld } from '@radical/common/formats/modelBase'
import { Bar, Chip, SHORT_TYPE, type Ctx } from './shared'
import { ago, BaseSince } from '../BranchChanges'

const STATUS: Record<ChangeWorkStatus, [tone: string, text: string]> = {
  verified: ['ok', '✓ verified'],
  failing: ['bad', '✗ test failing'],
  'test-not-written': ['none', '○ test not written'],
  'not-run': ['none', '○ not run'],
  'no-checker': ['none', '○ nothing verifies it'],
  'no-report': ['none', '○ no test report'],
  'tests-unchanged': ['warn', '⚠ check its tests'],
  'test-still-runs': ['warn', '⚠ test still runs'],
  removed: ['none', '– removed'],
}

const KIND: Record<ChangeWorkItem['kind'], string> = { added: 'New', changed: 'Changed', removed: 'Removed' }

const done = (item: ChangeWorkItem): boolean => item.status === 'verified' || item.status === 'removed'

/** What the status rests on, in a few words. */
function detail(item: ChangeWorkItem): React.ReactNode {
  const first = (outcome: string) => item.tests.find((t) => t.outcome === outcome)?.id
  switch (item.status) {
    case 'failing': return <><code>{first('failed')}</code> failed</>
    case 'test-not-written': {
      const missing = first('not-found')
      return missing ? <><code>{missing}</code> is not in the report</> : `its ${item.type === 'adr' ? 'fitness function names' : 'scenario names'} no test yet`
    }
    case 'not-run': return 'no test report has its tests'
    case 'no-checker': return item.type === 'adr' ? 'no fitness function implements it' : 'no scenario verifies it'
    case 'no-report': return 'Studio has no test report for this folder'
    case 'tests-unchanged': return `its tests pass, but no ${item.type === 'adr' ? 'fitness function' : 'scenario'} changed with it`
    case 'test-still-runs': return <><code>{item.tests.find((t) => t.outcome !== 'not-found' && t.outcome !== 'not-run')?.id}</code> still runs</>
    case 'removed': return 'removed with what verified it'
    default: return `${item.tests.length} test${item.tests.length === 1 ? '' : 's'} passed`
  }
}

/** An element the model no longer has, as the base has it. */
export function GoneChip({ id, base, ctx }: { id: string; base: ModelCopy; ctx: Ctx }): React.ReactElement | null {
  const node = base.nodes[id]
  if (!node) return null
  const def = ctx.metamodel.nodeTypes[node.type]
  return (
    <span className="insp-chip gone" title={`${def?.label ?? node.type}: ${node.label} (removed)`}>
      <span className="insp-chip-type" style={{ background: def?.color ?? '#64748b', color: def?.fg ?? '#fff' }}>{SHORT_TYPE[node.type] ?? def?.label ?? node.type}</span>
      <span className="insp-chip-label">{node.label}</span>
    </span>
  )
}

export function ThisChange({ work, changes, base, baseModel, ctx, onAllChanges }: {
  work: ChangeWork; changes: BranchChanges; base: ModelBase; baseModel: ModelCopy; ctx: Ctx; onAllChanges: () => void
}): React.ReactElement {
  const [left, setLeft] = useState(false)
  const { added, changed, removed } = changes.counts
  const items = left ? work.items.filter((item) => !done(item)) : work.items
  const toDo = work.items.filter((item) => !done(item)).length
  const newReqs = work.items.filter((item) => item.kind === 'added' && item.type === 'requirement')
  const of = (status: ChangeWorkStatus) => newReqs.filter((item) => item.status === status).length
  const adrs = work.items.filter((item) => item.type === 'adr' && item.kind !== 'removed')
  return (
    <section className="insp-panel insp-change" aria-label="This change">
      <div className="insp-change-head">
        <div>
          <h2>This change</h2>
          <p className="insp-muted">
            Since <BaseSince base={base} /> · base saved {ago(base.savedAt)} · {added + changed + removed} elements changed: {added} added, {changed} changed, {removed} removed
          </p>
        </div>
        <button type="button" className="insp-all-link" onClick={onAllChanges}>All changes{isBaseOld(base) ? ' · old base' : ''} ›</button>
      </div>
      {work.items.length === 0 ? (
        <p className="insp-muted">No requirement or ADR changed since the base.</p>
      ) : (<>
        <div className="insp-two">
          <div className="insp-change-progress">
            <div className="insp-tile-head"><span className="insp-label">Behaviour · {newReqs.length} new requirement{newReqs.length === 1 ? '' : 's'}</span>
              <span><b className="insp-change-num">{work.newVerified}</b> <span className="insp-muted">of {work.newRequirements} verified</span></span></div>
            <Bar parts={[[of('verified'), 'ok'], [of('failing'), 'bad'], [newReqs.length - of('verified') - of('failing'), 'none']]} />
          </div>
          {adrs.length > 0 && (
            <div className="insp-change-progress">
              <div className="insp-tile-head"><span className="insp-label">Decisions · {adrs.length} ADR{adrs.length === 1 ? '' : 's'}</span>
                <span><b className="insp-change-num">{adrs.filter((a) => a.status === 'verified').length}</b> <span className="insp-muted">of {adrs.length} verified</span></span></div>
              <Bar parts={[[adrs.filter((a) => a.status === 'verified').length, 'ok'], [adrs.filter((a) => a.status === 'failing').length, 'bad'], [adrs.filter((a) => a.status !== 'verified' && a.status !== 'failing').length, 'none']]} />
            </div>
          )}
        </div>
        <div className="insp-change-bar">
          <span className="insp-label">Requirements and decisions in this change</span>
          <span className="insp-seg" role="group" aria-label="Show">
            <button type="button" aria-pressed={!left} onClick={() => setLeft(false)}>All {work.items.length}</button>
            <button type="button" aria-pressed={left} onClick={() => setLeft(true)}>Still to do {toDo}</button>
          </span>
        </div>
        <div className="insp-change-rows">
          {items.map((item) => {
            const [tone, text] = STATUS[item.status]
            return (
              <div key={item.id} className="insp-change-row" data-status={item.status}>
                <div className="insp-chips">
                  <span className={`insp-kind ${item.kind}`}>{KIND[item.kind]}</span>
                  {item.kind === 'removed' ? <GoneChip id={item.id} base={baseModel} ctx={ctx} /> : <Chip id={item.id} ctx={ctx} />}
                  {item.satisfiedBy.length > 0 && <span className="insp-muted">satisfied by</span>}
                  {item.satisfiedBy.map((s) => <Chip key={s.id} id={s.id} ctx={ctx} />)}
                </div>
                <div className="insp-chips insp-muted">
                  {item.checkers.map((c) => item.kind === 'removed' && !ctx.nodes[c.id] ? <GoneChip key={c.id} id={c.id} base={baseModel} ctx={ctx} /> : <Chip key={c.id} id={c.id} ctx={ctx} />)}
                  <span>{detail(item)}</span>
                </div>
                <span className={`insp-pill ${tone}`}>{text}</span>
              </div>
            )
          })}
        </div>
      </>)}
    </section>
  )
}
