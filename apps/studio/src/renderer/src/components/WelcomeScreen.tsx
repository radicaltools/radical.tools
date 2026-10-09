import React, { useState } from 'react'
import { documents } from '../store/documentStore'
import { buildFintechSampleRaw } from '../store/fintechSample'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { formatRoute } from '../route'
import { availableMetamodels } from '@radical/common/metamodel'
import { host } from '../platform/host'
import { webFolderSupported } from '../persist/webFolder'

/** Markdown folders open in Electron and in Chromium browsers (File System
 *  Access API), as in the Document Manager. */
const folderSupported = !!host().openFolder || webFolderSupported()

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
  const lastDoc      = hasExisting ? existingDocs[0] : null
  const presets = availableMetamodels()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedPresetId, setSelectedPresetId] = useState('c4-ddd-governance-builtin')

  function handleNew(): void {
    const preset = presets.find(p => p.id === selectedPresetId) ?? presets[0]
    documents.createLSDocument('Untitled model', {
      nodes: [],
      relations: [],
      metamodel: preset.build(),
    })
    setPickerOpen(false)
    onDismiss()
  }

  // "Start with Radical Forge" — opens straight into a blank model with the
  // wizard already up, so a user can go from nothing to a described system
  // without first clicking "New model" then hunting for Forge in the app
  // menu. Toolbar.tsx (already mounted underneath this overlay) listens for
  // the event — same pattern as radical:open-ai-settings.
  function handleForge(): void {
    const preset = presets.find(p => p.id === selectedPresetId) ?? presets[0]
    documents.createLSDocument('Untitled model', {
      nodes: [],
      relations: [],
      metamodel: preset.build(),
    })
    setPickerOpen(false)
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
    })
  }

  // An empty folder opens as an empty model, so this is also how to start a
  // model that the MCP server or Claude Code will work on.
  function handleOpenFolder(): void {
    documents.importFromFolder().then((meta) => {
      if (meta) onDismiss()
    })
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
    const meta = documents.createLSDocument('Fintech Banking Platform', data)
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

        {/* ── Left column ── */}
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
            <span className="welcome-wordmark-text">radical<em>.tools</em></span>
          </div>

          <h1 className="welcome-heading">
            {hasExisting ? <>Your recent<br/>models</> : <>Architecture<br/>modelling</>}
          </h1>
          <p className="welcome-lead">
            {hasExisting
              ? 'Continue where you stopped, or start something new.'
              : 'C4-based visual modelling for software architecture teams.'}
          </p>

          <div className="welcome-cta-group">
            {lastDoc && (
              <button
                className="welcome-btn welcome-btn-primary"
                onClick={() => handleOpen(lastDoc.id)}
                title={`Last edited ${new Date(lastDoc.lastModified).toLocaleString()}`}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1.5a5.5 5.5 0 1 1-3.89 9.39" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
                  <polyline points="3.5,7.5 1.5,11 5,11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  <line x1="7" y1="4" x2="7" y2="7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  <line x1="7" y1="7.5" x2="9.5" y2="9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
                Open last — {lastDoc.name}
              </button>
            )}
            <button
              className="welcome-btn welcome-btn-forge"
              onClick={handleForge}
              title="Describe a system in plain language and let AI generate requirements, fitness functions, Gherkin scenarios, UI mockups and a C4 model for it"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <path d="M4.5 1.5l.9 2.1L7.5 4.5l-2.1.9-.9 2.1-.9-2.1L1.5 4.5l2.1-.9z"/>
                <path d="M10.5 6.5l.65 1.35L12.5 8.5l-1.35.65-.65 1.35-.65-1.35L8.5 8.5l1.35-.65z"/>
              </svg>
              Start with Radical Forge
            </button>
            <div className="welcome-btn-group">
            <button
              className="welcome-btn welcome-btn-ghost"
              onClick={handleNew}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <line x1="7" y1="1" x2="7" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                <line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              New model
            </button>
            <button
              type="button"
              className="welcome-btn welcome-btn-ghost welcome-btn-mm"
              onClick={() => setPickerOpen(o => !o)}
              title="Change metamodel"
            >
              <svg width="11" height="11" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><path d="M5 7L1 3h8z"/></svg>
            </button>
            </div>
            {pickerOpen && (
              <div className="welcome-mm-picker">
                <div className="welcome-mm-picker-title">Metamodel for new model</div>
                {presets.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    className={`welcome-mm-option${selectedPresetId === p.id ? ' selected' : ''}`}
                    onClick={() => { setSelectedPresetId(p.id); setPickerOpen(false) }}
                  >
                    <div className="welcome-mm-option-name">
                      {p.name}
                      {selectedPresetId === p.id && <span className="welcome-mm-option-check">✓</span>}
                    </div>
                    <div className="welcome-mm-option-desc">{p.description}</div>
                  </button>
                ))}
              </div>
            )}
            <button className="welcome-btn welcome-btn-ghost" onClick={handleImport}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1.5" y="1.5" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                <line x1="4" y1="7" x2="10" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <polyline points="7,4 10,7 7,10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Open file…
            </button>
            {folderSupported && (
              <button
                className="welcome-btn welcome-btn-ghost"
                onClick={handleOpenFolder}
                title="Open a Radical Markdown model folder, or an empty folder to start one"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1.5 3.5a1 1 0 0 1 1-1h3l1.5 1.5h4.5a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                </svg>
                Open folder…
              </button>
            )}
          </div>

          {hasExisting && (
            <div className="welcome-sample-link">
              <button type="button" className="welcome-link" onClick={handleSample}>
                or open a sample model
              </button>
            </div>
          )}
        </div>

        {/* ── Right column ── */}
        <div className="welcome-right">
          {hasExisting ? (
            <>
              <p className="welcome-right-label">Recent</p>
              <div className="welcome-recent">
                {existingDocs.slice(0, 6).map((doc) => (
                  <button
                    key={doc.id}
                    className="welcome-recent-item"
                    onClick={() => handleOpen(doc.id)}
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
            // column. Counts mirror fintechSampleData.json.
            <>
              <p className="welcome-right-label">Explore a sample</p>
              <button type="button" className="welcome-sample-card" onClick={handleSample}>
                <SamplePreview />
                <span className="welcome-sample-title">Fintech Banking Platform</span>
                <span className="welcome-sample-desc">
                  A complete model to click through, from C4 views down to
                  the decisions, requirements and screens behind them.
                </span>
                <span className="welcome-sample-tags">
                  {['C4 views', 'ADRs', 'Requirements', 'UI mockups', 'Wiki', 'Slides'].map(t => (
                    <span key={t} className="welcome-sample-tag">{t}</span>
                  ))}
                </span>
                <span className="welcome-sample-stats">65 elements · 15 views · 12 slides</span>
                <span className="welcome-btn welcome-btn-primary welcome-sample-cta">
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
