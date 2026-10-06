import React from 'react'
import { isParentAllowed, type Metamodel, type PropertyDef } from '@radical/common/metamodel'
import { relationColor, typeNeighbourhood, CONTAINS_COLOR, CONTAINS_EDGE } from './metamodelGraph'
import type { DiagramSelection } from './MetamodelDiagram'

interface Props {
  metamodel: Metamodel
  selection: NonNullable<DiagramSelection>
  onSelect: (s: DiagramSelection) => void
  /** Open the selected type / relation type in the list editor. */
  onEdit: (s: NonNullable<DiagramSelection>) => void
}

function TypeChip({ metamodel, id, onSelect }: { metamodel: Metamodel; id: string; onSelect: Props['onSelect'] }): React.ReactElement {
  const def = metamodel.nodeTypes[id]
  return (
    <button className="mmi-chip" onClick={() => onSelect({ kind: 'type', id })} title={id}>
      <span className="mmi-swatch" style={{ background: def?.color ?? '#888' }} />
      {def?.label ?? id}
    </button>
  )
}

function Properties({ properties }: { properties: PropertyDef[] }): React.ReactElement {
  if (properties.length === 0) return <div className="mm-empty">No custom properties.</div>
  return (
    <div className="mmi-props">
      {properties.map((p) => (
        <div key={p.key} className="mmi-prop">
          <div>
            <span className="mmi-prop-key">{p.key}</span>
            {p.required && <span className="mmd-req">*</span>}
            <span className="mmi-prop-type">{p.type}</span>
          </div>
          {p.label !== p.key && <div className="mmi-prop-sub">{p.label}</div>}
          {p.options && p.options.length > 0 && <div className="mmi-prop-sub">{p.options.join(' · ')}</div>}
        </div>
      ))}
    </div>
  )
}

function RelationGroups({
  metamodel,
  groups,
  onSelect,
}: {
  metamodel: Metamodel
  groups: Map<string, string[]>
  onSelect: Props['onSelect']
}): React.ReactElement {
  if (groups.size === 0) return <div className="mm-empty">None.</div>
  return (
    <>
      {[...groups].map(([relId, typeIds]) => (
        <div key={relId} className="mmi-rel-group">
          <button className="mmi-rel-name" onClick={() => onSelect({ kind: 'relation', id: relId })}>
            <span className="mmi-rel-line" style={{ background: relationColor(metamodel, relId) }} />
            {metamodel.relationTypes[relId]?.label ?? relId}
          </button>
          <div className="mmi-chips">
            {typeIds.map((t) => <TypeChip key={t} metamodel={metamodel} id={t} onSelect={onSelect} />)}
          </div>
        </div>
      ))}
    </>
  )
}

function TypeInspector({ metamodel, selection, onSelect, onEdit }: Props): React.ReactElement {
  const def = metamodel.nodeTypes[selection.id]
  if (!def) return <div className="mm-empty">Type “{selection.id}” no longer exists.</div>
  const nb = typeNeighbourhood(metamodel, def.id)
  const atRoot = isParentAllowed(metamodel, def.id, undefined)
  const card = def.cardinality
  const facts = [
    def.builtin ? 'built-in' : 'custom',
    def.hubOnly ? 'Hub only' : null,
    def.tableTab ? 'own Table View tab' : null,
    card?.min != null || card?.max != null ? `${card?.min ?? 0}…${card?.max ?? '∞'} per document` : null,
  ].filter(Boolean)
  return (
    <>
      <div className="mmi-head">
        <span className="mm-type-badge" style={{ background: def.color, color: def.fg }}>
          <svg viewBox="0 0 16 16" width="12" height="12" fill={def.fg}><path d={def.iconPath} /></svg>
        </span>
        <div>
          <div className="mmi-title">{def.label}</div>
          <div className="mm-type-id">{def.id}</div>
        </div>
      </div>
      <div className="mmi-facts">{facts.join(' · ')}</div>
      <button className="mm-btn primary mmi-edit" onClick={() => onEdit(selection)}>Edit type</button>

      <div className="mm-section-label">Can be inside</div>
      <div className="mmi-chips">
        {atRoot && <span className="mmi-chip static">canvas root</span>}
        {nb.parents.map((p) => <TypeChip key={p} metamodel={metamodel} id={p} onSelect={onSelect} />)}
        {!atRoot && nb.parents.length === 0 && <span className="mm-empty">Nowhere — the type cannot be placed.</span>}
      </div>

      <div className="mm-section-label">Can contain</div>
      <div className="mmi-chips">
        {nb.children.length === 0 && <span className="mm-empty">Nothing.</span>}
        {nb.children.map((c) => <TypeChip key={c} metamodel={metamodel} id={c} onSelect={onSelect} />)}
      </div>

      <div className="mm-section-label">Relations out</div>
      <RelationGroups metamodel={metamodel} groups={nb.outgoing} onSelect={onSelect} />

      <div className="mm-section-label">Relations in</div>
      <RelationGroups metamodel={metamodel} groups={nb.incoming} onSelect={onSelect} />

      <div className="mm-section-label">Properties</div>
      <Properties properties={def.properties ?? []} />
    </>
  )
}

function RelationInspector({ metamodel, selection, onSelect, onEdit }: Props): React.ReactElement {
  if (selection.id === CONTAINS_EDGE) {
    const pairs = Object.values(metamodel.nodeTypes)
      .map((t) => [t.id, (t.allowedParents ?? []).filter((p) => metamodel.nodeTypes[p])] as const)
      .filter(([, parents]) => parents.length > 0)
    return (
      <>
        <div className="mmi-head">
          <span className="mmi-rel-line wide" style={{ background: CONTAINS_COLOR }} />
          <div className="mmi-title">Contains</div>
        </div>
        <div className="mmi-facts">
          Which types may be drawn inside which. The diamond marks the parent. Edit it per type under
          “Allowed parents”.
        </div>
        <div className="mm-section-label">Child ← allowed parents</div>
        {pairs.map(([child, parents]) => (
          <div key={child} className="mmi-rel-group">
            <TypeChip metamodel={metamodel} id={child} onSelect={onSelect} />
            <div className="mmi-chips indent">
              {parents.map((p) => <TypeChip key={p} metamodel={metamodel} id={p} onSelect={onSelect} />)}
            </div>
          </div>
        ))}
      </>
    )
  }

  const def = metamodel.relationTypes[selection.id]
  if (!def) return <div className="mm-empty">Relation type “{selection.id}” no longer exists.</div>
  const bySource = new Map<string, string[]>()
  for (const { from, to } of def.allowedPairs) {
    const list = bySource.get(from) ?? []
    if (!list.includes(to)) list.push(to)
    bySource.set(from, list)
  }
  return (
    <>
      <div className="mmi-head">
        <span className="mmi-rel-line wide" style={{ background: relationColor(metamodel, def.id) }} />
        <div>
          <div className="mmi-title">{def.label}</div>
          <div className="mm-type-id">{def.id}</div>
        </div>
      </div>
      <div className="mmi-facts">
        {def.builtin ? 'built-in' : 'custom'} ·{' '}
        {def.allowedPairs.length === 0 ? 'allowed between any types' : `${def.allowedPairs.length} allowed pair(s)`}
      </div>
      <button className="mm-btn primary mmi-edit" onClick={() => onEdit(selection)}>Edit relation type</button>

      {bySource.size > 0 && <div className="mm-section-label">From → to</div>}
      {[...bySource].map(([from, tos]) => (
        <div key={from} className="mmi-rel-group">
          <TypeChip metamodel={metamodel} id={from} onSelect={onSelect} />
          <div className="mmi-chips indent">
            <span className="mmi-arrow">→</span>
            {tos.map((t) => <TypeChip key={t} metamodel={metamodel} id={t} onSelect={onSelect} />)}
          </div>
        </div>
      ))}

      <div className="mm-section-label">Properties</div>
      <Properties properties={def.properties ?? []} />
    </>
  )
}

export function MetamodelInspector(props: Props): React.ReactElement {
  const { kind } = props.selection
  return (
    <div className="mmi">
      <button className="mm-link mmi-back" onClick={() => props.onSelect(null)}>← Validation</button>
      {kind === 'type' ? <TypeInspector {...props} /> : <RelationInspector {...props} />}
    </div>
  )
}
