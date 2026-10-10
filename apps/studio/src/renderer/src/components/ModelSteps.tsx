// The "New model" and "Open" steps, shared by the welcome screen and the
// Models dialog so both create and open models the same way. Styled with the
// theme variables (.msteps-*); the welcome card pins them to its light look.

import React, { useState } from 'react'
import { documents, StorageFullError, type DocumentMeta } from '../store/documentStore'
import { buildFintechSampleRaw } from '../store/fintechSample'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { formatRoute } from '../route'
import { availableMetamodels } from '@radical/common/metamodel'
import { parseStructurizrDsl } from '@radical/common/formats/structurizrDsl'
import type { DiagramData } from '@radical/common/c4'
import { host } from '../platform/host'
import { webFileSupported, webFolderSupported } from '../persist/webFolder'
import { aiReady, loadAISettings } from '../ai/settings'
import { confirmForeignFolder } from './confirmForeignFolder'

/** Markdown folders open in Electron and in Chromium browsers (File System
 *  Access API). */
export const folderSupported = !!host().openFolder || webFolderSupported()

/** A model kept in a file it is saved back to: Electron, and Chromium
 *  browsers (File System Access API). Elsewhere a file is import / export. */
export const fileSupported = !!host().saveDiagram || webFileSupported()

/** Where "New model" keeps the model. The last choice is remembered per
 *  browser. */
type Storage = 'browser' | 'file' | 'folder'
const STORAGE_KEY = 'radical-new-model-storage'

const STORAGE_OPTIONS: { id: Storage; name: string; description: string }[] = [
  {
    id: 'browser',
    name: 'In this browser',
    description: 'Nothing to pick. Export a file to share it.',
  },
  ...(fileSupported ? [{
    id: 'file' as const,
    name: 'In a file',
    description: 'One .radical file you pick; every change is saved to it.',
  }] : []),
  ...(folderSupported ? [{
    id: 'folder' as const,
    name: 'In a folder',
    description: 'Markdown files in a folder you pick: ready for git, Claude Code and MCP.',
  }] : []),
]

function loadStorageChoice(): Storage {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return STORAGE_OPTIONS.find(o => o.id === stored)?.id ?? 'browser'
  } catch {
    return 'browser'
  }
}

function saveStorageChoice(storage: Storage): void {
  try {
    localStorage.setItem(STORAGE_KEY, storage)
  } catch {
    // Not remembered; the choice still applies now.
  }
}

/** Adds a browser model and opens it; says why when browser storage refused it. */
function createInBrowser(name: string, data: DiagramData): DocumentMeta | null {
  try {
    return documents.createLSDocument(name, data)
  } catch (e) {
    window.alert((e as Error).message)
    return null
  }
}

/** Opens a model. A file or folder opened in an earlier session needs access
 *  granted again; the click that got here is the gesture the browser asks for. */
export async function openDocument(id: string): Promise<void> {
  if (documents.awaitsReconnect(id)) await documents.reconnect(id)
  documents.setActiveId(id)
}

/** Today's time, or the day for anything older. */
export function shortDate(ts: number): string {
  const d = new Date(ts)
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// ─── Icons ───────────────────────────────────────────────────────────────────

export function BrowserIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="1.5" y="2" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <line x1="1.5" y1="5" x2="12.5" y2="5" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  )
}

export function FileIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3 1.5h5l3 3v8H3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="M8 1.5v3h3" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    </svg>
  )
}

export function FolderIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M1.5 3.5a1 1 0 0 1 1-1h3l1.5 1.5h4.5a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    </svg>
  )
}

function SparkleIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
      <path d="M4.5 1.5l.9 2.1L7.5 4.5l-2.1.9-.9 2.1-.9-2.1L1.5 4.5l2.1-.9z"/>
      <path d="M10.5 6.5l.65 1.35L12.5 8.5l-1.35.65-.65 1.35-.65-1.35L8.5 8.5l1.35-.65z"/>
    </svg>
  )
}

function DslIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M5 3.5L1.5 7 5 10.5M9 3.5L12.5 7 9 10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

/** A model's storage as an icon. */
export function SourceIcon({ source }: { source: DocumentMeta['source'] }): React.ReactElement {
  return source === 'md' ? <FolderIcon /> : source === 'fs' ? <FileIcon /> : <BrowserIcon />
}

// ─── Rows ────────────────────────────────────────────────────────────────────

interface RowProps {
  icon: React.ReactNode
  name: string
  meta?: string
  onClick: () => void
  autoFocus?: boolean
  title?: string
}

/** One clickable line: a model, or a place to open one from. */
export function StepRow({ icon, name, meta, onClick, autoFocus, title }: RowProps): React.ReactElement {
  return (
    <button type="button" className="msteps-row" onClick={onClick} autoFocus={autoFocus} title={title}>
      <span className="msteps-row-icon">{icon}</span>
      <span className="msteps-row-name">{name}</span>
      {meta && <span className="msteps-row-meta">{meta}</span>}
    </button>
  )
}

/** A model to open, with its storage and when it last changed. */
export function ModelRow({ doc, onOpen, autoFocus }: {
  doc: DocumentMeta
  onOpen: () => void
  autoFocus?: boolean
}): React.ReactElement {
  return (
    <StepRow
      icon={<SourceIcon source={doc.source} />}
      name={doc.name}
      meta={shortDate(doc.lastModified)}
      onClick={() => void openDocument(doc.id).then(onOpen)}
      autoFocus={autoFocus}
      title={`Last edited ${new Date(doc.lastModified).toLocaleString()}`}
    />
  )
}

// ─── New model ───────────────────────────────────────────────────────────────

/** Metamodel and storage for a new model, then Create (or Radical Forge once
 *  AI is set up). `onDone` runs once the model is open. */
export function NewModelStep({ onDone }: { onDone: () => void }): React.ReactElement {
  const presets = availableMetamodels()
  const [presetId, setPresetId] = useState('c4-ddd-governance-builtin')
  const preset = presets.find(p => p.id === presetId) ?? presets[0]
  const [storage, setStorage] = useState<Storage>(loadStorageChoice)
  // Forge needs a model to talk to, so it shows only once AI is set up
  // (logo menu → AI providers…).
  const [forgeAvailable] = useState(() => aiReady(loadAISettings()))

  function chooseStorage(next: Storage): void {
    setStorage(next)
    saveStorageChoice(next)
  }

  /** An empty model where the user chose to keep it. False when the pick was
   *  cancelled or the model could not be stored. */
  async function createBlank(): Promise<boolean> {
    const data: DiagramData = { nodes: [], relations: [], metamodel: preset.build() }
    try {
      if (storage === 'folder') return !!(await documents.createFolderDocument(data, confirmForeignFolder))
      if (storage === 'file') return !!(await documents.createFileDocument(data, 'Untitled model'))
    } catch (e) {
      window.alert((e as Error).message)
      return false
    }
    return !!createInBrowser('Untitled model', data)
  }

  async function handleCreate(withForge: boolean): Promise<void> {
    if (!(await createBlank())) return
    onDone()
    // Toolbar.tsx listens (same pattern as radical:open-ai-settings).
    if (withForge) window.dispatchEvent(new CustomEvent('radical:open-forge'))
  }

  return (
    <>
      <label className="msteps-field">
        <span className="msteps-label">Metamodel</span>
        <select
          className="msteps-select"
          value={preset.id}
          onChange={e => setPresetId(e.target.value)}
          title={preset.description}
        >
          {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>

      {STORAGE_OPTIONS.length > 1 && (
        <div className="msteps-options" role="radiogroup" aria-label="Storage">
          <p className="msteps-label">Storage</p>
          {STORAGE_OPTIONS.map(o => (
            <label key={o.id} className={`msteps-option${storage === o.id ? ' selected' : ''}`}>
              <input
                type="radio"
                name="msteps-storage"
                checked={storage === o.id}
                onChange={() => chooseStorage(o.id)}
              />
              <span className="msteps-option-name">{o.name}</span>
              <span className="msteps-option-desc">{o.description}</span>
            </label>
          ))}
        </div>
      )}

      <div className="msteps-actions">
        <button className="msteps-btn msteps-btn-primary" onClick={() => void handleCreate(false)} autoFocus>
          {storage === 'folder' ? 'Choose folder and create'
            : storage === 'file' ? 'Choose file and create'
            : 'Create model'}
        </button>
        {forgeAvailable && (
          <button
            className="msteps-btn msteps-btn-forge"
            onClick={() => void handleCreate(true)}
            title="Describe a system in plain language and let AI generate requirements, a domain model, fitness functions, Gherkin scenarios, state machines, UI mockups and a C4 model for it"
          >
            <SparkleIcon />
            Create with Radical Forge
          </button>
        )}
      </div>
    </>
  )
}

// ─── Open ────────────────────────────────────────────────────────────────────

/** The sample's System Context view (fintechSampleData.json). */
const SAMPLE_START_VIEW = 'view-ctx'

/** Opens a copy of the Fintech sample on its System Context view rather than
 *  the default canvas, which holds all 65 elements at once and reads as noise
 *  on a first look. `onDone` runs once it is open. With `setRoute`, the view
 *  goes into the URL, for a route sync that has not started yet. */
export function openSample(onDone: () => void, setRoute?: boolean): void {
  // Views of the doc open right now; the sample's arrive as a new object.
  // (The open doc may be an earlier sample copy with the same view ids.)
  const viewsBefore = useDiagramStore.getState().views
  const meta = createInBrowser('Fintech Banking Platform', buildFintechSampleRaw())
  if (!meta) return
  documents.setActiveId(meta.id)
  const loaded = (views: typeof viewsBefore): boolean =>
    views !== viewsBefore && !!views[SAMPLE_START_VIEW]

  // The doc loads asynchronously, so wait for the view to exist.
  let done = false
  const finish = (): void => {
    if (done) return
    done = true
    unsub()
    clearTimeout(timer)
    if (loaded(useDiagramStore.getState().views)) {
      if (setRoute) history.replaceState(null, '', formatRoute({ mode: 'designer', view: SAMPLE_START_VIEW }))
      else useDiagramStore.getState().setActiveView(SAMPLE_START_VIEW)
    }
    onDone()
  }
  const unsub = useDiagramStore.subscribe((s) => { if (loaded(s.views)) finish() })
  const timer = setTimeout(finish, 1500)
}

/** Places to open a model from: a file, a folder, a Structurizr DSL file or
 *  the sample. `before` goes first (the welcome screen's browser models).
 *  `onDone` runs once a model is open. With `setRoute`, the sample's start
 *  view also goes into the URL, for a route sync that has not started yet. */
export function OpenSources({ onDone, before, setRoute, autoFocus }: {
  onDone: () => void
  before?: React.ReactNode
  setRoute?: boolean
  autoFocus?: boolean
}): React.ReactElement {
  function handleFile(): void {
    documents.importFromFile().then((meta) => {
      if (meta) onDone()
    }, (e: Error) => window.alert(e.message))
  }

  // An empty folder opens as an empty model, so this is also how to start a
  // model that the MCP server or Claude Code will work on.
  function handleFolder(): void {
    documents.importFromFolder().then((meta) => {
      if (meta) onDone()
    }, (e: Error) => window.alert(e.message))
  }

  function handleDsl(): void {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.dsl,.txt'
    input.style.display = 'none'
    document.body.appendChild(input)
    input.onchange = (): void => {
      const file = input.files?.[0]
      document.body.removeChild(input)
      if (!file) return
      const reader = new FileReader()
      reader.onload = (e): void => {
        const content = e.target?.result as string
        if (!content) return
        try {
          const result = parseStructurizrDsl(content)
          const name = result.name || file.name.replace(/\.(dsl|txt)$/i, '') || 'Imported DSL'
          documents.createLSDocument(name, { nodes: result.nodes, relations: result.relations } as DiagramData)
          onDone()
        } catch (err) {
          if (err instanceof StorageFullError) {
            window.alert(err.message)
            return
          }
          console.warn('[DSL import] failed:', err)
          window.alert('Could not parse the DSL file. See the browser console for details.')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  return (
    <div className="msteps-rows">
      {before}
      <StepRow icon={<FileIcon />} name="File…" onClick={handleFile} autoFocus={autoFocus} />
      {folderSupported && (
        <StepRow
          icon={<FolderIcon />}
          name="Folder…"
          onClick={handleFolder}
          title="Open a Radical Markdown model folder, or an empty folder to start one"
        />
      )}
      <StepRow icon={<DslIcon />} name="Structurizr DSL…" onClick={handleDsl} title="Import a Structurizr DSL workspace into a new model in this browser" />
      {/* The fastest way to see what the tool does: no AI key, no blank canvas. */}
      <StepRow icon={<SparkleIcon />} name="Sample model" meta="Fintech Banking Platform" onClick={() => openSample(onDone, setRoute)} />
    </div>
  )
}
