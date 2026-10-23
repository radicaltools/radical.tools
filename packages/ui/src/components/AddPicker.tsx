import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { C4Node } from '@radical/common/c4'

// ── Add or link ──────────────────────────────────────────────────────────────
// One panel for what may go under an element of a view: the table's + under
// a row and the wiki's Add or link…. It reads as a sentence, "New Need is
// refined into a requirement", the way (a type that may hang there, and in
// the wiki each other relationship: "uses…") a list in the sentence when
// there is more than one. Under a field that names a new element and
// searches the model come two sections: NEW, the element the name makes,
// and EXISTING, the elements the model has that may be linked that way.
// Picking one of those adds only the relation.

export interface PickerWay {
  key: string
  /** A type's name, or how a relationship reads ("Uses"). */
  label: string
  /** How an element of the type hangs here: "realised by", "inside". */
  caption?: string
  /** A type that may hang here, or another relationship. */
  kind: 'child' | 'relation'
  /** Adds a new element of the way's type, named `name` ('' for the
   *  default name). Absent: the way only links. */
  create?: { noun: string; hint?: string; run: (name: string) => void }
  /** Whether this way can link an element the model has: not a type held
   *  inside the element, which would be a move. */
  linkable: boolean
  /** What the model has that may be linked this way. */
  candidates: C4Node[]
  link: (nodeId: string) => void
}

// At most this many elements are listed; typing narrows them.
const LIST_MAX = 60

const article = (noun: string): string => (/^[aeiou]/i.test(noun) ? `an ${noun}` : `a ${noun}`)
// "realised by", "refined into", "constrained by" read after an "is".
const passive = (phrase: string): boolean => /^\w+(ed|en)\b/i.test(phrase)

/** The way as the end of the sentence that starts with the element's name. */
export function wayPhrase(way: PickerWay): string {
  if (way.kind === 'relation') {
    const reads = way.label.toLowerCase()
    return `${passive(reads) ? 'is ' : ''}${reads}…`
  }
  const what = article(way.create?.noun ?? way.label.toLowerCase())
  const caption = way.caption?.toLowerCase()
  if (!caption) return `holds ${what}`
  if (caption === 'inside') return `holds ${what}`
  return `${passive(caption) ? 'is ' : ''}${caption} ${what}`
}

export function AddPicker({ at, under, ways, typeLabel, onClose }: {
  /** Where it opens, in the window: it moves to stay inside it. */
  at: { x: number; y: number }
  /** The element things go under; null at the top of the model. */
  under: C4Node | null
  ways: PickerWay[]
  /** A type's name, after an element of another type than the way's. */
  typeLabel: (type: string) => string
  onClose: () => void
}): React.ReactElement {
  const [wayKey, setWayKey] = useState(ways[0]?.key)
  const way = ways.find((w) => w.key === wayKey) ?? ways[0]
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [position, setPosition] = useState(at)
  const ref = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const name = query.trim()
  const lower = name.toLowerCase()
  const matches = useMemo(
    () => (way?.candidates ?? []).filter((n) => !lower || n.label.toLowerCase().includes(lower)),
    [way, lower],
  )
  const shown = matches.slice(0, LIST_MAX)
  // The rows the arrows move over: the new one first, then the elements.
  const offset = way?.create ? 1 : 0
  const count = offset + shown.length
  useEffect(() => { setActive(0) }, [wayKey, lower])

  // Inside the window, as it grows with the list.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const margin = 8
    const { width, height } = el.getBoundingClientRect()
    setPosition({
      x: Math.max(margin, Math.min(at.x, window.innerWidth - width - margin)),
      y: Math.max(margin, Math.min(at.y, window.innerHeight - height - margin)),
    })
  }, [at.x, at.y, wayKey, shown.length])

  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDown, true)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])
  useEffect(() => { inputRef.current?.focus() }, [wayKey])

  const run = (i: number): void => {
    if (!way || i < 0 || i >= count) return
    onClose()
    if (i < offset) way.create!.run(name)
    else way.link(shown[i - offset].id)
  }

  const title = under ? `Add under ${under.label}` : 'Add at the top'
  const children = ways.filter((w) => w.kind === 'child')
  const relations = ways.filter((w) => w.kind === 'relation')
  // A way of several types (a relationship) says each element's type.
  const mixed = new Set(matches.map((n) => n.type)).size > 1
  return (
    <div
      ref={ref}
      className="add-picker"
      role="dialog"
      aria-label={title}
      style={{ left: position.x, top: position.y }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') { e.stopPropagation(); onClose() }
      }}
    >
      <p className="add-picker-sentence">
        {under ? <strong>{under.label}</strong> : <strong>At the top:</strong>}{' '}
        {ways.length > 1 ? (
          <select
            className="add-picker-way"
            aria-label="What to add or link"
            value={way?.key}
            onChange={(e) => setWayKey(e.target.value)}
          >
            {relations.length > 0 ? (
              <>
                <optgroup label="Add or link">
                  {children.map((w) => <option key={w.key} value={w.key}>{wayPhrase(w)}</option>)}
                </optgroup>
                <optgroup label="Other relationships">
                  {relations.map((w) => <option key={w.key} value={w.key}>{wayPhrase(w)}</option>)}
                </optgroup>
              </>
            ) : children.map((w) => <option key={w.key} value={w.key}>{wayPhrase(w)}</option>)}
          </select>
        ) : way && <span>{wayPhrase(way)}</span>}
      </p>
      <input
        ref={inputRef}
        className="add-picker-input"
        value={query}
        aria-label={way?.create ? `Name a new ${way.create.noun}, or search` : 'Search'}
        placeholder={way?.create ? `Name a new ${way.create.noun}, or search` : 'Search'}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, count - 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
          if (e.key === 'Enter') { e.preventDefault(); run(active) }
        }}
      />
      <div className="add-picker-list" role="listbox" aria-label={title}>
        {way?.create && (
          <>
            <div className="add-picker-section">New</div>
            <div
              role="option"
              aria-selected={active === 0}
              className={`add-picker-row new${active === 0 ? ' active' : ''}`}
              onMouseEnter={() => setActive(0)}
              onClick={() => run(0)}
            >
              <span className="add-picker-plus" aria-hidden>+</span>
              <span className="add-picker-row-label">New {way.create.noun}{name && <> <strong>“{name}”</strong></>}</span>
              {way.create.hint && <span className="add-picker-row-hint">{way.create.hint}</span>}
              <kbd className="add-picker-key">Enter</kbd>
            </div>
          </>
        )}
        {way?.linkable && <div className="add-picker-section">
          Existing{(way?.candidates.length ?? 0) > 0 && <span className="add-picker-count"> {lower ? `${matches.length} of ${way!.candidates.length}` : way!.candidates.length}</span>}
        </div>}
        {shown.map((node, i) => (
          <div
            key={node.id}
            role="option"
            aria-selected={active === offset + i}
            className={`add-picker-row${active === offset + i ? ' active' : ''}`}
            onMouseEnter={() => setActive(offset + i)}
            onClick={() => run(offset + i)}
          >
            <span className="add-picker-row-label">{node.label}</span>
            {mixed && <span className="add-picker-row-hint">{typeLabel(node.type)}</span>}
          </div>
        ))}
        {matches.length > shown.length && (
          <div className="add-picker-empty">{matches.length - shown.length} more: type to narrow them</div>
        )}
        {way?.linkable && matches.length === 0 && (
          <div className="add-picker-empty">
            {lower ? 'None by that name' : 'None in the model to link this way'}
          </div>
        )}
      </div>
    </div>
  )
}
