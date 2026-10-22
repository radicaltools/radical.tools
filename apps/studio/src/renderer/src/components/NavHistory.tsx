// ─── Back, forward and the History list (toolbar) ────────────────────────────
//
// The history is the window's history of routes (route.ts); these walk it.
// ‹ and › name the place they lead to; the clock lists the places, newest
// first. Alt+← / Alt+→ (⌘[ / ⌘] on a Mac) outside a text field, and in the
// desktop app a mouse's back and forward buttons, do the same. A place that
// is gone (an exploration closed since) is passed over, and listed greyed.

import React, { useEffect, useRef, useState } from 'react'
import { goBack, goForward, goTo, sinceText, stepIndex, useNavHistory, type NavEntry } from '../navHistory'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { placeGone } from '../route'
import { keysTakenByDialog } from './dialogKeys'

const placeText = (e: NavEntry | undefined): string =>
  !e ? '' : `${e.mode === 'Inspector' || e.mode === 'Metamodel' ? e.where : `${e.mode} › ${e.where}`}${e.element ? ` · ${e.element.label}` : ''}`

const isTextField = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null
  if (!el || typeof el.tagName !== 'string') return false
  return el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT'
    || (el.tagName === 'INPUT' && !['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'color', 'file'].includes((el as HTMLInputElement).type))
}

/** The keys and, in the desktop app, the mouse's side buttons. */
function useNavKeys(): void {
  useEffect(() => {
    const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
    const onKey = (e: KeyboardEvent): void => {
      if (isTextField(e.target) || keysTakenByDialog(e.target)) return
      const back = (e.altKey && !e.metaKey && !e.ctrlKey && e.key === 'ArrowLeft') || (mac && e.metaKey && e.key === '[')
      const forward = (e.altKey && !e.metaKey && !e.ctrlKey && e.key === 'ArrowRight') || (mac && e.metaKey && e.key === ']')
      if (!back && !forward) return
      e.preventDefault()
      if (back) goBack(placeGone)
      else goForward(placeGone)
    }
    // A browser handles the side buttons itself; the desktop app does not.
    const desktop = typeof window !== 'undefined' && !!(window as unknown as { electronAPI?: unknown }).electronAPI
    const onMouse = (e: MouseEvent): void => {
      if (e.button === 3) { e.preventDefault(); goBack(placeGone) }
      if (e.button === 4) { e.preventDefault(); goForward(placeGone) }
    }
    window.addEventListener('keydown', onKey)
    if (desktop) window.addEventListener('mouseup', onMouse)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (desktop) window.removeEventListener('mouseup', onMouse)
    }
  }, [])
}

function NavButton({ dir, target, disabled, onClick }: { dir: 'back' | 'forward'; target: NavEntry | undefined; disabled: boolean; onClick: () => void }): React.ReactElement {
  const name = dir === 'back' ? 'Back' : 'Forward'
  const keys = dir === 'back' ? 'Alt ←' : 'Alt →'
  return (
    <div className="nav-btn-wrap">
      <button type="button" className="toolbar-btn nav-btn" aria-label={name} aria-describedby={`nav-tip-${dir}`} disabled={disabled} onClick={onClick}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d={dir === 'back' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
        </svg>
      </button>
      <div id={`nav-tip-${dir}`} className="branch-tip nav-tip" role="tooltip">
        <strong>{name}</strong>
        <span>{target ? `to ${placeText(target)}` : dir === 'back' ? 'Nothing before this place' : 'Nothing after this place'} · {keys}</span>
      </div>
    </div>
  )
}

/** Back and forward (`arrows`, which also take the keys), or the History
 *  list (`list`): the toolbar puts them either side of Quick Search. */
export function NavHistory({ part }: { part: 'arrows' | 'list' }): React.ReactElement {
  if (part === 'arrows') return <NavArrows />
  return <NavList />
}

function NavArrows(): React.ReactElement {
  useNavKeys()
  const state = useNavHistory()
  // Which places are gone changes as an exploration opens and closes.
  useDiagramStore((s) => s.exploration?.id)
  const back = stepIndex(state, -1, placeGone)
  const forward = stepIndex(state, 1, placeGone)
  return (
    <div className="nav-history">
      <NavButton dir="back" target={back === undefined ? undefined : state.entries[back]} disabled={back === undefined} onClick={() => goBack(placeGone)} />
      <NavButton dir="forward" target={forward === undefined ? undefined : state.entries[forward]} disabled={forward === undefined} onClick={() => goForward(placeGone)} />
    </div>
  )
}

function NavList(): React.ReactElement {
  const entries = useNavHistory((s) => s.entries)
  const index = useNavHistory((s) => s.index)
  useDiagramStore((s) => s.exploration?.id)
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent): void => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent): void => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', key) }
  }, [open])
  const now = Date.now()
  // Newest first; what is ahead of the current place (after going back) on top.
  const listed = entries.map((e, i) => ({ e, i })).reverse()
  return (
    <div className="nav-history nav-history-list" ref={box}>
      <button type="button" className={`toolbar-btn nav-btn${open ? ' active' : ''}`} aria-label="History" aria-haspopup="menu" aria-expanded={open} title="History" onClick={() => setOpen((o) => !o)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
      </button>
      {open && (
        <div className="nav-menu" role="menu" aria-label="History">
          <div className="nav-menu-head"><strong>History</strong><span>this window · {entries.length} place{entries.length === 1 ? '' : 's'}</span></div>
          <div className="nav-menu-list">
            {listed.map(({ e, i }) => {
              // An exploration closed since: listed, no longer there to go to.
              const gone = i !== index && placeGone(e)
              return (
              <button key={i} type="button" role="menuitem" aria-current={i === index ? 'location' : undefined}
                className={`nav-row${i === index ? ' current' : ''}${i > index ? ' ahead' : ''}`}
                disabled={gone} title={gone ? 'Closed since' : undefined}
                onClick={() => { setOpen(false); goTo(i) }}>
                <span className="nav-row-main">
                  <span className="nav-row-where"><b>{e.where}</b>
                    {e.element && <span className="nav-chip"><i style={{ background: e.element.color ?? '#64748b' }}>{e.element.type}</i>{e.element.label}</span>}
                  </span>
                  <span className="nav-row-mode">{e.mode}{i === index ? ' · you are here' : gone ? ' · closed' : i > index ? ' · forward' : ''}</span>
                </span>
                <span className="nav-row-when">{sinceText(e.at, now)}</span>
              </button>
              )
            })}
          </div>
          <div className="nav-menu-foot">Alt ← back · Alt → forward{typeof navigator !== 'undefined' && /Mac/.test(navigator.platform) ? ' · ⌘[ ⌘]' : ''}</div>
        </div>
      )}
    </div>
  )
}
