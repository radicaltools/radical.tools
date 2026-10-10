import React, { useState } from 'react'
import { documents, type DocumentMeta } from '../store/documentStore'
import { buildFintechSampleRaw } from '../store/fintechSample'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { formatRoute } from '../route'
import { availableMetamodels } from '@radical/common/metamodel'
import type { DiagramData } from '@radical/common/c4'
import { host } from '../platform/host'
import { webFolderSupported } from '../persist/webFolder'
import { aiReady, loadAISettings } from '../ai/settings'
import { confirmForeignFolder } from './confirmForeignFolder'

/** Markdown folders open in Electron and in Chromium browsers (File System
 *  Access API), as in the Document Manager. */
const folderSupported = !!host().openFolder || webFolderSupported()

/** Where "New model" keeps the model: browser storage, or a Markdown folder
 *  the user picks. The last choice is remembered per browser. */
type Storage = 'browser' | 'folder'
const STORAGE_KEY = 'radical-new-model-storage'

const STORAGE_OPTIONS: { id: Storage; name: string; description: string }[] = [
  {
    id: 'browser',
    name: 'In this browser',
    description: 'Kept in this browser\'s storage. Nothing to pick; export a file to share it.',
  },
  {
    id: 'folder',
    name: 'In a folder',
    description: 'Markdown files in a folder you pick, ready for git, Claude Code and the MCP server.',
  },
]

function loadStorageChoice(): Storage {
  if (!folderSupported) return 'browser'
  try {
    return localStorage.getItem(STORAGE_KEY) === 'folder' ? 'folder' : 'browser'
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

/** The sample's System Context view (fintechSampleData.json). */
const SAMPLE_START_VIEW = 'view-ctx'

interface Props {
  onDismiss: () => void
}

/** Stylised slice of the fintech sample: the C4 core with the ADR,
 *  requirement and mockup layers hanging off it. Labels are real nodes. */
function SamplePreview(): React.ReactElement {
  const font = 'system-ui, sans-serif'
  return (
    <svg className="welcome-sample-preview" width="100%" viewBox="0 0 280 150" fill="none" aria-hidden="true">
      <defs>
        <marker id="welcome-arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#9aa3b8"/>
        </marker>
      </defs>

      {/* governance / product links (dashed) */}
      <g stroke="#b8bfd0" strokeWidth="1" strokeDasharray="3 2">
        <path d="M45 96 C45 70 120 70 128 52"/>
        <path d="M139 96 L139 52"/>
        <path d="M232 78 C232 64 170 66 158 52"/>
      </g>

      {/* architecture links */}
      <g stroke="#9aa3b8" strokeWidth="1">
        <line x1="66" y1="30" x2="98" y2="30" markerEnd="url(#welcome-arr)"/>
        <line x1="190" y1="30" x2="212" y2="30" markerEnd="url(#welcome-arr)"/>
      </g>

      {/* Retail Customer */}
      <rect x="6" y="14" width="60" height="32" rx="4" fill="#0b3d6e"/>
      <circle cx="36" cy="9" r="4" fill="#0b3d6e"/>
      <text x="36" y="28" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="600" fontFamily={font}>Retail</text>
      <text x="36" y="37" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="600" fontFamily={font}>Customer</text>

      {/* Core Banking Platform */}
      <rect x="100" y="8" width="90" height="44" rx="4" fill="#1565c0"/>
      <text x="106" y="19" fill="#cfe0f7" fontSize="5" fontWeight="600" letterSpacing="0.4" fontFamily={font}>SOFTWARE SYSTEM</text>
      <text x="106" y="31" fill="#fff" fontSize="7.5" fontWeight="700" fontFamily={font}>Core Banking</text>
      <text x="106" y="41" fill="#fff" fontSize="7.5" fontWeight="700" fontFamily={font}>Platform</text>

      {/* SWIFT Network (external) */}
      <rect x="214" y="12" width="60" height="36" rx="4" fill="#6b7280"/>
      <text x="219" y="22" fill="#e5e7eb" fontSize="5" fontWeight="600" letterSpacing="0.4" fontFamily={font}>EXTERNAL</text>
      <text x="219" y="34" fill="#fff" fontSize="7.5" fontWeight="700" fontFamily={font}>SWIFT</text>

      {/* ADR */}
      <rect x="6" y="98" width="78" height="26" rx="4" fill="#fdf3ea" stroke="#b4581a"/>
      <text x="12" y="108" fill="#b4581a" fontSize="5" fontWeight="700" letterSpacing="0.4" fontFamily={font}>ADR-001</text>
      <text x="12" y="118" fill="#5c2e0e" fontSize="6.5" fontWeight="600" fontFamily={font}>Event-Driven Core</text>

      {/* Requirement */}
      <rect x="96" y="98" width="86" height="26" rx="4" fill="#e8f6f6" stroke="#0f766e"/>
      <text x="102" y="108" fill="#0f766e" fontSize="5" fontWeight="700" letterSpacing="0.4" fontFamily={font}>REQUIREMENT</text>
      <text x="102" y="118" fill="#134e4a" fontSize="6.5" fontWeight="600" fontFamily={font}>Strong customer auth</text>

      {/* Mockup with a wireframe */}
      <rect x="196" y="80" width="78" height="64" rx="4" fill="#fff" stroke="#b3134f"/>
      <path d="M196 84a4 4 0 0 1 4-4h70a4 4 0 0 1 4 4v6h-78z" fill="#b3134f"/>
      <text x="201" y="88" fill="#fff" fontSize="5" fontWeight="700" letterSpacing="0.3" fontFamily={font}>New Transfer</text>
      <g fill="#e5e7eb">
        <rect x="202" y="96" width="40" height="4" rx="1"/>
        <rect x="202" y="104" width="66" height="7" rx="1.5"/>
        <rect x="202" y="114" width="66" height="7" rx="1.5"/>
      </g>
      <rect x="202" y="127" width="30" height="9" rx="2" fill="#3b6fe6"/>
    </svg>
  )
}

export function WelcomeScreen({ onDismiss }: Props): React.ReactElement {
  // The doc auto-seeded on a first visit is not the user's work: leave it out
  // so newcomers get the first-visit layout with the sample front and centre.
  const existingDocs = documents.listDocuments().filter(d => !documents.isBootSeeded(d.id))
  const hasExisting  = existingDocs.length > 0
  // AI settings live behind the logo menu, which this overlay covers, so
  // reading them once is enough.
  const [forgeAvailable] = useState(() => aiReady(loadAISettings()))
  const presets = availableMetamodels()
  const [openPicker, setOpenPicker] = useState<'metamodel' | 'storage' | null>(null)
  const [selectedPresetId, setSelectedPresetId] = useState('c4-ddd-governance-builtin')
  const selectedPreset = presets.find(p => p.id === selectedPresetId) ?? presets[0]
  const [storage, setStorage] = useState<Storage>(loadStorageChoice)
  const selectedStorage = STORAGE_OPTIONS.find(o => o.id === storage) ?? STORAGE_OPTIONS[0]

  function chooseStorage(next: Storage): void {
    setStorage(next)
    saveStorageChoice(next)
    setOpenPicker(null)
  }

  /** Adds the model and opens it; says why when browser storage refused it. */
  function create(name: string, data: DiagramData): DocumentMeta | null {
    try {
      return documents.createLSDocument(name, data)
    } catch (e) {
      window.alert((e as Error).message)
      return null
    }
  }

  /** An empty model where the user chose to keep it. False when the folder
   *  pick was cancelled or the model could not be stored. */
  async function createBlank(): Promise<boolean> {
    const data: DiagramData = { nodes: [], relations: [], metamodel: selectedPreset.build() }
    if (storage === 'folder') return !!(await documents.createFolderDocument(data, confirmForeignFolder))
    return !!create('Untitled model', data)
  }

  async function handleNew(): Promise<void> {
    if (!(await createBlank())) return
    setOpenPicker(null)
    onDismiss()
  }

  // "Start with Radical Forge" — opens straight into a blank model with the
  // wizard already up, so a user can go from nothing to a described system
  // without first clicking "New model" then hunting for Forge in the app
  // menu. Toolbar.tsx (already mounted underneath this overlay) listens for
  // the event — same pattern as radical:open-ai-settings.
  async function handleForge(): Promise<void> {
    if (!(await createBlank())) return
    setOpenPicker(null)
    onDismiss()
    window.dispatchEvent(new CustomEvent('radical:open-forge'))
  }

  function handleOpen(id: string): void {
    documents.setActiveId(id)
    onDismiss()
  }

  function handleImport(): void {
    documents.importFromFile().then((meta) => {
      if (meta) onDismiss()
    }, (e: Error) => window.alert(e.message))
  }

  // An empty folder opens as an empty model, so this is also how to start a
  // model that the MCP server or Claude Code will work on.
  function handleOpenFolder(): void {
    documents.importFromFolder().then((meta) => {
      if (meta) onDismiss()
    }, (e: Error) => window.alert(e.message))
  }

  // Land on System Context rather than the default canvas, which holds all
  // 65 elements at once and reads as noise on a first look. The doc loads
  // asynchronously, so wait for the view to exist, then hand it to route
  // sync (App starts it once the splash is dismissed) through the hash.
  function handleSample(): void {
    // Views of the doc open right now; the sample's arrive as a new object.
    // (The open doc may be an earlier sample copy with the same view ids.)
    const viewsBefore = useDiagramStore.getState().views
    const data = buildFintechSampleRaw()
    const meta = create('Fintech Banking Platform', data)
    if (!meta) return
    documents.setActiveId(meta.id)
    const loaded = (views: typeof viewsBefore): boolean =>
      views !== viewsBefore && !!views[SAMPLE_START_VIEW]

    let done = false
    const finish = (): void => {
      if (done) return
      done = true
      unsub()
      clearTimeout(timer)
      if (loaded(useDiagramStore.getState().views)) {
        history.replaceState(null, '', formatRoute({ mode: 'designer', view: SAMPLE_START_VIEW }))
      }
      onDismiss()
    }
    const unsub = useDiagramStore.subscribe((s) => { if (loaded(s.views)) finish() })
    const timer = setTimeout(finish, 1500)
  }

  return (
    <div className="welcome-overlay">
      <div className="welcome-card">

        {/* ── Left column: start something ── */}
        <div className="welcome-left">
          <div className="welcome-wordmark">
            <svg className="welcome-wordmark-icon" width="28" height="28" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="4.5" fill="#3b6fe6"/>
                <circle cx="14" cy="14" r="12" stroke="#3b6fe6" strokeWidth="1.5" fill="none" strokeDasharray="3 2"/>
                <circle cx="14" cy="2"  r="2" fill="#3b6fe6" opacity="0.45"/>
                <circle cx="14" cy="26" r="2" fill="#3b6fe6" opacity="0.45"/>
                <circle cx="2"  cy="14" r="2" fill="#3b6fe6" opacity="0.45"/>
                <circle cx="26" cy="14" r="2" fill="#3b6fe6" opacity="0.45"/>
            </svg>
            <span className="welcome-wordmark-text">studio <span className="welcome-wordmark-by">by radical<em>.tools</em></span></span>
          </div>
          {/* Newcomers get one line on what this is; returning users know. */}
          {!hasExisting && (
            <p className="welcome-lead">
              Model software architecture with C4 views, and keep the
              decisions, requirements and screens behind it in one place.
            </p>
          )}

          <div className="welcome-cta-group">
            {/* Forge needs a model to talk to, so it shows only once AI is
                set up (logo menu → AI providers…). */}
            {forgeAvailable && (
              <button
                className="welcome-btn welcome-btn-forge"
                onClick={() => void handleForge()}
                title="Describe a system in plain language and let AI generate requirements, a domain model, fitness functions, Gherkin scenarios, state machines, UI mockups and a C4 model for it"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                  <path d="M4.5 1.5l.9 2.1L7.5 4.5l-2.1.9-.9 2.1-.9-2.1L1.5 4.5l2.1-.9z"/>
                  <path d="M10.5 6.5l.65 1.35L12.5 8.5l-1.35.65-.65 1.35-.65-1.35L8.5 8.5l1.35-.65z"/>
                </svg>
                Start with Radical Forge
              </button>
            )}
            <button className="welcome-btn welcome-btn-primary" onClick={() => void handleNew()}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <line x1="7" y1="1" x2="7" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                <line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              New model
            </button>
            {/* What the new model is built on and where it is kept: the
                defaults suit most people, so they read as captions. */}
            <div className="welcome-new-options">
              <button
                type="button"
                className="welcome-mm-toggle"
                onClick={() => setOpenPicker(o => o === 'metamodel' ? null : 'metamodel')}
                aria-expanded={openPicker === 'metamodel'}
                title="Metamodel for new models"
              >
                {selectedPreset.name}
                <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><path d="M5 7L1 3h8z"/></svg>
              </button>
              {folderSupported && (
                <>
                  <span className="welcome-new-options-sep" aria-hidden="true">·</span>
                  <button
                    type="button"
                    className="welcome-mm-toggle"
                    onClick={() => setOpenPicker(o => o === 'storage' ? null : 'storage')}
                    aria-expanded={openPicker === 'storage'}
                    title="Where new models are kept"
                  >
                    {selectedStorage.name}
                    <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><path d="M5 7L1 3h8z"/></svg>
                  </button>
                </>
              )}
            </div>
            {openPicker === 'metamodel' && (
              <div className="welcome-mm-picker">
                {presets.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    className={`welcome-mm-option${selectedPreset.id === p.id ? ' selected' : ''}`}
                    onClick={() => { setSelectedPresetId(p.id); setOpenPicker(null) }}
                  >
                    <div className="welcome-mm-option-name">
                      {p.name}
                      {selectedPreset.id === p.id && <span className="welcome-mm-option-check">✓</span>}
                    </div>
                    <div className="welcome-mm-option-desc">{p.description}</div>
                  </button>
                ))}
              </div>
            )}
            {openPicker === 'storage' && (
              <div className="welcome-mm-picker">
                {STORAGE_OPTIONS.map(o => (
                  <button
                    key={o.id}
                    type="button"
                    className={`welcome-mm-option${storage === o.id ? ' selected' : ''}`}
                    onClick={() => chooseStorage(o.id)}
                  >
                    <div className="welcome-mm-option-name">
                      {o.name}
                      {storage === o.id && <span className="welcome-mm-option-check">✓</span>}
                    </div>
                    <div className="welcome-mm-option-desc">{o.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Opening what already exists is the quiet path. */}
          <div className="welcome-links">
            <button type="button" className="welcome-link" onClick={handleImport}>Open file…</button>
            {folderSupported && (
              <button
                type="button"
                className="welcome-link"
                onClick={handleOpenFolder}
                title="Open a Radical Markdown model folder, or an empty folder to start one"
              >
                Open folder…
              </button>
            )}
            {hasExisting && (
              <button type="button" className="welcome-link" onClick={handleSample}>Sample model</button>
            )}
          </div>
        </div>

        {/* ── Right column: carry on, or look around ── */}
        <div className="welcome-right">
          {hasExisting ? (
            <>
              <p className="welcome-right-label">Recent</p>
              <div className="welcome-recent">
                {existingDocs.slice(0, 6).map((doc, i) => (
                  <button
                    key={doc.id}
                    className={`welcome-recent-item${i === 0 ? ' welcome-recent-item-last' : ''}`}
                    onClick={() => handleOpen(doc.id)}
                    // The last model is one Enter away.
                    autoFocus={i === 0}
                    title={`Last edited ${new Date(doc.lastModified).toLocaleString()}`}
                  >
                    <span className="welcome-recent-icon">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <rect x="1.5" y="0.5" width="9" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                        <line x1="4" y1="4.5" x2="8" y2="4.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                        <line x1="4" y1="7"   x2="8" y2="7"   stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                        <line x1="4" y1="9.5" x2="6" y2="9.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                      </svg>
                    </span>
                    <span className="welcome-recent-name">{doc.name}</span>
                    <span className="welcome-recent-date">
                      {new Date(doc.lastModified).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            // First visit: the sample is the fastest way to see what the
            // tool does (no AI key, no blank canvas), so it gets the whole
            // column.
            <>
              <p className="welcome-right-label">Explore a sample</p>
              <button type="button" className="welcome-sample-card" onClick={handleSample}>
                <SamplePreview />
                <span className="welcome-sample-title">Fintech Banking Platform</span>
                <span className="welcome-sample-desc">
                  A complete model to click through, from C4 views down to
                  the decisions, requirements and screens behind them.
                </span>
                <span className="welcome-sample-cta">
                  Explore the sample
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M2 6h8M6.5 2.5L10 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  )
}
