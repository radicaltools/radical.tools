import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { documents, useDocumentsStore, type DocumentMeta, type DocumentSource } from '../store/documentStore'
import { confirmForeignFolder } from './confirmForeignFolder'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { useOutsideClick } from '@radical/ui/hooks/useOutsideClick'
import { host } from '../platform/host'
import { reloadActiveDocument } from '../persistence/autosave'
import { NewModelStep, OpenSources, SourceIcon, fileSupported, folderSupported, shortDate } from './ModelSteps'

interface Props {
  open: boolean
  onClose: () => void
}

const isElectron = !!host().openFolder

type Filter = 'all' | DocumentSource

const FILTERS: ReadonlyArray<{ key: Filter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'ls', label: 'Browser' },
  { key: 'fs', label: 'Files' },
  { key: 'md', label: 'Folders' },
]

/** Where a model is kept, in words. */
function locationOf(d: DocumentMeta): string {
  if (d.source === 'md') return d.folderPath ?? 'Folder'
  if (d.source === 'fs') return d.filePath ?? 'File'
  return 'This browser'
}

/** A web file or folder whose access must be granted again this session. */
function needsReconnect(d: DocumentMeta): boolean {
  return !isElectron && d.source !== 'ls' && !d.filePath && !d.folderPath && !documents.isConnected(d.id)
}

/** The ⋯ menu of one model. */
function ModelMenu({ doc, onRename }: { doc: DocumentMeta; onRename: () => void }): React.ReactElement {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const saveDiagram = useDiagramStore((s) => s.saveDiagram)
  useOutsideClick([wrapRef], open, () => setOpen(false))

  // Moving stores the model on screen, so it is offered for the open one only.
  const isActive = doc.id === documents.getActiveId()
  const run = (action: () => void | Promise<void>) => (): void => {
    setOpen(false)
    void action()
  }

  const moveToFile = async (): Promise<void> => {
    await documents.saveAsFile(doc.id, saveDiagram())
  }
  const moveToFolder = async (): Promise<void> => {
    await documents.saveAsFolder(doc.id, saveDiagram(), confirmForeignFolder)
  }
  const remove = (): void => {
    const question = doc.source === 'fs'
      ? `Remove "${doc.name}" from the list?\n\n(The file on disk is kept.)`
      : doc.source === 'md'
        ? `Remove "${doc.name}" from the list?\n\n(The folder on disk is kept.)`
        : `Permanently delete "${doc.name}" from this browser?`
    if (window.confirm(question)) documents.deleteDocument(doc.id)
  }

  return (
    <div className="docmgr-menu-wrap" ref={wrapRef}>
      <button
        type="button"
        className="docmgr-more"
        aria-label={`Actions for ${doc.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
          <circle cx="3" cy="7" r="1.3"/><circle cx="7" cy="7" r="1.3"/><circle cx="11" cy="7" r="1.3"/>
        </svg>
      </button>
      {open && (
        <div className="docmgr-menu" role="menu">
          <button type="button" role="menuitem" onClick={run(onRename)}>Rename</button>
          {isActive && doc.source === 'ls' && (
            <button
              type="button"
              role="menuitem"
              onClick={run(moveToFile)}
              title={fileSupported ? 'Keep this model in a file; every change is saved to it' : 'Download this model as a file'}
            >
              {fileSupported ? 'Move to a file…' : 'Download as file…'}
            </button>
          )}
          {isActive && folderSupported && doc.source !== 'md' && (
            <button
              type="button"
              role="menuitem"
              onClick={run(moveToFolder)}
              title="Keep this model as a folder of Markdown files, one per element"
            >
              Move to a folder…
            </button>
          )}
          <div className="docmgr-menu-sep" />
          <button type="button" role="menuitem" className="danger" onClick={run(remove)}>
            {doc.source === 'ls' ? 'Delete…' : 'Remove from list…'}
          </button>
        </div>
      )}
    </div>
  )
}

export function DocumentManagerModal({ open, onClose }: Props): React.ReactElement | null {
  const docs = useDocumentsStore((s) => s.docs)
  const activeId = useDocumentsStore((s) => s.activeId)
  const [view, setView] = useState<'list' | 'new' | 'open'>('list')
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // Each opening starts on the list.
  useEffect(() => {
    if (open) setView('list')
  }, [open])

  // Escape steps back to the list, then closes.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || renamingId) return
      if (view === 'list') onClose()
      else setView('list')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, view, renamingId])

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: docs.length, ls: 0, fs: 0, md: 0 }
    for (const d of docs) c[d.source]++
    return c
  }, [docs])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return docs
      .filter((d) => filter === 'all' || d.source === filter)
      .filter((d) => !q || d.name.toLowerCase().includes(q) || locationOf(d).toLowerCase().includes(q))
      .sort((a, b) => b.lastModified - a.lastModified)
  }, [docs, filter, query])

  if (!open) return null

  const handleSwitch = (id: string): void => {
    if (id === activeId || renamingId) return
    documents.setActiveId(id)
  }

  // Web File System Access API handles lose permission across reloads; a user
  // gesture re-grants it, after which we reload the folder's or file's content.
  const handleReconnect = async (d: DocumentMeta): Promise<void> => {
    const ok = await documents.reconnect(d.id)
    if (!ok) {
      window.alert(`Could not get permission to access the ${d.source === 'md' ? 'folder' : 'file'}.`)
      return
    }
    // Switching loads the document; if it already is the active one, reload it.
    if (d.id === documents.getActiveId()) reloadActiveDocument()
    else documents.setActiveId(d.id)
    onClose()
  }

  const handleRenameCommit = (): void => {
    if (renamingId) documents.renameDocument(renamingId, renameValue)
    setRenamingId(null)
    setRenameValue('')
  }

  const back = (
    <button type="button" className="msteps-back" onClick={() => setView('list')}>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M10 6H2M5.5 2.5L2 6l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      Back
    </button>
  )

  const renderList = (): React.ReactElement => (
    <>
      <div className="docmgr-toolbar">
        <button className="docmgr-btn primary" onClick={() => setView('new')}>+ New model</button>
        <button className="docmgr-btn" onClick={() => setView('open')}>Open…</button>
        <input
          className="docmgr-search"
          type="search"
          placeholder="Search models"
          aria-label="Search models"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="docmgr-filters" role="radiogroup" aria-label="Show">
        {FILTERS.filter((f) => f.key === 'all' || counts[f.key] > 0).map((f) => (
          <button
            key={f.key}
            type="button"
            role="radio"
            aria-checked={filter === f.key}
            className={`docmgr-filter${filter === f.key ? ' active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            <span className="docmgr-filter-count">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="docmgr-empty">
          {docs.length === 0 ? 'No models yet.' : 'No model matches.'}
        </div>
      ) : (
        <ul className="docmgr-list">
          {visible.map((d) => {
            const isActive = d.id === activeId
            const isRenaming = renamingId === d.id
            return (
              <li key={d.id} className={`docmgr-item${isActive ? ' active' : ''}`}>
                <div
                  className="docmgr-item-main"
                  role={isRenaming ? undefined : 'button'}
                  tabIndex={isRenaming ? undefined : 0}
                  onClick={() => handleSwitch(d.id)}
                  onKeyDown={(e) => { if (!isRenaming && e.key === 'Enter') handleSwitch(d.id) }}
                >
                  <span
                    className={`docmgr-badge ${d.source}`}
                    title={d.source === 'md' ? 'Folder' : d.source === 'fs' ? 'File' : 'This browser'}
                  >
                    <SourceIcon source={d.source} />
                  </span>
                  {isRenaming ? (
                    <input
                      className="docmgr-rename-input"
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={handleRenameCommit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameCommit()
                        else if (e.key === 'Escape') { setRenamingId(null); setRenameValue('') }
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div className="docmgr-item-info">
                      <div className="docmgr-name">
                        {d.name}
                        {isActive && <span className="docmgr-active-tag">open</span>}
                      </div>
                      <div className="docmgr-sub">
                        <span className="docmgr-path" title={locationOf(d)}>{locationOf(d)}</span>
                      </div>
                    </div>
                  )}
                </div>
                {needsReconnect(d) && (
                  <button
                    className="docmgr-btn small"
                    onClick={() => void handleReconnect(d)}
                    title={`Grant access to this ${d.source === 'md' ? 'folder' : 'file'} again and reload it`}
                  >
                    Reconnect…
                  </button>
                )}
                <span className="docmgr-time" title={`Last edited ${new Date(d.lastModified).toLocaleString()}`}>
                  {shortDate(d.lastModified)}
                </span>
                <ModelMenu doc={d} onRename={() => { setRenamingId(d.id); setRenameValue(d.name) }} />
              </li>
            )
          })}
        </ul>
      )}
    </>
  )

  // Render through a portal attached to <body> so the modal escapes any
  // ancestor that creates a containing block for position:fixed (the
  // toolbar uses backdrop-filter, which per CSS spec anchors fixed
  // descendants to the toolbar instead of the viewport — the modal would
  // otherwise appear glued to the top bar instead of centred on screen).
  return createPortal(
    <div
      className="docmgr-backdrop"
      onMouseDown={(e) => {
        // Backdrop closes only when the mouse gesture both starts and ends
        // on the backdrop. Without this, selecting text inside the modal
        // and releasing outside it would close the dialog.
        if (e.target !== e.currentTarget) return
        const start = e.currentTarget
        const onUp = (ev: MouseEvent): void => {
          window.removeEventListener('mouseup', onUp, true)
          if (ev.target === start) onClose()
        }
        window.addEventListener('mouseup', onUp, true)
      }}
    >
      <div
        className="docmgr-modal"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Models"
      >
        <div className="docmgr-header">
          <h2>Models</h2>
          <button className="docmgr-close" onClick={onClose} aria-label="Close" title="Close (Esc)">✕</button>
        </div>

        {view === 'list' && renderList()}
        {view === 'new' && (
          <div className="docmgr-step msteps">
            {back}
            <h2 className="msteps-title">New model</h2>
            <NewModelStep onDone={onClose} />
          </div>
        )}
        {view === 'open' && (
          <div className="docmgr-step msteps">
            {back}
            <h2 className="msteps-title">Open</h2>
            <OpenSources onDone={onClose} autoFocus />
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
