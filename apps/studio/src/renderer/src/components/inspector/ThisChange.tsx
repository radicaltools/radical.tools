// ─── Inspector: This branch ──────────────────────────────────────────────────
//
// With the model changed first, the change is the work to do. Everything
// that changed in the model since the base the CLI or the MCP server saved
// beside it (.radical/base.json): each element added, changed and removed,
// where it sits, its changed fields by their labels with the old and new
// value, and for the requirements and ADRs among them what the last test
// report says (changeWork in @radical/common), with how many of the new
// requirements are verified; then the relations.

import React, { useState } from 'react'
import type { BranchChanges, ChangeWork, ChangeWorkItem, ChangeWorkStatus } from '@radical/common/branchChanges'
import { isBaseOld, type ModelBase } from '@radical/common/formats/modelBase'
import type { ModelCopy } from '@radical/common/model'
import type { ElementChange, FieldChange } from '@radical/common/modelChanges'
import { Bar, Chip, SHORT_TYPE, type Ctx } from './shared'
import { fieldLabel, valueText } from './attention'
import { ago, BaseSince, SaveBaseHelp, changeBreakdown } from '../BranchChanges'

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

type Kind = ChangeWorkItem['kind']
const KIND: Record<Kind, string> = { added: 'New', changed: 'Changed', removed: 'Removed' }

const done = (item: ChangeWorkItem): boolean => item.status === 'verified' || item.status === 'removed'

/** What the status rests on, in a few words. */
function detail(item: ChangeWorkItem): React.ReactNode {
  const first = (outcome: string) => item.tests.find((t) => t.outcome === outcome)?.id
  switch (item.status) {
    case 'failing': return <><code>{first('failed')}</code> failed</>
    case 'test-not-written': {
      const missing = first('not-found')
      return missing ? <><code>{missing}</code> is not in the report</> : `its ${item.type === 'adr' ? 'fitness function names' : 'scenario names'} no check yet`
    }
    case 'not-run': return 'no test report or measurement has its checks yet'
    case 'no-checker': return item.type === 'adr' ? 'no fitness function implements it' : 'no scenario verifies it'
    case 'no-report': return 'Studio has no test report or measurements for this folder'
    case 'tests-unchanged': return `its checks pass, but no ${item.type === 'adr' ? 'fitness function' : 'scenario'} changed with it`
    case 'test-still-runs': return <><code>{item.tests.find((t) => t.outcome !== 'not-found' && t.outcome !== 'not-run')?.id}</code> still runs</>
    case 'removed': return 'removed with what verified it'
    default: return `${item.tests.length} check${item.tests.length === 1 ? '' : 's'} passed`
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

const LONG = 160

/** A value, cut after a few lines' worth unless asked for all of it. */
function Value({ text, kind }: { text: string | null; kind: 'old' | 'new' }): React.ReactElement {
  const [all, setAll] = useState(false)
  if (text === null) return <span className={`insp-val ${kind} empty`}>empty</span>
  const long = text.length > LONG
  return (
    <span className={`insp-val ${kind}`}>
      {long && !all ? `${text.slice(0, LONG).trimEnd()}…` : text}
      {long && <button type="button" className="insp-inline-link insp-val-more" onClick={() => setAll((a) => !a)}>{all ? 'less' : 'more'}</button>}
    </span>
  )
}

/** The fields of a changed element, each by its label: old → new. */
function Fields({ change, ctx, baseModel }: { change: ElementChange; ctx: Ctx; baseModel: ModelCopy }): React.ReactElement {
  const props = ctx.metamodel.nodeTypes[change.type]?.properties
  const labelOf = (id: string): string | undefined => ctx.nodes[id]?.label ?? baseModel.nodes[id]?.label
  return (
    <dl className="insp-fields">
      {(change.changes ?? []).map((f: FieldChange) => (
        <div key={f.field} className="insp-field">
          <dt>{fieldLabel(f.field, props)}</dt>
          <dd><Value text={valueText(f.field, f.before, labelOf)} kind="old" /><span className="insp-arrow" aria-label="to">→</span><Value text={valueText(f.field, f.after, labelOf)} kind="new" /></dd>
        </div>
      ))}
    </dl>
  )
}

/** One element of the change: what happened to it, where it sits, and for
 *  a requirement or ADR what the tests say. */
function Row({ kind, change, item, ctx, baseModel }: { kind: Kind; change: ElementChange; item?: ChangeWorkItem; ctx: Ctx; baseModel: ModelCopy }): React.ReactElement {
  const [open, setOpen] = useState(false)
  const props = ctx.metamodel.nodeTypes[change.type]?.properties
  const fields = change.changes ?? []
  const [tone, text] = item ? STATUS[item.status] : ['', '']
  return (
    <div className="insp-branch-row" data-kind={kind} {...(item ? { 'data-status': item.status } : {})}>
      <div className="insp-branch-what">
        <span className={`insp-kind ${kind}`}>{KIND[kind]}</span>
        {kind === 'removed' || !ctx.nodes[change.id] ? <GoneChip id={change.id} base={baseModel} ctx={ctx} /> : <Chip id={change.id} ctx={ctx} />}
        {change.path.length > 0 && <span className="insp-muted">in {change.path.join(' › ')}</span>}
        {item && <span className={`insp-pill ${tone}`}>{text}</span>}
      </div>
      {item && (
        <div className="insp-chips insp-muted insp-branch-tests">
          {item.satisfiedBy.length > 0 && <span>satisfied by</span>}
          {item.satisfiedBy.map((s) => <Chip key={s.id} id={s.id} ctx={ctx} />)}
          {item.checkers.map((c) => item.kind === 'removed' && !ctx.nodes[c.id] ? <GoneChip key={c.id} id={c.id} base={baseModel} ctx={ctx} /> : <Chip key={c.id} id={c.id} ctx={ctx} />)}
          <span>{detail(item)}</span>
        </div>
      )}
      {fields.length > 0 && (
        <div className="insp-branch-fields">
          <button type="button" className="insp-fields-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? '▾' : '▸'} {fields.length === 1 ? '1 field' : `${fields.length} fields`}: <span>{fields.map((f) => fieldLabel(f.field, props)).join(', ')}</span>
          </button>
          {open && <Fields change={change} ctx={ctx} baseModel={baseModel} />}
        </div>
      )}
    </div>
  )
}

export function ThisBranch({ work, changes, base, baseModel, ctx }: {
  work: ChangeWork | null; changes: BranchChanges; base: ModelBase; baseModel: ModelCopy; ctx: Ctx
}): React.ReactElement {
  const [left, setLeft] = useState(false)
  const [relationsOpen, setRelationsOpen] = useState(false)
  const { elements, relations } = changes.report
  const items = new Map((work?.items ?? []).map((item) => [item.id, item]))
  const rows: Array<[Kind, ElementChange]> = [
    ...elements.added.map((c) => ['added', c] as [Kind, ElementChange]),
    ...elements.changed.map((c) => ['changed', c] as [Kind, ElementChange]),
    ...elements.removed.map((c) => ['removed', c] as [Kind, ElementChange]),
  ]
  const toDo = (work?.items ?? []).filter((item) => !done(item)).length
  const shown = left ? rows.filter(([, c]) => { const item = items.get(c.id); return !!item && !done(item) }) : rows
  const newReqs = (work?.items ?? []).filter((item) => item.kind === 'added' && item.type === 'requirement')
  const of = (status: ChangeWorkStatus) => newReqs.filter((item) => item.status === status).length
  const adrs = (work?.items ?? []).filter((item) => item.type === 'adr' && item.kind !== 'removed')
  const rels = [
    ...relations.added.map((r) => ['added', r] as const),
    ...relations.changed.map((r) => ['changed', r] as const),
    ...relations.removed.map((r) => ['removed', r] as const),
  ]
  return (
    <section className="insp-changes" aria-label="This branch">
      <p className="insp-lede insp-tab-lede">
        What changed in the model since <BaseSince base={base} />{base.source === 'forge' ? '' : ', uncommitted edits included'}; moving elements and editing views do not count. Base saved {ago(base.savedAt)} · {changeBreakdown(changes.counts)}.
      </p>
      {isBaseOld(base) && (
        <div className="insp-notice warn insp-change-old">
          <strong>The base was saved {ago(base.savedAt)}{base.branch ? `, on ${base.branch}` : ''}.</strong>
          <p className="insp-muted">If you have switched branches or pulled since, the changes below may not be this branch's.</p>
          <SaveBaseHelp old />
        </div>
      )}
      {work && work.items.length > 0 && (
        <div className="insp-two">
          <div className="insp-panel insp-change-progress">
            <div className="insp-tile-head"><span className="insp-label">Behaviour · {newReqs.length} new requirement{newReqs.length === 1 ? '' : 's'}</span>
              <span><b className="insp-change-num">{work.newVerified}</b> <span className="insp-muted">of {work.newRequirements} verified</span></span></div>
            <Bar parts={[[of('verified'), 'ok'], [of('failing'), 'bad'], [newReqs.length - of('verified') - of('failing'), 'none']]} />
          </div>
          {adrs.length > 0 && (
            <div className="insp-panel insp-change-progress">
              <div className="insp-tile-head"><span className="insp-label">Decisions · {adrs.length} ADR{adrs.length === 1 ? '' : 's'}</span>
                <span><b className="insp-change-num">{adrs.filter((a) => a.status === 'verified').length}</b> <span className="insp-muted">of {adrs.length} verified</span></span></div>
              <Bar parts={[[adrs.filter((a) => a.status === 'verified').length, 'ok'], [adrs.filter((a) => a.status === 'failing').length, 'bad'], [adrs.filter((a) => a.status !== 'verified' && a.status !== 'failing').length, 'none']]} />
            </div>
          )}
        </div>
      )}
      <section className="insp-panel insp-branch" aria-label="Changed elements">
        <div className="insp-change-bar">
          <span className="insp-label">Elements changed on this branch</span>
          {work && work.items.length > 0 && (
            <span className="insp-seg" role="group" aria-label="Show">
              <button type="button" aria-pressed={!left} onClick={() => setLeft(false)}>All {rows.length}</button>
              <button type="button" aria-pressed={left} onClick={() => setLeft(true)}>Still to do {toDo}</button>
            </span>
          )}
        </div>
        {rows.length === 0 && <p className="insp-muted">{rels.length ? 'No element changed; only relations did.' : 'The elements and relations are as they were at the base; moving elements and editing views do not count.'}</p>}
        {shown.length > 0 && (
          <div className="insp-branch-rows">
            {shown.map(([kind, c]) => <Row key={c.id} kind={kind} change={c} item={items.get(c.id)} ctx={ctx} baseModel={baseModel} />)}
          </div>
        )}
        {rels.length > 0 && (
          <section className="insp-all-group insp-branch-rels" aria-label="Relations">
            <button type="button" className="insp-all-toggle" aria-expanded={relationsOpen} onClick={() => setRelationsOpen((o) => !o)}>
              Relations <span className="insp-muted">{rels.length}</span> {relationsOpen ? '▾' : '▸'}
            </button>
            {relationsOpen && (
              <ul>
                {rels.map(([kind, r]) => (
                  <li key={r.id} className={`insp-all-rel ${kind}`}>
                    <span className="insp-all-rel-kind">{kind === 'added' ? '+' : kind === 'removed' ? '−' : '~'}</span>
                    <span>{r.source.label} → {r.target.label}</span>
                    <span className="insp-muted">{r.relationType ?? 'relation'}{r.label ? ` "${r.label}"` : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </section>
    </section>
  )
}
