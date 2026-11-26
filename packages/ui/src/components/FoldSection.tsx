// ─── A section of the properties card that folds to its head ─────────────────
//
// Verification, Tests and Views sit under an element's attributes. Open,
// they filled the lower half of the card and read as one block with the
// attributes, so each folds to its head, which says what the section holds
// (a status, a count): most looks at the card need no more. A click on the
// head, Enter or Space opens it. Open or folded is the user's choice for
// the section, not for one element: it stays as left for every element and
// across reloads.

import React, { useId } from 'react'
import { create } from 'zustand'

const LS_FOLDS = 'radical-card-sections'

function load(): Record<string, boolean> {
  try {
    const kept = JSON.parse(localStorage.getItem(LS_FOLDS) ?? '{}') as unknown
    if (!kept || typeof kept !== 'object' || Array.isArray(kept)) return {}
    return Object.fromEntries(Object.entries(kept).filter(([, open]) => typeof open === 'boolean')) as Record<string, boolean>
  } catch {
    return {}
  }
}

/** The card's sections the user left open (true) or folded; one not in it
 *  is folded. */
export const useCardFolds = create<{ open: Record<string, boolean> }>(() => ({ open: typeof localStorage === 'undefined' ? {} : load() }))

/** Opens or folds the card's section `id`, and keeps it so. */
export function setCardFold(id: string, open: boolean): void {
  useCardFolds.setState((s) => ({ open: { ...s.open, [id]: open } }))
  try { localStorage.setItem(LS_FOLDS, JSON.stringify(useCardFolds.getState().open)) } catch { /* private window */ }
}

export function FoldSection({ id, label, count, summary, actions, className, children }: {
  /** The section, as its state is kept. */
  id: string
  label: string
  /** How many things it holds, said after its name ("Views · 5"). */
  count?: number
  /** What the section holds, said in its head. */
  summary?: React.ReactNode
  /** Buttons of the head that are no part of its toggle. */
  actions?: React.ReactNode
  className?: string
  children: React.ReactNode
}): React.ReactElement {
  const open = useCardFolds((s) => s.open[id] === true)
  const body = useId()
  return (
    <section className={`pp-section pp-fold${open ? ' open' : ''}${className ? ` ${className}` : ''}`} aria-label={label} data-fold={id}>
      <div className="pp-section-title pp-fold-head">
        <button type="button" className="pp-fold-toggle" aria-expanded={open} aria-controls={body} onClick={() => setCardFold(id, !open)}
          title={open ? `Fold ${label}` : `Show ${label}`}>
          <svg className="pp-fold-chevron" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 2 6.5 5 3.5 8" /></svg>
          <span className="pp-fold-label">{label}{count !== undefined && ` · ${count}`}</span>
          {summary}
        </button>
        {actions}
      </div>
      {open && <div className="pp-fold-body" id={body}>{children}</div>}
    </section>
  )
}
