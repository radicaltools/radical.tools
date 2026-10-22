import React, { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { builtInC4Metamodel, metamodelChangeBreaks, propertyKeyProblem, validateModel, type Metamodel } from '@radical/common/metamodel'
import { forkPresetMetamodel } from '@radical/common/model'
import { chainSummary, VIEW_KIND_LABELS, VIEWPOINT_KINDS, viewpointsOf, withViewpoint, withoutViewpoint } from '@radical/common/viewpoints'
import { DEFAULT_SUMMARIES, nodeSummary, summaryTokens } from '@radical/common/nodeSummary'
import { markdownToPlain } from '@radical/common/markdown'
import { MarkdownText } from '@radical/ui/components/MarkdownText'
import type {
  NodeTypeDef,
  RelationTypeDef,
  RelationPair,
  PropertyDef,
  PropertyType,
  ViewpointDef,
  ViewpointKind,
} from '@radical/common/metamodel'
import {
  MetamodelDiagram,
  MetamodelLegend,
  DEFAULT_DIAGRAM_FILTER,
  type DiagramSelection,
} from './metamodel/MetamodelDiagram'
import { MetamodelInspector } from './metamodel/MetamodelInspector'
import { CONTAINS_EDGE, type MetamodelGraphFilter } from './metamodel/metamodelGraph'

// ── small icon helpers ─────────────────────────────────────────────────────

const IconPlus = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
    <path d="M8 3v10M3 8h10" />
  </svg>
)
const IconTrash = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 4.5 h10 M6 4.5 V3 h4 v1.5 M5 4.5 l.7 8.5 a1 1 0 0 0 1 1 h2.6 a1 1 0 0 0 1 -1 l.7 -8.5" />
  </svg>
)

// ── Property editor (used inside type cards) ───────────────────────────────

/** The options of an enum, typed as one comma-separated line. The field
 *  keeps the text as typed and parses it on the way out: re-made from the
 *  parsed options on each key, a comma or a space at the end never survived
 *  ("gold, silver" became one option "goldsilver"). */

/** A type's card opens and closes from the keyboard as by a click on its
 *  header (a div): it was out of reach of Tab. */
function headerKeys(toggle: () => void): { role: 'button'; tabIndex: number; onKeyDown: (e: React.KeyboardEvent) => void } {
  return {
    role: 'button',
    tabIndex: 0,
    onKeyDown: (e) => {
      if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return
      e.preventDefault()
      toggle()
    },
  }
}
function EnumOptionsInput({ options, onChange }: { options: string[]; onChange: (next: string[]) => void }): React.ReactElement {
  const parse = (text: string): string[] => text.split(',').map((s) => s.trim()).filter(Boolean)
  const [text, setText] = useState(options.join(', '))
  // Options changed from elsewhere (undo of a type edit, another card).
  useEffect(() => {
    setText((cur) => (parse(cur).join('\u0000') === options.join('\u0000') ? cur : options.join(', ')))
  }, [options.join('\u0000')]) // eslint-disable-line react-hooks/exhaustive-deps
  // An option added goes in at once; one taken out or renamed when the
  // field is left or Enter is pressed, so an option an element holds is
  // asked about once (the editor asks before it narrows the metamodel),
  // not at each letter of a new name. No options yet means any value: the
  // first ones narrow that, and wait for the field to be left too (they
  // were asked about at "g", "go" and "gol").
  const keepsAll = (next: string[]) => options.length > 0 && options.every((o) => next.includes(o))
  // Typed into since it was last taken.
  const dirty = useRef(false)
  const commit = () => {
    dirty.current = false
    const next = parse(text)
    if (next.join('\u0000') !== options.join('\u0000')) {
      onChange(next)
      // Refused, the options stay, and so does the field; taken, the
      // effect above shows them.
      setText(options.join(', '))
    } else setText(next.join(', '))
  }
  // The editor closed (Esc) with the focus here: what the field shows is
  // taken, as when it is left. Only the additions typed so far were, and
  // ["gold", "s"] stayed while the field had shown "gold, silver".
  const latest = useRef({ text, options, onChange })
  latest.current = { text, options, onChange }
  useEffect(() => () => {
    if (!dirty.current) return
    const { text: last, options: held, onChange: change } = latest.current
    const next = parse(last)
    if (next.join('\u0000') !== held.join('\u0000')) change(next)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <input
      className="mm-input mm-prop-options"
      value={text}
      placeholder="opt1, opt2"
      onChange={(e) => { dirty.current = true; setText(e.target.value); if (keepsAll(parse(e.target.value))) onChange(parse(e.target.value)) }}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit() }}
    />
  )
}

/** A type's minimum or maximum count, taken when the field is left or
 *  Enter is pressed: on each key, "10" was "1" first, which the editor
 *  asks about when fewer elements are allowed than the model holds. */
function CountInput({ value, onCommit }: { value: number | undefined; onCommit: (next: number | undefined) => void }): React.ReactElement {
  const [text, setText] = useState(value === undefined ? '' : String(value))
  useEffect(() => { setText(value === undefined ? '' : String(value)) }, [value])
  const commit = () => {
    const next = text.trim() === '' ? undefined : Number(text)
    if (next !== value && (next === undefined || Number.isFinite(next))) onCommit(next)
    setText(value === undefined ? '' : String(value))
  }
  return (
    <input
      className="mm-input"
      type="number"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit() }}
    />
  )
}

/** The name of a type, a relation type or a property: taken as it is typed,
 *  while it is not blank; an emptied field goes back to the name when it is
 *  left or Enter is pressed (a type could be left with none, a blank entry
 *  in the palette, which upsert_node_type refuses). */
function NameInput({ value, onChange, className = 'mm-input', placeholder }: {
  value: string
  onChange: (name: string) => void
  className?: string
  placeholder?: string
}): React.ReactElement {
  const [text, setText] = useState(value)
  useEffect(() => { setText((cur) => (cur.trim() === value ? cur : value)) }, [value])
  const commit = (): void => {
    const name = text.trim()
    if (name && name !== value) onChange(name)
    setText(name || value)
  }
  return (
    <input
      className={className}
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        setText(e.target.value)
        if (e.target.value.trim()) onChange(e.target.value.trim())
      }}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit() }}
    />
  )
}

/** The key of a property: taken when the field is left or Enter is
 *  pressed, and only when it is one a property may have. Applied on each
 *  key, "type" (or "x", on the way to "xml") was the element's own field
 *  for a moment, and the properties panel then edited that field. */
function PropertyKeyInput({ value, taken, of, onCommit }: {
  value: string
  taken: string[]
  of: 'node' | 'relation'
  onCommit: (key: string) => void
}): React.ReactElement {
  const pushNotification = useDiagramStore((s) => s.pushNotification)
  const [text, setText] = useState(value)
  useEffect(() => { setText(value) }, [value])
  const key = text.trim()
  const problem = key === value ? null
    : !key ? 'A property needs a key.'
    : taken.includes(key) ? `Another property already has the key "${key}".`
    : propertyKeyProblem(key, of)
  const commit = (): void => {
    if (key === value) { setText(value); return }
    if (problem) {
      pushNotification(`Property key not changed: ${problem}`, 'error')
      setText(value)
      return
    }
    onCommit(key)
  }
  return (
    <input
      className="mm-input mm-prop-key"
      value={text}
      placeholder="key"
      title={problem ?? undefined}
      aria-invalid={problem ? true : undefined}
      style={problem ? { borderColor: 'var(--danger, #dc2626)' } : undefined}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        else if (e.key === 'Escape') setText(value)
      }}
    />
  )
}

function PropertyEditor({
  properties,
  nodeTypes,
  of,
  onChange,
}: {
  properties: PropertyDef[]
  /** What a 'ref' property may point at. */
  nodeTypes: NodeTypeDef[]
  /** Whose properties these are: an element type's or a relation type's. */
  of: 'node' | 'relation'
  onChange: (next: PropertyDef[]) => void
}): React.ReactElement {
  const update = (idx: number, patch: Partial<PropertyDef>) => {
    const next = properties.map((p, i) => (i === idx ? { ...p, ...patch } : p))
    onChange(next)
  }
  const remove = (idx: number) => onChange(properties.filter((_, i) => i !== idx))
  // A key no other property has: counted from the list's length, a removed
  // property left a gap and the next one got a key that was taken, so two
  // fields edited one value.
  const add = () => {
    const taken = new Set(properties.map((p) => p.key))
    let n = properties.length + 1
    while (taken.has(`prop${n}`)) n++
    onChange([...properties, { key: `prop${n}`, label: 'New property', type: 'text' }])
  }

  return (
    <div className="mm-prop-list">
      {properties.length === 0 && <div className="mm-empty">No custom properties.</div>}
      {properties.map((p, i) => (
        <div key={i} className="mm-prop-row">
          <PropertyKeyInput
            value={p.key}
            taken={properties.filter((_, j) => j !== i).map((x) => x.key)}
            of={of}
            onCommit={(key) => update(i, { key })}
          />
          <NameInput
            className="mm-input mm-prop-label"
            value={p.label}
            placeholder="Label"
            onChange={(label) => update(i, { label })}
          />
          <select
            className="mm-input mm-prop-type"
            value={p.type}
            onChange={(e) => {
              const type = e.target.value as PropertyType
              update(i, type === 'ref'
                ? { type, refType: p.refType ?? nodeTypes[0]?.id, options: undefined }
                : { type, refType: undefined, multiple: undefined })
            }}
          >
            <option value="text">text</option>
            <option value="textarea">textarea</option>
            <option value="number">number</option>
            <option value="boolean">boolean</option>
            <option value="enum">enum</option>
            <option value="ref">reference</option>
          </select>
          <label className="mm-checkbox" title="Required">
            <input
              type="checkbox"
              checked={!!p.required}
              onChange={(e) => update(i, { required: e.target.checked })}
            />
            req
          </label>
          {p.type === 'enum' && (
            <EnumOptionsInput options={p.options ?? []} onChange={(options) => update(i, { options })} />
          )}
          {p.type === 'ref' && (
            <>
              <select
                className="mm-input mm-prop-options"
                title="Node type it points at"
                value={p.refType ?? ''}
                onChange={(e) => update(i, { refType: e.target.value })}
              >
                {nodeTypes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <label className="mm-checkbox" title="Several nodes instead of one">
                <input
                  type="checkbox"
                  checked={!!p.multiple}
                  onChange={(e) => update(i, { multiple: e.target.checked || undefined })}
                />
                many
              </label>
            </>
          )}
          <button className="mm-icon-btn danger" title="Remove property" onClick={() => remove(i)}>
            <IconTrash />
          </button>
        </div>
      ))}
      <button className="mm-add-btn" onClick={add}>
        <IconPlus /> Add property
      </button>
    </div>
  )
}

/** Opens and scrolls to a card when `focusToken` changes — how the diagram's
 *  "Edit" lands on the right card in the list. */
function useCardFocus(focusToken: number | undefined, setOpen: (v: boolean) => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (focusToken === undefined) return
    setOpen(true)
    requestAnimationFrame(() => ref.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusToken])
  return ref
}

// ── Node-type card ─────────────────────────────────────────────────────────

/** The type's summary template (nodeSummary.ts), with the tokens it can use
 *  and how it reads on an element of the type, when the model has one. */
function SummaryField({ def, onChange }: { def: NodeTypeDef; onChange: (patch: Partial<NodeTypeDef>) => void }): React.ReactElement {
  const metamodel = useDiagramStore((s) => s.metamodel)
  const nodes = useDiagramStore((s) => s.c4Nodes)
  const relations = useDiagramStore((s) => s.c4Relations)
  const sample = useMemo(() => Object.values(nodes).find((n) => n.type === def.id), [nodes, def.id])
  const withDef = useMemo(() => ({ ...metamodel, nodeTypes: { ...metamodel.nodeTypes, [def.id]: def } }), [metamodel, def])
  const preview = sample ? nodeSummary(sample, nodes, relations, withDef) : ''
  return (
    <div className="mm-row">
      <label className="mm-field">
        <span>Summary in tables</span>
        <input
          className="mm-input"
          aria-label="Summary"
          value={def.summary ?? ''}
          placeholder={DEFAULT_SUMMARIES[def.id] ?? '{description.sentence}'}
          onChange={(e) => onChange({ summary: e.target.value || undefined })}
        />
        <small className="mm-hint">
          {summaryTokens(def.id, withDef).map((t) => `{${t}}`).join(' ')}
          {' {out:type} {in:type} linked elements · .sentence first sentence · .phrase first phrase · .cap capital · {a|b} first with a value · [ ] left out when empty · Markdown: **bold** _italic_ `code`'}
        </small>
        {sample && (
          <small className="mm-hint mm-summary-preview" title={markdownToPlain(preview)}>
            {sample.label}: {preview ? <MarkdownText inline text={preview} /> : '—'}
          </small>
        )}
      </label>
    </div>
  )
}

function NodeTypeCard({
  def,
  allTypes,
  focusToken,
  onChange,
  onDelete,
}: {
  def: NodeTypeDef
  allTypes: NodeTypeDef[]
  focusToken?: number
  onChange: (patch: Partial<NodeTypeDef>) => void
  onDelete: () => void
}): React.ReactElement {
  const [open, setOpen] = useState(false)
  const ref = useCardFocus(focusToken, setOpen)

  return (
    <div ref={ref} className={`mm-card${focusToken !== undefined ? ' focused' : ''}`}>
      <div className="mm-card-header" onClick={() => setOpen((v) => !v)} {...headerKeys(() => setOpen((v) => !v))} aria-expanded={open} aria-label={def.label}>
        <svg className={`mm-chevron${open ? ' open' : ''}`} viewBox="0 0 16 16" width="10" height="10">
          <path d="M5 3 L11 8 L5 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="mm-type-badge" style={{ background: def.color, color: def.fg }}>
          <svg viewBox="0 0 16 16" width="12" height="12" fill={def.fg}>
            <path d={def.iconPath} />
          </svg>
        </span>
        <span className="mm-type-label">{def.label}</span>
        <span className="mm-type-id">{def.id}</span>
        {def.builtin && <span className="mm-builtin-tag">built-in</span>}
        <div style={{ flex: 1 }} />
        {!def.builtin && (
          <button
            className="mm-icon-btn danger"
            title="Delete type"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
          >
            <IconTrash />
          </button>
        )}
      </div>
      {open && (
        <div className="mm-card-body">
          <div className="mm-row">
            <label className="mm-field">
              <span>Label</span>
              <NameInput value={def.label} onChange={(label) => onChange({ label })} />
            </label>
            <label className="mm-field mm-field-color">
              <span>Color</span>
              <input
                type="color"
                value={def.color}
                onChange={(e) => onChange({ color: e.target.value })}
              />
            </label>
            <label className="mm-field mm-field-color">
              <span>Text</span>
              <input
                type="color"
                value={def.fg}
                onChange={(e) => onChange({ fg: e.target.value })}
              />
            </label>
          </div>
          <div className="mm-row">
            <label className="mm-field">
              <span>Description</span>
              <textarea
                className="mm-input"
                rows={2}
                value={def.description ?? ''}
                placeholder="What an element of this type is. The wiki shows it."
                onChange={(e) => onChange({ description: e.target.value || undefined })}
              />
            </label>
          </div>
          <div className="mm-row">
            <label className="mm-field">
              <span>Default width</span>
              <input
                className="mm-input"
                type="number"
                value={def.width}
                onChange={(e) => onChange({ width: Number(e.target.value) || 0 })}
              />
            </label>
            <label className="mm-field">
              <span>Default height</span>
              <input
                className="mm-input"
                type="number"
                value={def.height}
                onChange={(e) => onChange({ height: Number(e.target.value) || 0 })}
              />
            </label>
          </div>
          <div className="mm-row">
            <label className="mm-field">
              <span>Min instances</span>
              <CountInput
                value={def.cardinality?.min}
                onCommit={(min) => onChange({ cardinality: { ...def.cardinality, min } })}
              />
            </label>
            <label className="mm-field">
              <span>Max instances</span>
              <CountInput
                value={def.cardinality?.max}
                onCommit={(max) => onChange({ cardinality: { ...def.cardinality, max } })}
              />
            </label>
          </div>

          <div className="mm-section-label">Allowed parents</div>
          <div className="mm-parent-grid">
            <label className="mm-checkbox" title="Elements of this type may sit at the top level, outside any parent.">
              <input
                type="checkbox"
                // Same rule as isParentAllowed: allowedAtRoot wins, else a type with no parents.
                checked={def.allowedAtRoot ?? (!def.allowedParents || def.allowedParents.length === 0)}
                onChange={(e) => onChange({ allowedAtRoot: e.target.checked })}
              />
              At the root
            </label>
            {allTypes
              .filter((t) => t.id !== def.id)
              .map((t) => {
                const checked = def.allowedParents?.includes(t.id) ?? false
                return (
                  <label key={t.id} className="mm-checkbox">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const cur = new Set(def.allowedParents ?? [])
                        if (e.target.checked) cur.add(t.id)
                        else cur.delete(t.id)
                        const arr = Array.from(cur)
                        onChange({ allowedParents: arr.length ? arr : undefined })
                      }}
                    />
                    {t.label}
                  </label>
                )
              })}
          </div>

          <SummaryField def={def} onChange={onChange} />

          <div className="mm-section-label">Custom properties</div>
          <PropertyEditor
            properties={def.properties ?? []}
            nodeTypes={allTypes}
            of="node"
            onChange={(properties) => onChange({ properties })}
          />
        </div>
      )}
    </div>
  )
}

// ── Relation-type card ─────────────────────────────────────────────────────

function RelationTypeCard({
  def,
  allTypes,
  focusToken,
  onChange,
  onDelete,
}: {
  def: RelationTypeDef
  allTypes: NodeTypeDef[]
  focusToken?: number
  onChange: (patch: Partial<RelationTypeDef>) => void
  onDelete: () => void
}): React.ReactElement {
  const [open, setOpen] = useState(false)
  const ref = useCardFocus(focusToken, setOpen)

  const updatePair = (idx: number, patch: Partial<RelationPair>) =>
    onChange({ allowedPairs: def.allowedPairs.map((p, i) => (i === idx ? { ...p, ...patch } : p)) })
  const removePair = (idx: number) =>
    onChange({ allowedPairs: def.allowedPairs.filter((_, i) => i !== idx) })
  const addPair = () => {
    const first = allTypes[0]?.id ?? ''
    onChange({ allowedPairs: [...def.allowedPairs, { from: first, to: first }] })
  }

  return (
    <div ref={ref} className={`mm-card${focusToken !== undefined ? ' focused' : ''}`}>
      <div className="mm-card-header" onClick={() => setOpen((v) => !v)} {...headerKeys(() => setOpen((v) => !v))} aria-expanded={open} aria-label={def.label}>
        <svg className={`mm-chevron${open ? ' open' : ''}`} viewBox="0 0 16 16" width="10" height="10">
          <path d="M5 3 L11 8 L5 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="mm-rel-arrow">→</span>
        <span className="mm-type-label">{def.label}</span>
        <span className="mm-type-id">{def.id}</span>
        {def.builtin && <span className="mm-builtin-tag">built-in</span>}
        <span className="mm-pair-count">
          {def.allowedPairs.length === 0 ? 'any pair' : `${def.allowedPairs.length} pair(s)`}
        </span>
        <div style={{ flex: 1 }} />
        {!def.builtin && (
          <button
            className="mm-icon-btn danger"
            title="Delete relation type"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
          >
            <IconTrash />
          </button>
        )}
      </div>
      {open && (
        <div className="mm-card-body">
          <div className="mm-row">
            <label className="mm-field">
              <span>Label</span>
              <NameInput value={def.label} onChange={(label) => onChange({ label })} />
            </label>
          </div>
          <div className="mm-row">
            <label className="mm-field">
              <span>Description</span>
              <textarea
                className="mm-input"
                rows={2}
                value={def.description ?? ''}
                placeholder="What a relation of this type says about its two ends. The wiki shows it."
                onChange={(e) => onChange({ description: e.target.value || undefined })}
              />
            </label>
          </div>
          <div className="mm-row">
            <label className="mm-field">
              <span>Reads as</span>
              <input
                className="mm-input"
                value={def.forwardLabel ?? ''}
                placeholder={def.label}
                title="How the wiki reads the relation from its source, when the label is a name rather than a verb"
                onChange={(e) => onChange({ forwardLabel: e.target.value || undefined })}
              />
            </label>
            <label className="mm-field">
              <span>Reads back as</span>
              <input
                className="mm-input"
                value={def.inverseLabel ?? ''}
                placeholder="e.g. Constrained by"
                title="How the wiki reads the relation from its target. The canvas does not show it."
                onChange={(e) => onChange({ inverseLabel: e.target.value || undefined })}
              />
            </label>
          </div>

          <div className="mm-section-label">
            Allowed pairs
            <span className="mm-hint">Empty list ⇒ any pair allowed.</span>
          </div>
          <div className="mm-pair-list">
            {def.allowedPairs.map((pair, i) => (
              <div key={i} className="mm-pair-row">
                <select
                  className="mm-input"
                  value={pair.from}
                  onChange={(e) => updatePair(i, { from: e.target.value })}
                >
                  {allTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <span className="mm-pair-arrow">→</span>
                <select
                  className="mm-input"
                  value={pair.to}
                  onChange={(e) => updatePair(i, { to: e.target.value })}
                >
                  {allTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <input
                  className="mm-input mm-num"
                  type="number"
                  placeholder="min"
                  value={pair.min ?? ''}
                  onChange={(e) =>
                    updatePair(i, { min: e.target.value === '' ? undefined : Number(e.target.value) })
                  }
                />
                <input
                  className="mm-input mm-num"
                  type="number"
                  placeholder="max"
                  value={pair.max ?? ''}
                  onChange={(e) =>
                    updatePair(i, { max: e.target.value === '' ? undefined : Number(e.target.value) })
                  }
                />
                <button className="mm-icon-btn danger" onClick={() => removePair(i)} title="Remove">
                  <IconTrash />
                </button>
              </div>
            ))}
            <button className="mm-add-btn" onClick={addPair}>
              <IconPlus /> Add pair
            </button>
          </div>

          <div className="mm-section-label">Custom properties</div>
          <PropertyEditor
            properties={def.properties ?? []}
            nodeTypes={allTypes}
            of="relation"
            onChange={(properties) => onChange({ properties })}
          />
        </div>
      )}
    </div>
  )
}

// ── Issues panel (right column inside metamodel editor) ────────────────────

function ViewpointCard({
  def,
  summary,
  viewCount,
  nodeTypes,
  onChange,
  onDelete,
}: {
  def: ViewpointDef
  summary: string
  viewCount: number
  /** The metamodel's node types, for what a viewpoint draws one of. */
  nodeTypes: Array<{ id: string; label: string }>
  onChange: (next: ViewpointDef) => void
  onDelete: () => void
}): React.ReactElement {
  const [open, setOpen] = useState(false)
  // A viewpoint keeps a name: an emptied field goes back to it.
  const [label, setLabel] = useState(def.label)
  useEffect(() => setLabel(def.label), [def.label])
  const commitLabel = (): void => {
    if (label.trim() && label.trim() !== def.label) onChange({ ...def, label: label.trim() })
    else setLabel(def.label)
  }

  return (
    <div className="mm-card">
      <div className="mm-card-header" onClick={() => setOpen((v) => !v)} {...headerKeys(() => setOpen((v) => !v))} aria-expanded={open} aria-label={def.label}>
        <svg className={`mm-chevron${open ? ' open' : ''}`} viewBox="0 0 16 16" width="10" height="10">
          <path d="M5 3 L11 8 L5 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="mm-type-label">{def.label}</span>
        <span className="mm-type-id">{VIEW_KIND_LABELS[def.kind]}</span>
        {def.group && <span className="mm-builtin-tag">{def.group}</span>}
        {def.subject && <span className="mm-builtin-tag" title={`View per element: a group with one view per ${def.subject.types.map((t) => nodeTypes.find((n) => n.id === t)?.label ?? t).join(' or ')}`}>View per element</span>}
        <span className="mm-viewpoint-summary" title={summary}>{summary}</span>
        <div style={{ flex: 1 }} />
        <span className="mm-pair-count">{viewCount} view(s)</span>
        <button
          className="mm-icon-btn danger"
          title="Delete viewpoint; its views keep their kind and filter"
          aria-label={`Delete viewpoint ${def.label}`}
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          <IconTrash />
        </button>
      </div>
      {open && (
        <div className="mm-card-body">
          <div className="mm-row">
            <label className="mm-field">
              <span>Name</span>
              <input
                className="mm-input"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onBlur={commitLabel}
                onKeyDown={(e) => { if (e.key === 'Enter') commitLabel() }}
              />
            </label>
            <label className="mm-field">
              <span>Group</span>
              <input
                className="mm-input"
                value={def.group ?? ''}
                placeholder="Custom"
                title="The concern it serves: New view lists the viewpoints by group"
                onChange={(e) => {
                  const { group: _old, ...rest } = def
                  onChange(e.target.value ? { ...rest, group: e.target.value } : rest)
                }}
              />
            </label>
            <label className="mm-field">
              <span>View type</span>
              <select
                className="mm-input"
                value={def.kind}
                onChange={(e) => onChange({ ...def, kind: e.target.value as ViewpointKind })}
              >
                {VIEWPOINT_KINDS.map((k) => <option key={k} value={k}>{VIEW_KIND_LABELS[k]}</option>)}
              </select>
            </label>
          </div>
          <div className="mm-row">
            <label className="mm-field">
              <span>Description</span>
              <textarea
                className="mm-input"
                rows={2}
                value={def.description ?? ''}
                placeholder="What a view of this viewpoint shows. New view shows it."
                onChange={(e) => {
                  const { description: _old, ...rest } = def
                  onChange(e.target.value ? { ...rest, description: e.target.value } : rest)
                }}
              />
            </label>
          </div>
          <div className="mm-field">
            <span>View per element</span>
            <div className="mm-subject-types" role="group" aria-label="View per element">
              {nodeTypes.map((t) => {
                const on = !!def.subject?.types.includes(t.id)
                return (
                  <button key={t.id} type="button" className={`mm-subject-type${on ? ' on' : ''}`} aria-pressed={on}
                    onClick={() => {
                      const types = on ? (def.subject?.types ?? []).filter((x) => x !== t.id) : [...(def.subject?.types ?? []), t.id]
                      const { subject: _old, ...rest } = def
                      onChange(types.length ? { ...rest, subject: { types } } : rest)
                    }}>
                    {t.label}
                  </button>
                )
              })}
            </div>
            <span className="mm-hint">None: a view of it shows the whole model. Some: a view of it is a group with one view per element of these types, named after it, showing it and what lies inside it, made and removed with the elements.</span>
          </div>
          <div className="mm-footer-note">
            Filter: {summary}. To change it, detach a view of this viewpoint in its Filter, edit the
            chain and save it as a viewpoint under this name: every view of the viewpoint follows.
          </div>
        </div>
      )}
    </div>
  )
}

function IssuesPanel(): React.ReactElement {
  const nodes = useDiagramStore((s) => s.c4Nodes)
  const relations = useDiagramStore((s) => s.c4Relations)
  const metamodel = useDiagramStore((s) => s.metamodel)
  const selectNode = useDiagramStore((s) => s.selectNode)
  const setAppMode = useDiagramStore((s) => s.setAppMode)

  const issues = useMemo(
    () => validateModel(nodes, relations, metamodel),
    [nodes, relations, metamodel],
  )

  return (
    <div className="mm-issues">
      <div className="mm-issues-header">
        <strong>Validation</strong>
        <span className={`mm-issues-count${issues.length ? ' has' : ''}`}>{issues.length}</span>
      </div>
      {issues.length === 0 && <div className="mm-empty">Model is consistent with metamodel.</div>}
      {issues.map((issue) => (
        <div key={issue.id} className={`mm-issue mm-issue-${issue.severity}`}>
          <div className="mm-issue-msg">{issue.message}</div>
          {issue.nodeId && (
            <button
              className="mm-link"
              onClick={() => {
                selectNode(issue.nodeId!)
                setAppMode('designer')
              }}
            >
              Open in Designer →
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main perspective ───────────────────────────────────────────────────────

type EditorTab = 'list' | 'diagram'
const LS_TAB = 'radical-metamodel-tab'

function readTab(): EditorTab {
  try {
    return localStorage.getItem(LS_TAB) === 'diagram' ? 'diagram' : 'list'
  } catch {
    return 'list'
  }
}

/** A field typed into: a text input or a text area. */
const isTextField = (el: EventTarget): boolean =>
  el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && ['text', 'number', 'search', ''].includes(el.type))

export function MetamodelEditor(): React.ReactElement {
  const metamodel = useDiagramStore((s) => s.metamodel)
  const upsertNodeType = useDiagramStore((s) => s.upsertNodeType)
  const removeNodeType = useDiagramStore((s) => s.removeNodeType)
  const upsertRelationType = useDiagramStore((s) => s.upsertRelationType)
  const removeRelationType = useDiagramStore((s) => s.removeRelationType)
  const resetMetamodelToC4 = useDiagramStore((s) => s.resetMetamodelToC4)
  const setMetamodel = useDiagramStore((s) => s.setMetamodel)

  const nodeTypes = useMemo(() => Object.values(metamodel.nodeTypes), [metamodel])
  const relationTypes = useMemo(() => Object.values(metamodel.relationTypes), [metamodel])
  const viewpoints = useMemo(() => viewpointsOf(metamodel), [metamodel])
  const nodes = useDiagramStore((s) => s.c4Nodes)
  const relations = useDiagramStore((s) => s.c4Relations)
  const views = useDiagramStore((s) => s.views)
  const viewpointCtx = useMemo(() => ({ nodes, relations, metamodel }), [nodes, relations, metamodel])

  /** Whether to make a change of the metamodel to `next`: at once, unless
   *  it leaves what the model holds against the metamodel (parents, a
   *  maximum, options, a required property, pairs narrowed below it, a
   *  type deleted, an any-pair type added beside the one an untyped
   *  relation reads as); then after the user has seen what it breaks and
   *  said yes. A change that asks anyway (`question`) asks it once, with
   *  the list. */
  const confirmNarrowing = (next: Metamodel, question?: string): boolean => {
    const breaks = metamodelChangeBreaks(nodes, relations, metamodel, next)
    if (!breaks.length) return question ? window.confirm(question) : true
    const shown = breaks.slice(0, 10).map((i) => `• ${i.message}`).join('\n')
    const more = breaks.length > 10 ? `\n…and ${breaks.length - 10} more` : ''
    return window.confirm(`${question ? `${question}\n\n` : ''}This change leaves what the model holds against the metamodel (${breaks.length} ${breaks.length === 1 ? 'issue' : 'issues'}):\n\n${shown}${more}\n\nChange the metamodel anyway? Validation will list them until they are fixed.`)
  }
  const changeNodeType = (def: NodeTypeDef): void => {
    if (confirmNarrowing({ ...metamodel, nodeTypes: { ...metamodel.nodeTypes, [def.id]: def } })) upsertNodeType(def)
  }
  const changeRelationType = (def: RelationTypeDef): void => {
    if (confirmNarrowing({ ...metamodel, relationTypes: { ...metamodel.relationTypes, [def.id]: def } })) upsertRelationType(def)
  }

  const addNodeType = () => {
    const base = builtInC4Metamodel().nodeTypes.system
    let i = 1
    let id = `type${i}`
    while (metamodel.nodeTypes[id]) {
      i += 1
      id = `type${i}`
    }
    upsertNodeType({
      ...base,
      id,
      label: `New type ${i}`,
      builtin: false,
      color: '#6b7280',
      fg: '#ffffff',
      allowedParents: undefined,
      properties: [],
    })
  }

  const addRelationType = () => {
    let i = 1
    let id = `rel${i}`
    while (metamodel.relationTypes[id]) {
      i += 1
      id = `rel${i}`
    }
    const def: RelationTypeDef = { id, label: `New relation ${i}`, allowedPairs: [], builtin: false }
    // With no pairs it fits every pair (decided 2026-10-21).
    changeRelationType(def)
  }

  const setAppMode = useDiagramStore((s) => s.setAppMode)
  const close = (): void => setAppMode('designer')

  const [tab, setTabState] = useState<EditorTab>(readTab)
  const setTab = (t: EditorTab): void => {
    setTabState(t)
    try { localStorage.setItem(LS_TAB, t) } catch { /* storage unavailable */ }
  }
  const [selection, setSelection] = useState<DiagramSelection>(null)
  const [diagramFilter, setDiagramFilter] = useState<MetamodelGraphFilter>(DEFAULT_DIAGRAM_FILTER)
  // Card to open + scroll to in the list; the counter re-triggers the same card.
  const [focusCard, setFocusCard] = useState<{ kind: 'type' | 'relation'; id: string; token: number } | null>(null)
  const editInList = (s: NonNullable<DiagramSelection>): void => {
    if (s.kind === 'relation' && s.id === CONTAINS_EDGE) return
    setFocusCard((cur) => ({ kind: s.kind, id: s.id, token: (cur?.token ?? 0) + 1 }))
    setTab('list')
  }
  const focusTokenFor = (kind: 'type' | 'relation', id: string): number | undefined =>
    focusCard && focusCard.kind === kind && focusCard.id === id ? focusCard.token : undefined

  // Esc clears the diagram selection first, then closes the editor.
  const selectionRef = useRef(selection)
  selectionRef.current = selection
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      if (selectionRef.current) setSelection(null)
      else close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return createPortal(
    <div
      className="milestone-modal-backdrop mm-editor-backdrop"
      onMouseDown={(e) => {
        if (e.target !== e.currentTarget) return
        const start = e.currentTarget
        const onUp = (ev: MouseEvent): void => {
          window.removeEventListener('mouseup', onUp, true)
          if (ev.target === start) close()
        }
        window.addEventListener('mouseup', onUp, true)
      }}
    >
      <div
        className={`milestone-modal mm-editor-modal${tab === 'diagram' ? ' is-diagram' : ''}`}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        // What is typed into a field until it loses focus is one undo step
        // (each letter of a type's name was one).
        onFocus={(e) => { if (isTextField(e.target)) useDiagramStore.getState().beginTyping() }}
        onBlur={(e) => { if (isTextField(e.target)) useDiagramStore.getState().endTyping() }}
        role="dialog"
        aria-label="Metamodel editor"
      >
        <button
          type="button"
          className="mm-editor-modal-close"
          aria-label="Close metamodel editor"
          title="Close (Esc)"
          onClick={close}
        >
          ✕
        </button>
        <div className="mm-editor">
          <div className={`mm-editor-main${tab === 'diagram' ? ' is-diagram' : ''}`}>
        <div className="mm-editor-header">
          <div>
            <input
              className="mm-input mm-name"
              value={metamodel.name}
              onChange={(e) => setMetamodel({ ...(forkPresetMetamodel(metamodel) ?? metamodel), name: e.target.value })}
            />
            <div className="mm-subhead">
              Per-document metamodel · {nodeTypes.length} node type(s) · {relationTypes.length} relation type(s) · {viewpoints.length} viewpoint(s)
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <div className="mm-tabs" role="tablist" aria-label="Metamodel view">
            {(['list', 'diagram'] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                className={`mm-tab${tab === t ? ' active' : ''}`}
                onClick={() => setTab(t)}
              >
                {t === 'list' ? 'List' : 'Diagram'}
              </button>
            ))}
          </div>
          <button
            className="mm-btn"
            onClick={() => resetMetamodelToC4((next) => confirmNarrowing(next, 'Reset metamodel to built-in C4? Custom types will be lost.'))}
          >
            Reset to C4 preset
          </button>
        </div>

        {tab === 'diagram' ? (
          <MetamodelDiagram
            metamodel={metamodel}
            filter={diagramFilter}
            selection={selection}
            onSelect={setSelection}
            onEdit={(id) => editInList({ kind: 'type', id })}
          />
        ) : (
        <>
        <div className="mm-section">
          <div className="mm-section-header">
            <h3>Node types</h3>
            <button className="mm-btn primary" onClick={addNodeType}>
              <IconPlus /> Add node type
            </button>
          </div>
          <div className="mm-card-list">
            {nodeTypes.map((t) => (
              <NodeTypeCard
                key={t.id}
                def={t}
                allTypes={nodeTypes}
                focusToken={focusTokenFor('type', t.id)}
                onChange={(patch) => changeNodeType({ ...t, ...patch })}
                onDelete={() => removeNodeType(t.id, (next) => confirmNarrowing(next))}
              />
            ))}
          </div>
        </div>

        <div className="mm-section">
          <div className="mm-section-header">
            <h3>Relation types</h3>
            <button className="mm-btn primary" onClick={addRelationType}>
              <IconPlus /> Add relation type
            </button>
          </div>
          <div className="mm-card-list">
            {relationTypes.map((t) => (
              <RelationTypeCard
                key={t.id}
                def={t}
                allTypes={nodeTypes}
                focusToken={focusTokenFor('relation', t.id)}
                onChange={(patch) => changeRelationType({ ...t, ...patch })}
                onDelete={() => removeRelationType(t.id, (next) => confirmNarrowing(next))}
              />
            ))}
          </div>
        </div>

        <div className="mm-section">
          <div className="mm-section-header">
            <h3>Viewpoints</h3>
          </div>
          {viewpoints.length === 0 && (
            <div className="mm-empty">
              None yet. Save a view as a viewpoint from its Filter, in the view's properties.
            </div>
          )}
          <div className="mm-card-list">
            {viewpoints.map((t) => (
              <ViewpointCard
                key={t.id}
                def={t}
                summary={chainSummary(t.pipeline, viewpointCtx)}
                viewCount={Object.values(views).filter((v) => v.viewpoint === t.id).length}
                nodeTypes={Object.entries(metamodel.nodeTypes).map(([id, n]) => ({ id, label: n.label }))}
                onChange={(next) => setMetamodel(withViewpoint(metamodel, next))}
                onDelete={() => setMetamodel(withoutViewpoint(metamodel, t.id))}
              />
            ))}
          </div>
        </div>

        <div className="mm-footer-note">
          Note: changes to built-in C4 types affect this document only. Newly added types are
          stored in the metamodel and surface in the Issues panel; full canvas styling for
          custom types lands in a follow-up.
        </div>
        </>
        )}
      </div>

      <aside className="mm-editor-side">
        {tab === 'diagram' && selection ? (
          <MetamodelInspector
            metamodel={metamodel}
            selection={selection}
            onSelect={setSelection}
            onEdit={editInList}
          />
        ) : tab === 'diagram' ? (
          <>
            <MetamodelLegend
              metamodel={metamodel}
              filter={diagramFilter}
              selection={selection}
              onFilter={setDiagramFilter}
              onSelect={setSelection}
            />
            <IssuesPanel />
          </>
        ) : (
          <IssuesPanel />
        )}
      </aside>
        </div>
      </div>
    </div>,
    document.body,
  )
}
