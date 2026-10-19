// ─── Inspector: Changes ──────────────────────────────────────────────────────
//
// Everything that changed in the model since the base the CLI or the MCP
// server saved beside it (.radical/base.json): the base and how old it is,
// and every element added, changed and removed, and the relations, each
// element a link to its panel. What the tests say of the requirements and
// ADRs among them is in Implementation › This change.

import React, { useState } from 'react'
import type { BranchChanges } from '@radical/common/branchChanges'
import { isBaseOld, type ModelBase } from '@radical/common/formats/modelBase'
import type { ModelCopy } from '@radical/common/model'
import type { ElementChange } from '@radical/common/modelChanges'
import { Chip, type Ctx } from './shared'
import { GoneChip } from './ThisChange'
import { ago, SaveBaseHelp } from '../BranchChanges'

const FIELD_NAMES: Record<string, string> = { label: 'name', parentId: 'place', description: 'description', technology: 'technology', external: 'external', type: 'type' }

/** Every element and relation changed since the base, by kind of change. */
function AllChanges({ changes, baseModel, ctx }: { changes: BranchChanges; baseModel: ModelCopy; ctx: Ctx }): React.ReactElement {
  const [relationsOpen, setRelationsOpen] = useState(false)
  const { elements, relations } = changes.report
  const fieldsOf = (c: ElementChange) => {
    const props = ctx.metamodel.nodeTypes[c.type]?.properties ?? []
    return (c.changes ?? []).map((f) => props.find((p) => p.key === f.field)?.label?.toLowerCase() ?? FIELD_NAMES[f.field] ?? f.field).join(', ')
  }
  const group = (title: string, kind: 'added' | 'changed' | 'removed', list: ElementChange[]) => list.length > 0 && (
    <section className={`insp-all-group ${kind}`} aria-label={title}>
      <h3>{title} <span className="insp-muted">{list.length}</span></h3>
      <ul>
        {list.map((c) => (
          <li key={c.id}>
            {kind === 'removed' ? <GoneChip id={c.id} base={baseModel} ctx={ctx} /> : <Chip id={c.id} ctx={ctx} />}
            {c.path.length > 0 && <span className="insp-muted">in {c.path.join(' › ')}</span>}
            {kind === 'changed' && <span className="insp-all-fields">{fieldsOf(c)}</span>}
          </li>
        ))}
      </ul>
    </section>
  )
  const rels = [
    ...relations.added.map((r) => ['added', r] as const),
    ...relations.changed.map((r) => ['changed', r] as const),
    ...relations.removed.map((r) => ['removed', r] as const),
  ]
  const none = !elements.added.length && !elements.changed.length && !elements.removed.length
  return (
    <section className="insp-all" aria-label="All changes">
      <span className="insp-label">All changes</span>
      {none && !rels.length && <p className="insp-muted">The elements and relations are as they were at the base; moving elements and editing views do not count.</p>}
      <div className="insp-all-groups">
        {group('Added', 'added', elements.added)}
        {group('Changed', 'changed', elements.changed)}
        {group('Removed', 'removed', elements.removed)}
      </div>
      {rels.length > 0 && (
        <section className="insp-all-group" aria-label="Relations">
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
  )
}

export function ChangesTab({ changes, base, baseModel, ctx }: {
  changes: BranchChanges; base: ModelBase; baseModel: ModelCopy; ctx: Ctx
}): React.ReactElement {
  const { added, changed, removed } = changes.counts
  return (
    <section className="insp-changes" aria-label="Changes">
      <p className="insp-lede insp-tab-lede">
        What changed in the model since {base.source === 'forge' ? 'the start of the Forge run' : <>main <code>{base.commit.slice(0, 7)}</code> ({base.described}{base.branch ? `, ${base.branch}` : ''})</>}{base.source === 'forge' ? '' : ', uncommitted edits included'}; moving elements and editing views do not count. Base saved {ago(base.savedAt)} · {added + changed + removed} elements changed: {added} added, {changed} changed, {removed} removed.
      </p>
      {isBaseOld(base) && (
        <div className="insp-notice warn insp-change-old">
          <strong>The base was saved {ago(base.savedAt)}{base.branch ? `, on ${base.branch}` : ''}.</strong>
          <p className="insp-muted">If you have switched branches or pulled since, the changes below may not be this branch's.</p>
          <SaveBaseHelp old />
        </div>
      )}
      <div className="insp-panel insp-changes-panel">
        <AllChanges changes={changes} baseModel={baseModel} ctx={ctx} />
      </div>
    </section>
  )
}
