import React, { useMemo } from 'react'
import type { C4Node } from '@radical/common/c4'
import { refIds, refValue, type PropertyDef } from '@radical/common/metamodel'
import { useDiagramStore } from '../store/diagramStore'

// ─── Reference property input ───────────────────────────────────────────────
// Picks the nodes a 'ref' property points at (a transition's event): one
// from a list, or several as removable chips. Stores ids, shows labels; an id
// with no node of the type stays visible, marked, so it can be removed.

interface Props {
  def: PropertyDef
  value: unknown
  onChange: (value: string | string[]) => void
  readOnly?: boolean
  className?: string
}

export function RefPicker({ def, value, onChange, readOnly, className = 'props-input' }: Props): React.ReactElement {
  const nodes = useDiagramStore((s) => s.c4Nodes)
  const choices = useMemo(
    () => Object.values(nodes)
      .filter((n) => !def.refType || n.type === def.refType)
      .sort((a, b) => a.label.localeCompare(b.label)),
    [nodes, def.refType],
  )
  const ids = refIds(value)
  const valid = (id: string): C4Node | undefined => {
    const n = nodes[id]
    return n && (!def.refType || n.type === def.refType) ? n : undefined
  }

  if (!def.multiple) {
    const id = ids[0] ?? ''
    return (
      <select className={className} value={id} disabled={readOnly} onChange={(e) => onChange(refValue(def, e.target.value ? [e.target.value] : []))}>
        <option value="">(none)</option>
        {id && !valid(id) && <option value={id}>⚠ missing ({id})</option>}
        {choices.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
      </select>
    )
  }

  const rest = choices.filter((n) => !ids.includes(n.id))
  return (
    <div className="ref-picker">
      {ids.map((id) => {
        const n = valid(id)
        return (
          <span key={id} className={`ref-chip${n ? '' : ' ref-chip-missing'}`} title={n ? undefined : `No ${def.refType ?? 'node'} has id ${id}`}>
            {n ? n.label : `⚠ ${id}`}
            {!readOnly && (
              <button type="button" className="ref-chip-remove" aria-label={`Remove ${n?.label ?? id}`}
                onClick={() => onChange(refValue(def, ids.filter((x) => x !== id)))}>×</button>
            )}
          </span>
        )
      })}
      {!readOnly && rest.length > 0 && (
        <select className={`${className} ref-picker-add`} value="" aria-label={`Add to ${def.label}`}
          onChange={(e) => e.target.value && onChange(refValue(def, [...ids, e.target.value]))}>
          <option value="">+ Add…</option>
          {rest.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
        </select>
      )}
      {ids.length === 0 && (readOnly || rest.length === 0) && <span className="ref-picker-empty">(none)</span>}
    </div>
  )
}
