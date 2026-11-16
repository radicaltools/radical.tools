import React, { useState, useRef, useEffect } from 'react'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import type { PresentationSlide } from '@radical/common/c4'
import { keepKeysHere } from '@radical/ui/components/keysHere'

// ── SVG icons ────────────────────────────────────────────────────────────────

const IconPrev = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path d="M10 12L6 8l4-4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const IconNext = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const IconExit = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
  </svg>
)
const IconPresent = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <rect x="1" y="2" width="14" height="10" rx="1.5" />
    <path d="M5 14h6M8 12v2" strokeLinecap="round" />
    <path d="M6 6.5L10 8.5 6 10.5V6.5z" fill="currentColor" stroke="none" />
  </svg>
)
const IconAdd = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path d="M8 3v10M3 8h10" strokeLinecap="round" />
  </svg>
)


// ── Icons of the panel's cards (as the views' and milestones' cards) ─────────

const IconSettings = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
    <path d="M2 4.5 h3 M7 4.5 h7" /><circle cx="5" cy="4.5" r="1.5" />
    <path d="M2 11.5 h7 M11 11.5 h3" /><circle cx="10" cy="11.5" r="1.5" />
  </svg>
)
const IconPencil = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M11 2.5 l2.5 2.5 -7.5 7.5 -3 .5 .5 -3 z" /><path d="M10 3.5 l2.5 2.5" />
  </svg>
)
const IconCamera = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" aria-hidden>
    <path d="M2.5 5.5 h2 l1 -1.5 h5 l1 1.5 h2 v7 h-11 z" /><circle cx="8" cy="9" r="2.3" />
  </svg>
)
const IconCopy = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" aria-hidden>
    <rect x="5" y="5" width="8.5" height="8.5" rx="1.5" /><path d="M3 10.5 V3.5 a1 1 0 0 1 1 -1 h7" />
  </svg>
)
const IconDelete = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
    <path d="M3 5h10M6 5V3h4v2M6 8v5M10 8v5" /><rect x="4" y="5" width="8" height="8" rx="1" />
  </svg>
)
const IconUp = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M8 13V3M4 7l4-4 4 4" /></svg>
)
const IconDown = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M8 3v10M4 9l4 4 4-4" /></svg>
)
const IconGrip = () => (
  <svg viewBox="0 0 10 16" fill="currentColor" aria-hidden>
    <circle cx="3" cy="4" r="1.1" /><circle cx="7" cy="4" r="1.1" />
    <circle cx="3" cy="8" r="1.1" /><circle cx="7" cy="8" r="1.1" />
    <circle cx="3" cy="12" r="1.1" /><circle cx="7" cy="12" r="1.1" />
  </svg>
)
const IconFlag = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
    <path d="M4 14V2.5M4 3h7.5l-1.8 2.75L11.5 8.5H4" strokeLinejoin="round" strokeLinecap="round" />
  </svg>
)

/** The pink of the Presentations place, as each section has a colour. */
const PRESENTATIONS_COLOR = '#ec4899'

// ── Slide card ────────────────────────────────────────────────────────────────

/**
 * One slide in the Presentations place, a card as a view's is: its number
 * where a view has its icon, its name over a grey line with the view and
 * the milestone it shows, and ⚙ for its properties (over Designer). It had
 * four unlabelled icons (a camera, a chain, an eye and a red bin) and
 * coloured tags that repeated its name. Over Designer it is dragged to
 * another place, or moved with Alt+Up/Down.
 */
function SlideCard({ slide, index, isActive, readOnly, view, milestone, drop, dragging, cardRef, onSelect, onProps, onMove, onDragStart, onDragOver, onDrop, onDragEnd }: {
  slide: PresentationSlide
  index: number
  isActive: boolean
  /** Over Viewer: looked through and played, not changed. */
  readOnly: boolean
  view: string
  milestone: string | null
  /** Where a dragged card would land: above or below this one. */
  drop: 'before' | 'after' | null
  dragging: boolean
  cardRef: (el: HTMLDivElement | null) => void
  onSelect: () => void
  onProps: () => void
  onMove: (by: number) => void
  onDragStart: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onDragEnd: () => void
}) {
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      if (readOnly) return
      e.preventDefault()
      onMove(e.key === 'ArrowUp' ? -1 : 1)
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const next = e.key === 'ArrowUp' ? e.currentTarget.parentElement?.previousElementSibling : e.currentTarget.parentElement?.nextElementSibling
      next?.querySelector<HTMLElement>('.pres-slide-card')?.focus()
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect()
    }
  }

  return (
    <div ref={cardRef}
      className={`lp-card lp-view-card pres-slide-card${isActive ? ' active' : ''}${drop ? ` drop-${drop}` : ''}${dragging ? ' dragging' : ''}`}
      style={{ ['--kind-color' as string]: PRESENTATIONS_COLOR }}
      tabIndex={0} role="option" aria-selected={isActive} aria-label={`Slide ${index + 1}: ${slide.name}`}
      draggable={!readOnly}
      title={readOnly ? undefined : 'Drag to move (Alt+↑/↓)'}
      onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop} onDragEnd={onDragEnd}
      onClick={onSelect}
      onKeyDown={onKeyDown}>
      {!readOnly && <span className="pres-slide-grip"><IconGrip /></span>}
      <div className="lp-view-icon pres-slide-num">{index + 1}</div>
      <div className="lp-card-body">
        <div className="lp-card-title pres-slide-name">{slide.name}</div>
        <div className="lp-card-meta pres-slide-caption">
          <span className="pres-slide-caption-view">{view}</span>
          {milestone !== null && (
            <span className="pres-slide-caption-milestone" title={`Milestone: ${milestone}`}>
              <span className="lp-meta-dot" aria-hidden>·</span><IconFlag /><span className="pres-slide-caption-name">{milestone}</span>
            </span>
          )}
        </div>
      </div>
      {!readOnly && (
        <div className="lp-card-actions">
          <button type="button" className="lp-icon-btn" title="Slide properties"
            onClick={e => { e.stopPropagation(); onProps() }}>
            <IconSettings />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Properties, in the panel as a view's and a milestone's are ───────────────

/** A name shown with a pencil, edited in place (as a milestone's). */
function NameField({ name, label, onRename }: { name: string; label: string; onRename: (name: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const commit = () => {
    const next = draft.trim()
    if (next && next !== name) onRename(next)
    setEditing(false)
  }
  return (
    <div>
      <div className="props-section-title">Name</div>
      <div className="props-field">
        {editing ? (
          <input className="props-input" autoFocus value={draft} aria-label={label}
            onChange={e => setDraft(e.target.value)} onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); keepKeysHere(e) }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="pres-props-name">{name}</div>
            <button type="button" className="lp-icon-btn" title={`Rename ${label.toLowerCase()}`}
              onClick={() => { setDraft(name); setEditing(true) }}><IconPencil /></button>
          </div>
        )}
      </div>
    </div>
  )
}

function SlideProperties({ slideId, onClose }: { slideId: string; onClose: () => void }) {
  const slides = useDiagramStore(s => s.presentationSlides)
  const views = useDiagramStore(s => s.views)
  const snapshots = useDiagramStore(s => s.snapshots)
  const renamePresentationSlide = useDiagramStore(s => s.renamePresentationSlide)
  const linkViewToSlide = useDiagramStore(s => s.linkViewToSlide)
  const linkSnapshotToSlide = useDiagramStore(s => s.linkSnapshotToSlide)
  const movePresentationSlide = useDiagramStore(s => s.movePresentationSlide)
  const captureSlideViewport = useDiagramStore(s => s.captureSlideViewport)
  const duplicatePresentationSlide = useDiagramStore(s => s.duplicatePresentationSlide)
  const removePresentationSlide = useDiagramStore(s => s.removePresentationSlide)
  const startPresentation = useDiagramStore(s => s.startPresentation)
  const previewSlide = useDiagramStore(s => s.previewSlide)
  const i = slides.findIndex(s => s.id === slideId)
  const slide = slides[i]
  if (!slide) return null
  return (
    <div className="props-content">
      <div className="props-type-badge" style={{ background: PRESENTATIONS_COLOR, color: '#fff' }}>SLIDE {i + 1} OF {slides.length}</div>
      <NameField name={slide.name} label="Slide" onRename={name => renamePresentationSlide(slide.id, name)} />
      <div>
        <div className="props-section-title">View</div>
        <select className="props-input" aria-label="View of the slide" value={slide.viewId ?? ''}
          onChange={e => linkViewToSlide(slide.id, e.target.value || null)}>
          <option value="">All elements</option>
          {Object.values(views).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>
      <div>
        <div className="props-section-title">Milestone</div>
        <select className="props-input" aria-label="Milestone of the slide" value={slide.snapshotId ?? ''}
          onChange={e => linkSnapshotToSlide(slide.id, e.target.value || null)}>
          <option value="">Live model</option>
          {snapshots.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <div>
        <div className="props-section-title">Place</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1, fontSize: 12, color: 'var(--text-muted)' }}>{i + 1} of {slides.length}</div>
          <button type="button" className="lp-icon-btn" title="Move up (Alt+↑)" disabled={i === 0}
            onClick={() => movePresentationSlide(slide.id, i - 1)}><IconUp /></button>
          <button type="button" className="lp-icon-btn" title="Move down (Alt+↓)" disabled={i === slides.length - 1}
            onClick={() => movePresentationSlide(slide.id, i + 1)}><IconDown /></button>
        </div>
      </div>
      <div className="pres-props-actions">
        <button type="button" className="lp-icon-btn pres-props-btn" title="Take the view, camera and folds on screen now into this slide"
          onClick={() => captureSlideViewport(slide.id)}><IconCamera /> Update from canvas</button>
        <button type="button" className="lp-icon-btn pres-props-btn"
          onClick={() => { duplicatePresentationSlide(slide.id); previewSlide(i + 1) }}><IconCopy /> Duplicate</button>
        <button type="button" className="lp-icon-btn pres-props-btn"
          onClick={() => { useDiagramStore.setState({ presentationSlideIndex: i }); startPresentation() }}><IconPresent /> Present from here</button>
      </div>
      <button type="button" className="pp-delete-btn props-delete" onClick={() => { removePresentationSlide(slide.id); onClose() }}>
        <IconDelete /> Delete slide
      </button>
    </div>
  )
}

function PresentationProperties({ onClose }: { onClose: () => void }) {
  const presentations = useDiagramStore(s => s.presentations)
  const activeId = useDiagramStore(s => s.activePresentationId)
  const renamePresentation = useDiagramStore(s => s.renamePresentation)
  const duplicatePresentation = useDiagramStore(s => s.duplicatePresentation)
  const addPresentation = useDiagramStore(s => s.addPresentation)
  const removePresentation = useDiagramStore(s => s.removePresentation)
  const active = presentations.find(p => p.id === activeId)
  if (!active) return null
  return (
    <div className="props-content">
      <div className="props-type-badge" style={{ background: PRESENTATIONS_COLOR, color: '#fff' }}>PRESENTATION</div>
      <NameField name={active.name} label="Presentation" onRename={name => renamePresentation(active.id, name)} />
      <div>
        <div className="props-section-title">Slides</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{active.slides.length}</div>
      </div>
      <div className="pres-props-actions">
        <button type="button" className="lp-icon-btn pres-props-btn"
          onClick={() => duplicatePresentation(active.id)}><IconCopy /> Duplicate</button>
        <button type="button" className="lp-icon-btn pres-props-btn"
          onClick={() => { addPresentation(); onClose() }}><IconAdd /> New presentation</button>
      </div>
      <button type="button" className="pp-delete-btn props-delete" onClick={() => {
        if (window.confirm(`Delete presentation "${active.name}" and all its slides?`)) { removePresentation(active.id); onClose() }
      }}>
        <IconDelete /> Delete presentation
      </button>
    </div>
  )
}

// ── Presenter HUD (shown during active presentation) ─────────────────────────

function PresenterHUD() {
  const slides = useDiagramStore(s => s.presentationSlides)
  const idx = useDiagramStore(s => s.presentationSlideIndex)
  const goToSlide = useDiagramStore(s => s.goToSlide)
  const stopPresentation = useDiagramStore(s => s.stopPresentation)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // F5 starts a presentation from the toolbar, which is gone while it
      // plays: here it stops it, as the toolbar's F5 does.
      if (e.key === 'Escape' || e.key === 'F5') { e.preventDefault(); stopPresentation(); return }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault(); goToSlide(idx + 1)
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault(); goToSlide(idx - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goToSlide, stopPresentation, idx])

  return (
    <div className="pres-hud">
      <button className="pres-hud-btn" disabled={idx === 0}
        onClick={() => goToSlide(idx - 1)} title="Previous (←)">
        <IconPrev />
      </button>
      <div className="pres-hud-dots">
        {slides.map((s, i) => (
          <button key={s.id}
            className={`pres-hud-dot${i === idx ? ' active' : ''}`}
            onClick={() => goToSlide(i)} title={s.name} />
        ))}
      </div>
      <div className="pres-hud-label">
        <strong>{slides[idx]?.name ?? ''}</strong>
        <span className="pres-hud-counter">{idx + 1} / {slides.length}</span>
      </div>
      <button className="pres-hud-btn" disabled={idx === slides.length - 1}
        onClick={() => goToSlide(idx + 1)} title="Next (→)">
        <IconNext />
      </button>
      <button className="pres-hud-btn exit" onClick={stopPresentation} title="Exit (Esc)">
        <IconExit />
      </button>
    </div>
  )
}

function PresentationPicker({ readOnly = false, onProps }: { readOnly?: boolean; onProps: () => void }) {
  const presentations = useDiagramStore(s => s.presentations)
  const activeId = useDiagramStore(s => s.activePresentationId)
  const setActivePresentation = useDiagramStore(s => s.setActivePresentation)
  const active = presentations.find(p => p.id === activeId)
  // The list across the panel and ⚙ beside it, as a view's card has: the
  // name was cut short beside three icons (a pencil sign, a plus and a bin).
  return (
    <div className="pres-picker">
      <div className="pres-picker-row">
        <select className="pres-picker-select" aria-label="Presentation"
          value={activeId ?? ''}
          title={active?.name}
          onChange={e => setActivePresentation(e.target.value)}>
          {presentations.map(p => (
            <option key={p.id} value={p.id}>{p.name} ({p.slides.length})</option>
          ))}
        </select>
        {/* Presentations are made in Designer; over Viewer only picked. */}
        {!readOnly && (
          <button type="button" className="lp-icon-btn pres-picker-props" title="Presentation properties" onClick={onProps}>
            <IconSettings />
          </button>
        )}
      </div>
    </div>
  )
}

export function PresenterDock({ readOnly = false }: { readOnly?: boolean } = {}): React.ReactElement {
  const slides = useDiagramStore(s => s.presentationSlides)
  const idx = useDiagramStore(s => s.presentationSlideIndex)
  const presentationActive = useDiagramStore(s => s.presentationActive)
  const activePresentationId = useDiagramStore(s => s.activePresentationId)
  const snapshots = useDiagramStore(s => s.snapshots)
  const views = useDiagramStore(s => s.views)

  const addPresentationSlide = useDiagramStore(s => s.addPresentationSlide)
  const movePresentationSlide = useDiagramStore(s => s.movePresentationSlide)
  const startPresentation = useDiagramStore(s => s.startPresentation)
  const stopPresentation = useDiagramStore(s => s.stopPresentation)
  const goToSlide = useDiagramStore(s => s.goToSlide)
  const previewSlide = useDiagramStore(s => s.previewSlide)

  // The properties shown in place of the list, as a view's are.
  const [props, setProps] = useState<{ kind: 'slide'; id: string } | { kind: 'presentation' } | null>(null)
  // A card dragged, and where it would land: the index it goes before.
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropAt, setDropAt] = useState<number | null>(null)
  const cards = useRef(new Map<string, HTMLDivElement>())
  // A card moved with the keys keeps the focus.
  const focusAfterMove = useRef<string | null>(null)

  const activeRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [idx])
  useEffect(() => {
    const id = focusAfterMove.current
    if (!id) return
    focusAfterMove.current = null
    cards.current.get(id)?.focus()
  }, [slides])
  // Another presentation picked, or Viewer: back to the list.
  useEffect(() => { setProps(null) }, [activePresentationId, readOnly])
  const slideGone = props?.kind === 'slide' && !slides.some(s => s.id === props.id)
  useEffect(() => { if (slideGone) setProps(null) }, [slideGone])

  const snapshotNames: Record<string, string> = {}
  for (const s of snapshots) snapshotNames[s.id] = s.name

  const handleSlideSelect = (i: number) => {
    if (presentationActive) {
      if (i === idx) stopPresentation()
      else goToSlide(i)
    } else {
      previewSlide(i)
    }
  }

  const move = (id: string, to: number) => {
    focusAfterMove.current = id
    movePresentationSlide(id, to)
  }

  const endDrag = () => { setDragId(null); setDropAt(null) }
  // The pane not shown takes no focus, as the left panel's (RightPanel):
  // `inert` is not in React 18's attributes, so it is set on the element.
  const listPane = useRef<HTMLDivElement>(null)
  const propsPane = useRef<HTMLDivElement>(null)
  useEffect(() => {
    listPane.current?.toggleAttribute('inert', !!props)
    propsPane.current?.toggleAttribute('inert', !props)
  }, [props])

  // The Presentations place of the activity rail, in the left panel in
  // place of the sections (ADR Presentations are a place of the rail): the
  // picker, Present and Add slide, then the slides one under another; a
  // slide's or the presentation's properties slide in over them.
  return (
    <div className="pres-place lp-section">
      <div className={`rp-slider${props ? ' show-props' : ''}`}>
      <div className="rp-pane" ref={listPane}>
      <div className="lp-section-head">
        <span className="lp-section-title">Presentations</span>
        <span className="lp-section-count" title="Slides in this presentation">{slides.length}</span>
      </div>
      <div className="lp-section-body">
      <div className="lp-section-body-pad">
      <div className="pres-dock-controls">
        <PresentationPicker readOnly={readOnly} onProps={() => setProps({ kind: 'presentation' })} />
        <div className="pres-dock-actions">
          <button className="pres-panel-btn primary" onClick={startPresentation}
            disabled={slides.length === 0} title="Start presentation at the slide shown (F5)">
            <IconPresent />Present
          </button>
          {!readOnly && (
            <button className="pres-panel-btn" onClick={() => addPresentationSlide()}
              title="Add a slide of what is on screen, after the slide shown">
              <IconAdd />Add slide
            </button>
          )}
        </div>
      </div>
      <div className="pres-dock-track" role="listbox" aria-label="Slides">
        {slides.length === 0 && (
          <div className="pres-empty pres-dock-empty">
            {readOnly ? 'No slides in this presentation.' : <>No slides yet — click <strong>Add slide</strong>.</>}
          </div>
        )}
        {slides.map((slide, i) => (
          <div key={slide.id} className="pres-dock-card-wrap">
            <SlideCard slide={slide} index={i} isActive={i === idx} readOnly={readOnly}
              view={slide.viewId ? views[slide.viewId]?.name ?? 'View deleted' : 'All elements'}
              milestone={slide.snapshotId ? snapshotNames[slide.snapshotId] ?? 'Milestone deleted' : null}
              drop={dragId && dragId !== slide.id && dropAt !== null ? (dropAt === i ? 'before' : dropAt === i + 1 ? 'after' : null) : null}
              dragging={dragId === slide.id}
              cardRef={el => {
                if (el) cards.current.set(slide.id, el)
                else cards.current.delete(slide.id)
                if (i === idx) activeRef.current = el
              }}
              onSelect={() => handleSlideSelect(i)}
              onProps={() => setProps({ kind: 'slide', id: slide.id })}
              onMove={by => move(slide.id, i + by)}
              onDragStart={e => {
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', slide.id)
                setDragId(slide.id)
              }}
              onDragOver={e => {
                if (!dragId) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                const box = e.currentTarget.getBoundingClientRect()
                setDropAt(e.clientY < box.top + box.height / 2 ? i : i + 1)
              }}
              onDrop={e => {
                e.preventDefault()
                const from = slides.findIndex(s => s.id === dragId)
                if (dragId && from >= 0 && dropAt !== null) move(dragId, dropAt > from ? dropAt - 1 : dropAt)
                endDrag()
              }}
              onDragEnd={endDrag}
            />
          </div>
        ))}
      </div>
      </div>
      </div>
      </div>
      <div className="rp-pane" ref={propsPane}>
        <button className="rp-back-btn" onClick={() => setProps(null)}>◀ Back</button>
        {props?.kind === 'slide' && <SlideProperties slideId={props.id} onClose={() => setProps(null)} />}
        {props?.kind === 'presentation' && <PresentationProperties onClose={() => setProps(null)} />}
      </div>
      </div>
    </div>
  )
}

// ── Main PresentationBar — only HUD overlay during active presentation ────────

export function PresentationBar(): React.ReactElement | null {
  const presentationActive = useDiagramStore(s => s.presentationActive)
  if (!presentationActive) return null
  return <PresenterHUD />
}
