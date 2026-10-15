import React, { useCallback, useState, useEffect, useRef } from 'react'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { host } from '../platform/host'
import { useDocumentsStore, type DocumentSource } from '../store/documentStore'
import { useInspectorStore } from '../persistence/inspector'
import { dropPendingMode, useShownMode } from '../route'
import { DocumentManagerModal } from './DocumentManager'
import { AISettingsModal } from './AISettingsModal'
import { HubImportModal } from './HubImportModal'
import { RadicalForgeModal } from './RadicalForgeModal'
import { AgentForgeModal } from './AgentForgeModal'
import { useOutsideClick } from '@radical/ui/hooks/useOutsideClick'
import { useExport } from '../hooks/useExport'
import {
  loadStudioSettings,
  saveStudioSettings,
  STUDIO_SETTINGS_CHANGED_EVENT,
  WIKI_MULTI_PAGE_DEPTH_MIN,
  WIKI_MULTI_PAGE_DEPTH_MAX,
  type StudioSettings,
} from '@radical/ui/studioSettings'

// ── SVG icons ────────────────────────────────────────────────────────────────

const IconELK = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M8 2v12M2 8h12" />
    <circle cx="8" cy="8" r="3" />
  </svg>
)

const IconCola = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <circle cx="4" cy="4" r="2" />
    <circle cx="12" cy="4" r="2" />
    <circle cx="4" cy="12" r="2" />
    <circle cx="12" cy="12" r="2" />
    <path d="M6 4h4M4 6v4M12 6v4M6 12h4" />
  </svg>
)

const IconRadical = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M8 1v14M1 8h14" />
    <path d="M3 3l10 10M13 3L3 13" />
    <circle cx="8" cy="8" r="2" fill="currentColor" />
  </svg>
)

const IconHola = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <rect x="2" y="2" width="5" height="5" rx="1" />
    <rect x="9" y="2" width="5" height="5" rx="1" />
    <rect x="5.5" y="9" width="5" height="5" rx="1" />
    <path d="M4.5 7v2.5H6M11.5 7v2.5H10" />
  </svg>
)

const IconSave = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <rect x="2" y="2" width="12" height="12" rx="2" />
    <path d="M5 2v4h6V2M5 10h6" />
  </svg>
)

const IconNew = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <rect x="3" y="1" width="10" height="14" rx="1.5" />
    <path d="M6 8h4M8 6v4" />
  </svg>
)

const IconLoad = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M3 12V4a1 1 0 011-1h3l2 2h3a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1z" />
    <path d="M8 7v5M6 10l2 2 2-2" />
  </svg>
)

const IconReset = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M3 8a5 5 0 105-5H6M6 1L3 4l3 3" />
  </svg>
)




// Sparkle / wand icon — indicates the "smart" auto-arrange action.
const IconSearch = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5L14 14" strokeLinecap="round" />
  </svg>
)

const IconReference = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <rect x="1" y="1" width="14" height="14" rx="2" />
    <path d="M1 6h14M6 6v9M10 6v9" />
    <circle cx="3.5" cy="3.5" r="1" fill="currentColor" />
  </svg>
)

const IconSun = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <circle cx="8" cy="8" r="3" />
    <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" />
  </svg>
)

const IconMoon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M13.5 8.5a5.5 5.5 0 01-7-7 5.5 5.5 0 107 7z" />
  </svg>
)

const IconSmartFit = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M2 5V2h3M11 2h3v3M14 11v3h-3M5 14H2v-3" />
    <path d="M8 6l1 2 2 .4-1.5 1.4.4 2L8 10.8 6.1 11.8l.4-2L5 8.4 7 8z" fill="currentColor" stroke="none" />
  </svg>
)

const IconUndo = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M3 7h7a3 3 0 110 6H8" />
    <path d="M6 4L3 7l3 3" />
  </svg>
)

const IconRedo = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M13 7H6a3 3 0 100 6h2" />
    <path d="M10 4l3 3-3 3" />
  </svg>
)

const IconSnapshot = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <rect x="2" y="3" width="12" height="10" rx="1.5" />
    <circle cx="8" cy="8" r="2.5" />
    <circle cx="11" cy="5.5" r="0.8" fill="currentColor" />
  </svg>
)

const IconModelling = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <rect x="2" y="2" width="5" height="5" rx="1" />
    <rect x="9" y="9" width="5" height="5" rx="1" />
    <rect x="2" y="9" width="5" height="5" rx="1" />
    <path d="M9 4.5h2a1 1 0 011 1v2.5" strokeLinecap="round" />
  </svg>
)

const IconPresentation = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <rect x="1" y="2" width="14" height="10" rx="1.5" />
    <path d="M5 14h6M8 12v2" strokeLinecap="round" />
    <path d="M6 6.5L10 8.5 6 10.5V6.5z" fill="currentColor" stroke="none" />
  </svg>
)

const IconView = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" strokeLinejoin="round" />
    <circle cx="8" cy="8" r="2" />
  </svg>
)

const IconMetamodel = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4}>
    <rect x="1.5" y="2" width="5" height="4" rx="0.6" />
    <rect x="9.5" y="2" width="5" height="4" rx="0.6" />
    <rect x="5.5" y="10" width="5" height="4" rx="0.6" />
    <path d="M4 6v2h8V6M8 8v2" strokeLinecap="round" />
  </svg>
)

const IconAI = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 2.5l.7 1.6L7.3 4.8l-1.6.7L5 7.1l-.7-1.6L2.7 4.8l1.6-.7z" fill="currentColor" stroke="none" />
    <path d="M11.5 7l.6 1.4 1.4.6-1.4.6L11.5 11l-.6-1.4L9.5 9l1.4-.6z" fill="currentColor" stroke="none" />
    <path d="M8 9.5L8.6 11l1.4.5-1.4.5L8 13.5l-.6-1.5L6 11.5l1.4-.5z" fill="currentColor" stroke="none" />
  </svg>
)

const IconHub = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="5" height="5" rx="1" />
    <rect x="9" y="2" width="5" height="5" rx="1" />
    <rect x="2" y="9" width="5" height="5" rx="1" />
    <path d="M11.5 10v4M9.5 12h4" />
  </svg>
)

const IconExportPNG = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round">
    <rect x="1" y="3" width="14" height="10" rx="1.5" />
    <path d="M3.5 9.5V6.5h1c.6 0 1 .4 1 1s-.4 1-1 1H3.5" />
    <path d="M7.5 9.5V6.5l1.5 2 1.5-2v3" />
    <path d="M12.5 6.5H11v3h1.5" />
    <path d="M11 8h1.2" />
  </svg>
)

const IconExportSVG = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round">
    <rect x="1" y="3" width="14" height="10" rx="1.5" />
    <path d="M4.5 9.5c-.5 0-1-.3-1-1s.5-1 1-1h1c.5 0 1-.3 1-1s-.5-1-1-1" />
    <path d="M9 6.5l1 3 1-3" />
    <path d="M13 6.5h-1.5c-.3 0-.5.2-.5.5v.5c0 .3.2.5.5.5h1c.3 0 .5.2.5.5v.5c0 .3-.2.5-.5.5H11" />
  </svg>
)

const IconClipboard = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="1" width="6" height="3" rx="1" />
    <path d="M5 2H3a1 1 0 00-1 1v11a1 1 0 001 1h10a1 1 0 001-1V3a1 1 0 00-1-1h-2" />
    <path d="M5 8h6M5 11h4" />
  </svg>
)

// ── App menu (hamburger popover) ─────────────────────────────────────────────

type ConnectionMod = 'alt' | 'shift' | 'ctrl' | 'meta'

function AppMenu({
  onManage, activeDocLabel, activeDocSource,
  connectionModifier, setConnectionModifier,
  theme, onToggleTheme,
  smartFitActive, onToggleSmartFit,
  metamodelActive, onToggleMetamodel,
  onOpenAISettings,
  onOpenHub,
  onOpenForge,
  onExportPNG,
  onExportSVG,
  onCopyToClipboard,
  exportBusy,
}: {
  onManage: () => void
  activeDocLabel: string | null
  activeDocSource: DocumentSource | null
  connectionModifier: ConnectionMod
  setConnectionModifier: (m: ConnectionMod) => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  smartFitActive: boolean
  onToggleSmartFit: () => void
  metamodelActive: boolean
  onToggleMetamodel: () => void
  onOpenAISettings: () => void
  onOpenHub: () => void
  onOpenForge: () => void
  onExportPNG: () => void
  onExportSVG: () => void
  onCopyToClipboard: () => void
  exportBusy: boolean
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const isMac = typeof navigator !== 'undefined' && navigator.platform?.includes('Mac')
  // How the model's canvases draw relations (All elements, and the views
  // that do not choose their own in their properties).
  const defaultEdgeStyle = useDiagramStore((s) => s.defaultEdgeStyle)
  const setDefaultEdgeStyle = useDiagramStore((s) => s.setDefaultEdgeStyle)
  const editable = useDiagramStore((s) => s.appMode === 'designer')

  // Studio-wide preferences (localStorage, not part of the .radical file) —
  // self-contained here the same way AI settings are self-contained in
  // AISettingsModal: load once, persist + broadcast on change so any other
  // mounted view (e.g. WikiView) picks it up live.
  const [studioSettings, setStudioSettings] = useState<StudioSettings>(() => loadStudioSettings())
  const setWikiMultiPageDepth = useCallback((depth: number) => {
    setStudioSettings((prev) => {
      const next = { ...prev, wikiMultiPageDepth: depth }
      saveStudioSettings(next)
      window.dispatchEvent(new Event(STUDIO_SETTINGS_CHANGED_EVENT))
      return next
    })
  }, [])
  const setNodeWizardOnCreate = useCallback((on: boolean) => {
    setStudioSettings((prev) => {
      const next = { ...prev, nodeWizardOnCreate: on }
      saveStudioSettings(next)
      window.dispatchEvent(new Event(STUDIO_SETTINGS_CHANGED_EVENT))
      return next
    })
  }, [])

  // Close on outside-click (covers pointerdown + mousedown, capture phase
  // so descendants that call stopPropagation can't keep the menu open).
  useOutsideClick([wrapRef], open, useCallback(() => setOpen(false), []))

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey) }
  }, [open])

  const run = (fn: () => void) => () => { setOpen(false); fn() }

  return (
    <div className="app-menu-wrap" ref={wrapRef}>
      <button
        className={`app-brand${open ? ' open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        title="Menu"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className="app-brand-logo" aria-hidden>
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round">
            <path d="M10 1.8 L17.5 6 V14 L10 18.2 L2.5 14 V6 Z" fill="rgba(var(--accent-rgb),0.18)" />
            <circle cx="10" cy="10" r="2.4" fill="currentColor" stroke="none" />
          </svg>
        </span>
        <span className="app-brand-name">Radical</span>
        <span className={`app-brand-caret${open ? ' open' : ''}`} aria-hidden>
          <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 6 L8 10 L12 6" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="app-menu-popover" role="menu">
          <div className="app-menu-section">
            <div className="app-menu-label">Models</div>
            <button className="app-menu-item" role="menuitem" onClick={run(onManage)}>
              <span className="app-menu-icon"><IconLoad /></span>
              <span className="app-menu-text">
                Manage models…
                {activeDocLabel && (
                  <span className="app-menu-current-doc-inline">
                    <span className={`toolbar-doc-badge ${activeDocSource}`}>
                      {activeDocSource === 'fs' ? 'FILE' : activeDocSource === 'md' ? 'FOLDER' : 'LOCAL'}
                    </span>
                    <span className="app-menu-current-doc-name">{activeDocLabel}</span>
                  </span>
                )}
              </span>
            </button>
            <button className="app-menu-item" role="menuitem" onClick={run(onOpenHub)}>
              <span className="app-menu-icon"><IconHub /></span>
              <span className="app-menu-text">Import from Hub…</span>
            </button>
          </div>

          <div className="app-menu-divider" />

          <div className="app-menu-section">
            <div className="app-menu-label">Schema</div>
            <button
              className={`app-menu-item${metamodelActive ? ' active' : ''}`}
              role="menuitemcheckbox"
              aria-checked={metamodelActive}
              onClick={run(onToggleMetamodel)}
              title="Define object types, relations and constraints"
            >
              <span className="app-menu-icon"><IconMetamodel /></span>
              <span className="app-menu-text">
                {metamodelActive ? 'Close metamodel editor' : 'Metamodel editor…'}
              </span>
            </button>
          </div>

          <div className="app-menu-divider" />

          <div className="app-menu-section">
            <div className="app-menu-label">View</div>
            <button className="app-menu-item" role="menuitem" onClick={run(onToggleTheme)}>
              <span className="app-menu-icon">{theme === 'dark' ? <IconSun /> : <IconMoon />}</span>
              <span className="app-menu-text">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
            </button>
            <button
              className={`app-menu-item${smartFitActive ? ' active' : ''}`}
              role="menuitemcheckbox"
              aria-checked={smartFitActive}
              onClick={run(onToggleSmartFit)}
            >
              <span className="app-menu-icon"><IconSmartFit /></span>
              <span className="app-menu-text">Smart fit {smartFitActive ? '(on)' : '(off)'}</span>
            </button>
            <div className="app-menu-row">
              <span className="app-menu-row-label">Lines in this model</span>
              <select
                className="app-menu-select"
                aria-label="Lines in this model"
                value={defaultEdgeStyle}
                disabled={!editable}
                onChange={(e) => setDefaultEdgeStyle(e.target.value as 'curved' | 'orthogonal')}
                title="How All elements, and every view that does not choose its own in its properties, draws relations"
              >
                <option value="curved">Curved</option>
                <option value="orthogonal">Orthogonal</option>
              </select>
            </div>
            <div className="app-menu-row">
              <span className="app-menu-row-label">Wiki multi-page depth</span>
              <select
                className="app-menu-select"
                value={studioSettings.wikiMultiPageDepth}
                onChange={(e) => setWikiMultiPageDepth(Number(e.target.value))}
                title="Wiki 'Multi page' mode: how many levels of children get their full content shown inline before falling back to preview cards"
              >
                {Array.from(
                  { length: WIKI_MULTI_PAGE_DEPTH_MAX - WIKI_MULTI_PAGE_DEPTH_MIN + 1 },
                  (_, i) => WIKI_MULTI_PAGE_DEPTH_MIN + i,
                ).map((n) => (
                  <option key={n} value={n}>{n} level{n === 1 ? '' : 's'}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="app-menu-divider" />

          <div className="app-menu-section">
            <div className="app-menu-label">Editing</div>
            <div className="app-menu-row">
              <span className="app-menu-row-label">Connect key</span>
              <select
                className="app-menu-select"
                value={connectionModifier}
                onChange={(e) => setConnectionModifier(e.target.value as ConnectionMod)}
              >
                <option value="alt">{isMac ? '⌥ Option' : 'Alt'}</option>
                <option value="shift">⇧ Shift</option>
                <option value="ctrl">Ctrl</option>
                <option value="meta">{isMac ? '⌘ Cmd' : '⊞ Win'}</option>
              </select>
            </div>
            <label
              className="app-menu-row"
              title="Open a guided form when you create a node whose type has a wizard (ADR, Requirement, …). The wizard stays available from the properties panel either way."
            >
              <span className="app-menu-row-label">Wizard on create</span>
              <input
                type="checkbox"
                checked={studioSettings.nodeWizardOnCreate}
                onChange={(e) => setNodeWizardOnCreate(e.target.checked)}
              />
            </label>
          </div>

          <div className="app-menu-divider" />

          <div className="app-menu-section">
            <div className="app-menu-label">AI</div>
            <button
              className="app-menu-item"
              role="menuitem"
              onClick={run(onOpenAISettings)}
              title="Configure AI providers (Ollama, OpenAI, Claude, Gemini)"
            >
              <span className="app-menu-icon"><IconAI /></span>
              <span className="app-menu-text">AI providers…</span>
            </button>
            <button
              className="app-menu-item"
              role="menuitem"
              onClick={run(onOpenForge)}
              title="Generate requirements, a domain model, fitness functions, Gherkin scenarios, state machines, UI mockups and a C4 model from a description"
            >
              <span className="app-menu-icon"><IconAI /></span>
              <span className="app-menu-text">Radical Forge…</span>
            </button>
          </div>

          <div className="app-menu-divider" />

          <div className="app-menu-section">
            <div className="app-menu-label">Export</div>
            <button
              className="app-menu-item"
              role="menuitem"
              onClick={run(onExportPNG)}
              disabled={exportBusy}
            >
              <span className="app-menu-icon"><IconExportPNG /></span>
              <span className="app-menu-text">Export as PNG…</span>
            </button>
            <button
              className="app-menu-item"
              role="menuitem"
              onClick={run(onExportSVG)}
              disabled={exportBusy}
            >
              <span className="app-menu-icon"><IconExportSVG /></span>
              <span className="app-menu-text">Export as SVG…</span>
            </button>
            <button
              className="app-menu-item"
              role="menuitem"
              onClick={run(onCopyToClipboard)}
              disabled={exportBusy}
            >
              <span className="app-menu-icon"><IconClipboard /></span>
              <span className="app-menu-text">Copy to clipboard</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

/** Input kinds that hold no text: Ctrl/Cmd+Z there is not about typing. */
const NOT_TEXT_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image'])

/** A modal dialog is open (a node wizard, the Models dialog, the metamodel
 *  editor…): Studio's own shortcuts stay out of it. Ctrl/Cmd+Z in a wizard
 *  took back the element the wizard was creating its child in, and Create
 *  then saved a child of nothing (the model could not be opened again); F5
 *  started a presentation behind it. */
function inModalDialog(): boolean {
  return !!document.querySelector('[role="dialog"][aria-modal="true"]') || !!useDiagramStore.getState().nodeWizard
}

/** Whether the key event comes from a field the user types text into. */
function typingInTextField(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || typeof el.tagName !== 'string') return false
  if (el.isContentEditable || el.tagName === 'TEXTAREA') return true
  return el.tagName === 'INPUT' && !NOT_TEXT_INPUTS.has((el as HTMLInputElement).type)
}

/** The Inspector perspective, with how many errors and warnings the check
 *  finds in the model now. Greyed out while the model has no report of
 *  `radical check --report` beside it: there is nothing to inspect yet. */
function InspectorModeButton({ active, onClick }: { active: boolean; onClick: () => void }): React.ReactElement {
  const check = useInspectorStore((s) => s.check)
  const hasReport = useInspectorStore((s) => s.results !== null)
  const enabled = hasReport || active
  const title = !enabled
    ? 'Inspector — no check report beside this model yet. Run radical check <model folder> --report <test reports> to make one; Studio picks it up by itself.'
    : check
      ? `Inspector — what radical check says about the model: ${check.errors} errors, ${check.warnings} warnings`
      : 'Inspector — what radical check says about the model'
  return (
    <button className={`toolbar-mode-btn${active ? ' active' : ''}`} onClick={onClick} disabled={!enabled} title={title}>
      <IconInspect /> Inspector
      {enabled && check && (check.errors > 0 || check.warnings > 0) && (
        <span className="insp-count">{check.errors > 0 && <span className="e">✖ {check.errors}</span>}<span className="w">⚠ {check.warnings}</span></span>
      )}
    </button>
  )
}

function IconInspect(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5 14 14" strokeLinecap="round" /><path d="M5 7l1.5 1.5L9 5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Toolbar(): React.ReactElement {
  // The perspective drawn, which a link still waiting for its document sets.
  const appMode = useShownMode()
  const setStoreMode = useDiagramStore((s) => s.setAppMode)
  // Picking a perspective wins over a link still waiting.
  const setAppMode = useCallback((mode: Parameters<typeof setStoreMode>[0]) => { dropPendingMode(); setStoreMode(mode) }, [setStoreMode])
  const autoFitActive = useDiagramStore((s) => s.autoFitActive)
  const toggleAutoFit = useDiagramStore((s) => s.toggleAutoFit)
  const connectionModifier = useDiagramStore((s) => s.connectionModifier)
  const setConnectionModifier = useDiagramStore((s) => s.setConnectionModifier)

  const undo = useDiagramStore((s) => s.undo)
  const redo = useDiagramStore((s) => s.redo)
  const canUndo = useDiagramStore((s) => s.canUndo)
  const canRedo = useDiagramStore((s) => s.canRedo)

  const docs = useDocumentsStore((s) => s.docs)
  const activeDocId = useDocumentsStore((s) => s.activeId)
  const activeDoc = activeDocId ? docs.find(d => d.id === activeDocId) ?? null : null
  const [managerOpen, setManagerOpen] = useState(false)


  // Only the VS Code webview follows the editor theme; the desktop app and
  // the browser keep the user's own choice.
  const isVSCode = host().kind === 'vscode'

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (isVSCode) {
      return document.body.classList.contains('vscode-light') ? 'light' : 'dark'
    }
    return (localStorage.getItem('radical-theme') as 'dark' | 'light') || 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    if (!isVSCode) localStorage.setItem('radical-theme', theme)
  }, [theme, isVSCode])

  // In VS Code: follow the editor theme automatically
  useEffect(() => {
    if (!isVSCode) return
    const obs = new MutationObserver(() => {
      setTheme(document.body.classList.contains('vscode-light') ? 'light' : 'dark')
    })
    obs.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-vscode-theme-kind'] })
    return () => obs.disconnect()
  }, [isVSCode])

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  // Keyboard shortcuts: Cmd+Z / Cmd+Shift+Z (Mac), Ctrl+Z / Ctrl+Shift+Z (Win), F5
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault()
        if (inModalDialog()) return
        const state = useDiagramStore.getState()
        if (state.presentationActive) state.stopPresentation()
        else state.startPresentation()
        return
      }
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      const undoKey = e.key === 'z' && !e.shiftKey
      const redoKey = (e.key === 'z' && e.shiftKey) || e.key === 'y'
      if (undoKey || redoKey) {
        // While a text field has the focus the keys are its own: they take
        // back typing. Here they took back the model's last step instead (a
        // typo "undone" in the wiki's writing line deleted the requirement
        // written before it). And undo belongs to Designer: from Viewer or
        // Presenter it took one of Designer's steps, unseen.
        if (typingInTextField(e.target)) return
        if (inModalDialog()) return
        if (useDiagramStore.getState().appMode !== 'designer') return
        e.preventDefault()
        if (undoKey) useDiagramStore.getState().undo()
        else useDiagramStore.getState().redo()
      } else if ((e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_') && (window as any).__radicalZoomIn
        && useDiagramStore.getState().appMode !== 'inspector') {
        // The canvas and the Flow view register zoom; elsewhere (the
        // Inspector shows no canvas, though the one left registered) the
        // browser zooms the page.
        e.preventDefault()
        if (e.key === '+' || e.key === '=') useDiagramStore.getState().zoomIn()
        else useDiagramStore.getState().zoomOut()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleManage = useCallback(() => { setManagerOpen(true) }, [])

  const [aiSettingsOpen, setAISettingsOpen] = useState(false)
  const handleOpenAISettings = useCallback(() => { setAISettingsOpen(true) }, [])
  const handleCloseAISettings = useCallback(() => { setAISettingsOpen(false) }, [])

  const [forgeOpen, setForgeOpen] = useState(false)
  const handleOpenForge = useCallback(() => { setForgeOpen(true) }, [])
  const handleCloseForge = useCallback(() => { setForgeOpen(false) }, [])

  const [hubOpen, setHubOpen] = useState(false)
  const [hubPreselectedIds, setHubPreselectedIds] = useState<string[] | undefined>(undefined)
  const handleOpenHub = useCallback(() => {
    setHubPreselectedIds(undefined)
    setHubOpen(true)
  }, [])
  const handleCloseHub = useCallback(() => {
    setHubOpen(false)
    setHubPreselectedIds(undefined)
  }, [])

  // Detect ?hub=id1,id2 query param and open modal pre-filtered.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const hubParam = params.get('hub')
    if (hubParam) {
      const ids = hubParam.split(',').map((s) => s.trim()).filter(Boolean)
      if (ids.length > 0) {
        setHubPreselectedIds(ids)
        setHubOpen(true)
        // Clean the URL without triggering a reload.
        const clean = window.location.pathname + window.location.hash
        window.history.replaceState(null, '', clean)
      }
    }
  }, [])

  const { exportBusy, exportAs, copyToClipboard } = useExport()
  const handleExportPNG = useCallback(() => exportAs('png'), [exportAs])
  const handleExportSVG = useCallback(() => exportAs('svg'), [exportAs])

  // Allow other components (e.g. AIPanel) to open the modal via a window event.
  useEffect(() => {
    const onOpen = () => setAISettingsOpen(true)
    window.addEventListener('radical:open-ai-settings', onOpen as EventListener)
    return () => window.removeEventListener('radical:open-ai-settings', onOpen as EventListener)
  }, [])

  // Lets WelcomeScreen (rendered as a sibling overlay, before any document is
  // open) launch Radical Forge right after creating the blank model it opens
  // into — same window-event pattern as the AI settings modal above.
  useEffect(() => {
    const onOpen = () => setForgeOpen(true)
    window.addEventListener('radical:open-forge', onOpen as EventListener)
    return () => window.removeEventListener('radical:open-forge', onOpen as EventListener)
  }, [])

  // The Forge button opens a read-only view instead while an agent runs
  // Forge on this folder over MCP (see persistence/agentForge).
  const [agentForgeOpen, setAgentForgeOpen] = useState(false)
  const closeAgentForge = useCallback(() => setAgentForgeOpen(false), [])
  useEffect(() => {
    const onOpen = () => setAgentForgeOpen(true)
    window.addEventListener('radical:open-agent-forge', onOpen as EventListener)
    return () => window.removeEventListener('radical:open-agent-forge', onOpen as EventListener)
  }, [])

  return (
    <div className="toolbar">
      <AISettingsModal open={aiSettingsOpen} onClose={handleCloseAISettings} />
      <HubImportModal open={hubOpen} onClose={handleCloseHub} preselectedIds={hubPreselectedIds} />
      <RadicalForgeModal open={forgeOpen} onClose={handleCloseForge} />
      <AgentForgeModal open={agentForgeOpen && !forgeOpen} onClose={closeAgentForge} />
      <AppMenu
        onManage={handleManage}
        activeDocLabel={activeDoc?.name ?? null}
        activeDocSource={activeDoc?.source ?? null}
        connectionModifier={connectionModifier}
        setConnectionModifier={setConnectionModifier}
        theme={theme}
        onToggleTheme={toggleTheme}
        smartFitActive={autoFitActive}
        onToggleSmartFit={toggleAutoFit}
        metamodelActive={appMode === 'metamodel'}
        onToggleMetamodel={() => setAppMode(appMode === 'metamodel' ? 'designer' : 'metamodel')}
        onOpenAISettings={handleOpenAISettings}
        onOpenHub={handleOpenHub}
        onOpenForge={handleOpenForge}
        onExportPNG={handleExportPNG}
        onExportSVG={handleExportSVG}
        onCopyToClipboard={copyToClipboard}
        exportBusy={exportBusy}
      />
      {/* Undo: the Inspector changes nothing. Fit, zoom and Smart Layout are
          on the canvas (CanvasControls). */}
      {appMode !== 'inspector' && (<>
        <div className="toolbar-sep" />

        <button
          className="toolbar-btn"
          onClick={undo}
          disabled={!canUndo}
          title="Undo (⌘Z)"
        >
          <IconUndo /> Undo
        </button>
        <button
          className="toolbar-btn"
          onClick={redo}
          disabled={!canRedo}
          title="Redo (⌘⇧Z)"
        >
          <IconRedo /> Redo
        </button>
      </>)}

      <div style={{ flex: 1 }} />

      <div className="toolbar-mode-switch">
        <button
          className={`toolbar-mode-btn${appMode === 'designer' ? ' active' : ''}`}
          onClick={() => setAppMode('designer')}
          title="Designer perspective — edit the model"
        >
          <IconModelling /> Designer
        </button>
        <button
          className={`toolbar-mode-btn${appMode === 'viewer' ? ' active' : ''}`}
          onClick={() => setAppMode('viewer')}
          title="Viewer perspective — explore the model"
        >
          <IconView /> Viewer
        </button>
        <button
          className={`toolbar-mode-btn${appMode === 'presenter' ? ' active' : ''}`}
          onClick={() => setAppMode('presenter')}
          title="Presenter perspective — build and play presentations"
        >
          <IconPresentation /> Presenter
        </button>
        <InspectorModeButton active={appMode === 'inspector'} onClick={() => setAppMode('inspector')} />
      </div>

      <DocumentManagerModal open={managerOpen} onClose={() => setManagerOpen(false)} />
    </div>
  )
}
