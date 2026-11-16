import React, { useCallback, useState, useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRailSlot } from '@radical/ui/components/RightPanel'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { host } from '../platform/host'
import { useDocumentsStore, type DocumentSource } from '../store/documentStore'
import { OtherModelsButton } from './OtherModels'
import { useOtherModelsStore } from '../persistence/otherModels'
import { NavHistory } from './NavHistory'
import { inspectorAvailable, useInspectorAvailable, useInspectorStore, useSettingsUnsaved } from '../persistence/inspector'
import { toggleInspector, useInspectorNav } from '../navigation'
import { setLeftCollapsed, toggleLeftPanel } from '../leftPanelFold'
import { closePresentations, openPresentations, switchPerspective, usePresentationsFrom, usePresentationsOpen } from '../presentationsPlace'
import { INSPECTOR_KEYS } from './Inspector'
import { openCheckSettings } from './inspector/checkSettingsOpen'
import { dropPendingMode, placeGone, useShownMode } from '../route'
import { useRegisterCommands } from '../commands'
import { goBack, goForward } from '../navHistory'
import { DocumentManagerModal } from './DocumentManager'
import { AISettingsModal } from './AISettingsModal'
import { AboutDialog } from './AboutDialog'
import { HubImportModal } from './HubImportModal'
import { OPEN_HUB_EVENT } from '../persistence/inspector'
import { RadicalForgeModal } from './RadicalForgeModal'
import { AgentForgeModal } from './AgentForgeModal'
import { AgentAssayModal } from './AgentAssayModal'
import { useOutsideClick } from '@radical/ui/hooks/useOutsideClick'
import { useExport } from '../hooks/useExport'
import { keysTakenByDialog } from './dialogKeys'
import { FORGE_NEEDS_AI, aiReady, loadAISettings } from '../ai/settings'
import { saveThemePref, useDrawnTheme, useThemePref, type ThemePref } from '../theme'
import { openSetup } from './SetupWizard'
import { useMenuKeys } from '@radical/ui/hooks/menuKeys'
import { isTypedField } from '@radical/ui/components/keysHere'
import {
  loadStudioSettings,
  updateStudioSettings,
  STUDIO_SETTINGS_CHANGED_EVENT,
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

const IconSetup = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
    <path d="M2 4h7M12 4h2M2 8h2M7 8h7M2 12h9M14 12h0" />
    <circle cx="10.5" cy="4" r="1.5" />
    <circle cx="5.5" cy="8" r="1.5" />
    <circle cx="12.5" cy="12" r="1.5" />
  </svg>
)

const IconSmartFit = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M2 5V2h3M11 2h3v3M14 11v3h-3M5 14H2v-3" />
    <path d="M8 6l1 2 2 .4-1.5 1.4.4 2L8 10.8 6.1 11.8l.4-2L5 8.4 7 8z" fill="currentColor" stroke="none" />
  </svg>
)

const IconUndo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </svg>
)

const IconRedo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
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


const IconView = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" strokeLinejoin="round" />
    <circle cx="8" cy="8" r="2" />
  </svg>
)

const IconAI = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 2.5l.7 1.6L7.3 4.8l-1.6.7L5 7.1l-.7-1.6L2.7 4.8l1.6-.7z" fill="currentColor" stroke="none" />
    <path d="M11.5 7l.6 1.4 1.4.6-1.4.6L11.5 11l-.6-1.4L9.5 9l1.4-.6z" fill="currentColor" stroke="none" />
    <path d="M8 9.5L8.6 11l1.4.5-1.4.5L8 13.5l-.6-1.5L6 11.5l1.4-.5z" fill="currentColor" stroke="none" />
  </svg>
)


const IconMetamodel = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="1.5" width="4" height="3.5" rx="0.7" />
    <rect x="1.5" y="11" width="4" height="3.5" rx="0.7" />
    <rect x="10.5" y="11" width="4" height="3.5" rx="0.7" />
    <path d="M8 5v2.5M3.5 11V9.5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1V11" />
  </svg>
)

const IconInfo = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round">
    <circle cx="8" cy="8" r="6.2" />
    <path d="M8 7.2v4" />
    <circle cx="8" cy="4.9" r="0.4" fill="currentColor" />
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

// ── App menus (the activity rail's foot, as in VS Code) ──────────────────────

type ConnectionMod = 'alt' | 'shift' | 'ctrl' | 'meta'
type RailMenuId = 'models' | 'settings'

// The rail's own icons: drawn on a 24 grid, larger and bolder than the
// menus' 16 px ones, so they read at a glance; `viewBox` pads one that fills
// its grid more than the rail's others do.
const RailIcon = ({ children, viewBox = '0 0 24 24' }: { children: React.ReactNode; viewBox?: string }) => (
  <svg viewBox={viewBox} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
)
// The gear fills 22 of its 24: padded to the folder's size above it.
const RailIconSettings = () => (
  <RailIcon viewBox="-2.5 -2.5 29 29">
    <path d="M10.3 3.2a1.7 1.7 0 0 1 3.4 0l.2 1a1.7 1.7 0 0 0 2.5 1.1l.9-.5a1.7 1.7 0 0 1 2.4 2.4l-.5.9a1.7 1.7 0 0 0 1.1 2.5l1 .2a1.7 1.7 0 0 1 0 3.4l-1 .2a1.7 1.7 0 0 0-1.1 2.5l.5.9a1.7 1.7 0 0 1-2.4 2.4l-.9-.5a1.7 1.7 0 0 0-2.5 1.1l-.2 1a1.7 1.7 0 0 1-3.4 0l-.2-1a1.7 1.7 0 0 0-2.5-1.1l-.9.5a1.7 1.7 0 0 1-2.4-2.4l.5-.9a1.7 1.7 0 0 0-1.1-2.5l-1-.2a1.7 1.7 0 0 1 0-3.4l1-.2a1.7 1.7 0 0 0 1.1-2.5l-.5-.9a1.7 1.7 0 0 1 2.4-2.4l.9.5a1.7 1.7 0 0 0 2.5-1.1Z" />
    <circle cx="12" cy="12" r="3" />
  </RailIcon>
)

/** Models at the rail's top: the mark of radical.tools ("r." of
 *  tools/brand/radical-mark.svg, its letter in the blue to violet ink), on
 *  a tile tinted for the theme as the sections' icon squares are, not the
 *  mark's own dark tile, which stood out in the light theme and sank into
 *  the dark one. */
const RailBrandMark = () => (
  <span className="rail-brand-mark" aria-hidden>
    <svg viewBox="24 24 80 80" width="24" height="24">
      <defs>
        <linearGradient id="rail-mark-ink" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--mark-ink-a)' }} />
          <stop offset="1" style={{ stopColor: 'var(--mark-ink-b)' }} />
        </linearGradient>
      </defs>
      <path d="M44 94V64A24 24 0 0 1 68 40H72" fill="none" stroke="url(#rail-mark-ink)" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="86" cy="94" r="10" style={{ fill: 'var(--mark-ink-b)' }} />
    </svg>
  </span>
)

/** Drawn as the left panel's sections draw theirs (SectionIcon): a 16 grid,
 *  one stroke of 1.5, 14 px in its tinted square. */
const RailIconPresentations = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M2 2.5 H14 V10.5 H2 Z M8 10.5 V13.5 M5.5 13.5 H10.5 M6.75 4.75 V8.25 L9.75 6.5 Z" />
  </svg>
)

/** The Presentations button on the activity rail, just above the
 *  Inspector's (ADR Presentations are a place of the rail), drawn as the
 *  left panel's sections are, with the count of the open presentation's
 *  slides: it shows the presentations and their slides in the left panel
 *  and the slide picked on the canvas; lit, it folds the left panel and
 *  opens it again, as a section's tab does. Not in the metamodel editor. */
function PresentationsRailButton(): React.ReactElement | null {
  const open = usePresentationsOpen()
  const slides = useDiagramStore((s) => s.presentationSlides.length)
  const name = useDiagramStore((s) => s.presentations.find((p) => p.id === s.activePresentationId)?.name)
  const metamodel = useDiagramStore((s) => s.appMode === 'metamodel')
  if (metamodel) return null
  return (
    <button type="button" className={`lp-rail-tab rail-presentations${open ? ' active' : ''}`}
      onClick={() => { if (!open) openPresentations(); else toggleLeftPanel() }}
      title={`Presentations — build and play slides of the model${name ? `: ${name}, ${slides} slide${slides === 1 ? '' : 's'}` : ''}`}
      aria-label="Presentations" aria-pressed={open}>
      <span className="lp-section-icon"><RailIconPresentations /></span>
      <span className="lp-rail-count">{slides}</span>
    </button>
  )
}

const RailIconInspector = () => (
  <RailIcon>
    <circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5 21 21" /><path d="M7.5 10.5l2 2 3.5-4" />
  </RailIcon>
)

/** The Inspector's button on the activity rail, just above Settings, drawn
 *  as the left panel's sections are (icon, count under it): a place as a
 *  section is, its tabs in the left panel and the tab picked in place of
 *  the view; pressed again, it folds the left panel and opens it again, as
 *  a section's tab does. A section's tab, or ⌘J, goes back to the view. As
 *  the panel's verdict: red with the count of errors, green with none (the
 *  warnings are in its tooltip). Greyed out
 *  while there is nothing to inspect; not in the metamodel editor, which
 *  shows no panel. */
function InspectorRailButton(): React.ReactElement | null {
  const check = useInspectorStore((s) => s.check)
  const enabled = useInspectorAvailable()
  const open = useInspectorNav((s) => s.open) && enabled
  const metamodel = useDiagramStore((s) => s.appMode === 'metamodel')
  if (metamodel) return null
  const title = !enabled
    ? 'Inspector — no check report or measurements beside this model yet. Run radical check <model folder> --report <test reports>, or radical sense, to make one; Studio picks it up by itself.'
    : `Inspector — what radical check says about the model${check ? `: ${check.errors} errors, ${check.warnings} warnings` : ''} (${INSPECTOR_KEYS})`
  const count = !enabled || !check ? null : check.errors
  const tone = !enabled || !check ? 'none' : check.errors ? 'e' : 'ok'
  const short = (n: number): string => n > 999 ? `${Math.floor(n / 100) / 10}k` : String(n)
  return (
    <button type="button" className={`lp-rail-tab rail-inspector ${tone}${open ? ' active' : ''}`} disabled={!enabled}
      onClick={() => {
        // As a section's tab: open, it shows its place with the left panel;
        // lit, it folds the left panel and opens it again, the report staying.
        if (!open) { closePresentations(); toggleInspector(true); setLeftCollapsed(false) } else toggleLeftPanel()
      }}
      title={title} aria-label="Inspector" aria-pressed={open} aria-controls="insp-dock">
      <span className="lp-section-icon"><RailIconInspector /></span>
      <span className="lp-rail-count">{count === null ? '–' : short(count)}</span>
    </button>
  )
}

/** Where the open model is kept, as its badge says it and in words. */
const DOC_BADGE: Record<DocumentSource, string> = { ls: 'LOCAL', fs: 'FILE', md: 'FOLDER' }
const DOC_WHERE: Record<DocumentSource, string> = { ls: 'kept in this browser (local storage)', fs: 'a file on disk', md: 'a folder on disk' }

/** One button on the activity rail and the menu it opens beside the rail;
 *  ↑/↓, Escape and Tab as in any menu (useMenuKeys). */
function RailMenu({ id, label, icon, open, onOpen, onClose, atTop = false, children }: {
  id: RailMenuId
  label: string
  icon: React.ReactNode
  open: boolean
  onOpen: (id: RailMenuId | null) => void
  onClose: () => void
  /** At the rail's top: the menu hangs from the button's top, not stands on its foot. */
  atTop?: boolean
  children: React.ReactNode
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  useOutsideClick([wrapRef], open, onClose)
  useMenuKeys(wrapRef, open, onClose)
  return (
    <div className="rail-menu" ref={wrapRef}>
      <button
        type="button"
        className={`rail-action${open ? ' open' : ''}`}
        title={atTop ? `${label}: manage models, import from the Hub` : label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => onOpen(open ? null : id)}
      >
        {icon}
      </button>
      {open && (
        <div className={`app-menu-popover rail-flyout${atTop ? ' at-top' : ''}`} role="menu" aria-label={label}>
          {children}
        </div>
      )}
    </div>
  )
}

/** Models at the top of the activity rail (ActivityRail), as VS Code's
 *  explorer, the model open named at the toolbar's left; and Settings at the
 *  rail's foot, holding the metamodel editor, AI and Export too (the author
 *  moved them there on 2026-10-26), About last. */
function AppMenu({
  onManage, activeDocLabel, activeDocSource, branch,
  connectionModifier, setConnectionModifier,
  themePref, onThemePref, showTheme,
  onOpenSetup,
  smartFitActive, onToggleSmartFit,
  metamodelActive, onToggleMetamodel,
  onOpenAISettings,
  onOpenHub,
  onOpenForge,
  onExportPNG,
  onExportSVG,
  onCopyToClipboard,
  onOpenAbout,
  exportBusy,
}: {
  onManage: () => void
  activeDocLabel: string | null
  activeDocSource: DocumentSource | null
  /** Changes on branch, in the strip after the model's name. */
  branch: React.ReactNode
  connectionModifier: ConnectionMod
  setConnectionModifier: (m: ConnectionMod) => void
  themePref: ThemePref
  onThemePref: (pref: ThemePref) => void
  /** Outside VS Code, whose editor sets the theme. */
  showTheme: boolean
  onOpenSetup: () => void
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
  onOpenAbout: () => void
  exportBusy: boolean
}) {
  const [menu, setMenu] = useState<RailMenuId | null>(null)
  const close = useCallback(() => setMenu(null), [])
  const slot = useRailSlot((s) => s.el)
  const topSlot = useRailSlot((s) => s.top)
  const placesSlot = useRailSlot((s) => s.places)
  // Radical Forge talks to an AI provider: without one it is offered
  // disabled (it saved the description, made its views and fetched the
  // Hub's index before saying so). Read each time the menu opens.
  const forgeReady = menu === 'settings' && aiReady(loadAISettings())
  const isMac = typeof navigator !== 'undefined' && navigator.platform?.includes('Mac')
  // How the model's canvases draw relations (All elements, and the views
  // that do not choose their own in their properties).
  const defaultEdgeStyle = useDiagramStore((s) => s.defaultEdgeStyle)
  const setDefaultEdgeStyle = useDiagramStore((s) => s.setDefaultEdgeStyle)
  const editable = useDiagramStore((s) => s.appMode === 'designer')
  // Keep smart for the views that have no setting of their own.
  const keepSmartDefault = useDiagramStore((s) => s.keepSmartDefault)
  const setKeepSmartDefault = useDiagramStore((s) => s.setKeepSmartDefault)
  // Inspector settings changed and not saved to check.json yet.
  const checkUnsaved = useSettingsUnsaved()

  // Studio-wide preferences (localStorage, not part of the .radical file).
  // A change writes only its own setting over the ones stored now: Focus and
  // Smart fit are switched elsewhere (canvas controls, the store) after this
  // menu has read them. Kept in step with those writers through their event.
  const [studioSettings, setStudioSettings] = useState<StudioSettings>(() => loadStudioSettings())
  useEffect(() => {
    const reload = () => setStudioSettings(loadStudioSettings())
    window.addEventListener(STUDIO_SETTINGS_CHANGED_EVENT, reload)
    return () => window.removeEventListener(STUDIO_SETTINGS_CHANGED_EVENT, reload)
  }, [])
  const setNodeWizardOnCreate = useCallback((on: boolean) => {
    setStudioSettings(updateStudioSettings({ nodeWizardOnCreate: on }))
  }, [])

  const run = (fn: () => void) => () => { setMenu(null); fn() }
  const railMenu = (id: RailMenuId, label: string, icon: React.ReactNode, children: React.ReactNode) => (
    <RailMenu id={id} label={label} icon={icon} open={menu === id} onOpen={setMenu} onClose={close}>{children}</RailMenu>
  )

  const modelsMenu = (
    <RailMenu id="models" label="Models" open={menu === 'models'} onOpen={setMenu} onClose={close} atTop
      icon={<RailBrandMark />}>
          {/* The model open and where it is kept, at the menu's top (the
              toolbar named it before). */}
          {activeDocLabel && (
            <div className="app-menu-section app-menu-model-open">
              <div className="app-menu-label">Open</div>
              <div className="app-menu-model" title={`${activeDocLabel}: ${DOC_WHERE[activeDocSource ?? 'ls']}`}>
                <span className="app-menu-model-name">{activeDocLabel}</span>
                <span className={`toolbar-doc-badge ${activeDocSource ?? 'ls'}`}>{DOC_BADGE[activeDocSource ?? 'ls']}</span>
              </div>
              <div className="app-menu-model-where">{DOC_WHERE[activeDocSource ?? 'ls']}</div>
            </div>
          )}
          {activeDocLabel && <div className="app-menu-divider" />}
          <div className="app-menu-section">
            <div className="app-menu-label">Models</div>
            <button className="app-menu-item" role="menuitem" onClick={run(onManage)}>
              <span className="app-menu-icon"><IconLoad /></span>
              <span className="app-menu-text">Manage models…</span>
            </button>
            <button className="app-menu-item" role="menuitem" onClick={run(onOpenHub)}>
              <span className="app-menu-icon"><IconHub /></span>
              <span className="app-menu-text">Import from Hub…</span>
            </button>
          </div>
      </RailMenu>
  )

  const menus = (
    <>
      <InspectorRailButton />
      <hr className="activity-rail-divider" aria-hidden />
      {railMenu('settings', 'Settings', <RailIconSettings />, (<>
          <div className="app-menu-section">
            <div className="app-menu-label">View</div>
            {showTheme && (
              <div className="app-menu-row">
                <span className="app-menu-row-label">Theme</span>
                <select
                  className="app-menu-select"
                  aria-label="Theme"
                  value={themePref}
                  onChange={(e) => onThemePref(e.target.value as ThemePref)}
                  title="System follows the operating system's appearance"
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
            )}
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
            <label
              className="app-menu-row"
              title="Tidy a view after each change (yours or an agent's), the elements gliding into place, when the view has no Keep smart setting of its own. A view switched on or off keeps its own setting. Kept in this browser"
            >
              <span className="app-menu-row-label">Keep smart by default</span>
              <input
                type="checkbox"
                aria-label="Keep smart by default"
                checked={keepSmartDefault}
                onChange={(e) => setKeepSmartDefault(e.target.checked)}
              />
            </label>
          </div>
          <div className="app-menu-divider" />
          <div className="app-menu-section">
            <div className="app-menu-label">Editing</div>
            <div className="app-menu-row" title="Held on the canvas: drag from an element to another to connect them, click elements to pick several, drop a type from the palette without its wizard">
              <span className="app-menu-row-label">Special key</span>
              <select
                className="app-menu-select"
                aria-label="Special key"
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
            <div className="app-menu-label">Metamodel</div>
            <button
              className={`app-menu-item${metamodelActive ? ' active' : ''}`}
              role="menuitemcheckbox"
              aria-checked={metamodelActive}
              onClick={run(onToggleMetamodel)}
              title={metamodelActive ? 'Close the metamodel editor' : 'Object types, relations and constraints'}
            >
              <span className="app-menu-icon"><IconMetamodel /></span>
              <span className="app-menu-text">Metamodel editor {metamodelActive ? '(open)' : ''}</span>
            </button>
          </div>
          <div className="app-menu-divider" />
          <div className="app-menu-section">
            <div className="app-menu-label">Inspector</div>
            <button
              className="app-menu-item"
              role="menuitem"
              onClick={run(openCheckSettings)}
              title="What the Inspector and radical check ask of this model: goals, rules and baselines, the test files every test of which the model names (saved to check.json)"
            >
              <span className="app-menu-icon"><IconInspect /></span>
              <span className="app-menu-text">Inspector settings…{checkUnsaved && <span className="insp-pill warn app-menu-pill">unsaved</span>}</span>
            </button>
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
              disabled={!forgeReady}
              aria-describedby={forgeReady ? undefined : 'app-menu-forge-hint'}
              title={forgeReady
                ? 'Generate requirements, a domain model, fitness functions, Gherkin scenarios, state machines, processes, UI mockups and a C4 model from a description'
                : FORGE_NEEDS_AI}
            >
              <span className="app-menu-icon"><IconAI /></span>
              <span className="app-menu-text">
                Radical Forge…
                {!forgeReady && <span id="app-menu-forge-hint" className="app-menu-hint">Needs an AI provider: AI providers… above</span>}
              </span>
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
          <div className="app-menu-divider" />
          <div className="app-menu-section">
            <button className="app-menu-item" role="menuitem" onClick={run(onOpenSetup)} title="The theme, the special key, the canvas and an AI provider, one step each">
              <span className="app-menu-icon"><IconSetup /></span>
              <span className="app-menu-text">Setup…</span>
            </button>
            <button className="app-menu-item" role="menuitem" onClick={run(onOpenAbout)}>
              <span className="app-menu-icon"><IconInfo /></span>
              <span className="app-menu-text">About Radical Studio</span>
            </button>
          </div>
      </>))}
    </>
  )

  return (
    <>
      {/* The other models of a federation, in a strip as the perspectives';
          the model open is named at the top of the Models menu. */}
      {branch && <div className="app-brand-switch">{branch}</div>}
      {topSlot && createPortal(modelsMenu, topSlot)}
      {slot && createPortal(menus, slot)}
      {placesSlot && createPortal(<PresentationsRailButton />, placesSlot)}
    </>
  )
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

/** The panels that show a run, in one place over the canvas (Toolbar). */
type RunPanel = 'forge' | 'agent-forge' | 'agent-assay'

/** Whether the key event comes from a field the user types text into: not
 *  a checkbox or a drop-down, where Ctrl/Cmd+Z is not about typing. */
const typingInTextField = isTypedField

/** Before a presentation starts from F5, the focus leaves what has it, as a
 *  click elsewhere would take it: a name being typed (the table's F2, a
 *  Warnier step, a slide's name, the card) is committed on that blur, and a
 *  menu that closes when it loses the focus closes. The presentation took the
 *  field away with no blur, and the typed name was lost; a menu stayed over
 *  the slide with the keys. */
function letGoOfFocus(): void {
  const el = document.activeElement
  if (el instanceof HTMLElement && el !== document.body) el.blur()
}

/** The Inspector's icon in the menus (Inspector settings…). */
export function IconInspect(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5 14 14" strokeLinecap="round" /><path d="M5 7l1.5 1.5L9 5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Room for Quick Search ────────────────────────────────────────────────────
//
// Quick Search stands in the window's middle, Undo and Redo before it, ‹ ›
// and History after it (App draws it; --qs-x is the block's middle, --qs-w Quick Search's
// width). With less room between the toolbar's two sides the block moves off
// the middle, then Quick Search narrows, then the perspectives drop their
// labels: nothing may lie on top of anything that takes a click (below about
// 1160 px a click on Designer opened History).

/** Quick Search's width at most, and the least before the labels go. */
const QS_MAX = 520
const QS_MIN = 200
/** Between Quick Search and the navigation either side of it. */
const NAV_GAP = 8
/** Between the navigation and the toolbar's two sides. */
const SIDE_GAP = 8

/** Places the middle block; true while the perspectives go without their
 *  labels. `search`: Quick Search is shown. */
function useMiddleRoom(bar: React.RefObject<HTMLDivElement>, search: boolean, appMode: string): boolean {
  const [compact, setCompact] = useState(false)
  const fit = useCallback(() => {
    const el = bar.current
    if (!el) return
    const width = window.innerWidth
    const edges = (selector: string, side: 'left' | 'right'): number[] =>
      [...el.querySelectorAll<HTMLElement>(selector)].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0).map((r) => r[side])
    const start = Math.max(0, ...edges(':scope > .app-brand-switch', 'right'))
    const end = Math.min(width, ...edges(':scope > .toolbar-mode-switch', 'left'))
    // How much wider the perspectives are with their labels than without
    // (a label left out keeps its width in scrollWidth).
    let labels = 0
    for (const label of el.querySelectorAll<HTMLElement>('.toolbar-mode-btn .toolbar-label')) {
      const gap = parseFloat(getComputedStyle(label.parentElement!).columnGap) || 0
      labels += (compact ? label.scrollWidth : label.getBoundingClientRect().width) + gap
    }
    const endWithLabels = compact ? end - labels : end
    const endWithout = compact ? end : end + labels
    const width_ = (selector: string): number => el.querySelector<HTMLElement>(selector)?.getBoundingClientRect().width ?? 0
    const [before, after] = [width_(':scope > .toolbar-center > .toolbar-center-before'), width_(':scope > .toolbar-center > .toolbar-center-after')]
    // The navigation stands this far from Quick Search, or from the middle.
    const gap = search ? NAV_GAP : 3
    // Quick Search's room between the sides, the navigation taken out.
    const room = (sideEnd: number): number => sideEnd - SIDE_GAP - (start + SIDE_GAP) - before - after - 2 * gap
    const nextCompact = room(endWithLabels) < (search ? QS_MIN : 0)
    const sideEnd = nextCompact ? endWithout : endWithLabels
    // As wide as the window gave it before; narrower when the sides need it.
    const wanted = Math.min(QS_MAX, Math.max(300, width - 920))
    const qs = search ? Math.floor(Math.max(0, Math.min(wanted, room(sideEnd)))) : 0
    // In the window's middle when it fits there, else as near it as it can be.
    const lowest = start + SIDE_GAP + before + gap + qs / 2
    const highest = sideEnd - SIDE_GAP - after - gap - qs / 2
    const x = Math.round(Math.max(lowest, Math.min(width / 2, highest)))
    const root = document.documentElement.style
    if (root.getPropertyValue('--qs-w') !== `${qs}px`) root.setProperty('--qs-w', `${qs}px`)
    if (root.getPropertyValue('--qs-x') !== `${x}px`) root.setProperty('--qs-x', `${x}px`)
    if (nextCompact !== compact) setCompact(nextCompact)
  }, [bar, search, compact])
  useLayoutEffect(() => {
    fit()
    const el = bar.current
    if (!el || typeof ResizeObserver === 'undefined') return
    // The sides change width on their own (a count on Changes on branch,
    // the fonts loading), the window by a resize.
    const watch = new ResizeObserver(() => fit())
    for (const side of el.querySelectorAll(':scope > .app-brand-switch, :scope > .toolbar-mode-switch, :scope > .toolbar-center > *')) watch.observe(side)
    window.addEventListener('resize', fit)
    return () => { watch.disconnect(); window.removeEventListener('resize', fit) }
  }, [fit, appMode])
  return compact
}

export function Toolbar(): React.ReactElement {
  // The perspective drawn, which a link still waiting for its document sets.
  const appMode = useShownMode()
  // The perspective lit: the Presentations place lights the one it was opened over.
  const presentationsFrom = usePresentationsFrom((x) => x.from)
  const shownPerspective = appMode === 'presenter' ? presentationsFrom : appMode
  // A federation: the other models are listed beside the model in every perspective.
  const dependsOnOthers = useOtherModelsStore((s) => !!s.summary)
  const setStoreMode = useDiagramStore((s) => s.setAppMode)
  // Picking a perspective wins over a link still waiting.
  const setAppMode = useCallback((mode: Parameters<typeof setStoreMode>[0]) => { dropPendingMode(); setStoreMode(mode) }, [setStoreMode])
  const autoFitActive = useDiagramStore((s) => s.autoFitActive)
  const keepSmartOn = useDiagramStore((s) => s.keepSmartDefault)
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

  // The theme chosen in this browser (Light, Dark or System), unless VS Code
  // sets it. App draws it (useApplyTheme).
  const { pref: themePref } = useThemePref()
  const theme = useDrawnTheme()

  const toggleTheme = useCallback(() => {
    saveThemePref(theme === 'dark' ? 'light' : 'dark')
  }, [theme])

  // Keyboard shortcuts: Cmd+Z / Cmd+Shift+Z (Mac), Ctrl+Z / Ctrl+Shift+Z (Win), F5
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault()
        if (keysTakenByDialog(e.target)) return
        const state = useDiagramStore.getState()
        if (state.presentationActive) state.stopPresentation()
        else {
          if (state.presentationSlides.length > 0) letGoOfFocus()
          state.startPresentation()
        }
        return
      }
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      // A letter comes as its capital with Shift or Caps Lock: Ctrl+Shift+Z
      // on Windows and Linux is 'Z', and it did not redo.
      const letter = e.key.length === 1 ? e.key.toLowerCase() : e.key
      const undoKey = letter === 'z' && !e.shiftKey
      const redoKey = (letter === 'z' && e.shiftKey) || letter === 'y'
      if (undoKey || redoKey) {
        // While a text field has the focus the keys are its own: they take
        // back typing. Here they took back the model's last step instead (a
        // typo "undone" in the wiki's writing line deleted the requirement
        // written before it). And undo belongs to Designer: from Viewer or
        // Presenter it took one of Designer's steps, unseen.
        if (typingInTextField(e.target)) return
        if (keysTakenByDialog(e.target)) return
        if (useDiagramStore.getState().appMode !== 'designer') return
        e.preventDefault()
        if (undoKey) useDiagramStore.getState().undo()
        else useDiagramStore.getState().redo()
      } else if (letter === 'j' && !e.shiftKey && !e.altKey) {
        // The Inspector panel, as VS Code's ⌘J opens and closes its panel.
        if (keysTakenByDialog(e.target)) return
        const state = useDiagramStore.getState()
        if (state.presentationActive) return
        e.preventDefault()
        // Open, it closes at once: after a reload it is drawn before the
        // files beside the model are read, and ⌘J did nothing till then.
        if (useInspectorNav.getState().open || inspectorAvailable()) toggleInspector()
      } else if ((e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_') && (window as any).__radicalZoomIn
        && !keysTakenByDialog(e.target)) {
        // The canvas and the Flow view register zoom; elsewhere the browser
        // zooms the page.
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
  const [aboutOpen, setAboutOpen] = useState(false)
  const handleOpenAbout = useCallback(() => { setAboutOpen(true) }, [])
  const handleCloseAbout = useCallback(() => { setAboutOpen(false) }, [])

  // Radical Forge, an agent's Forge run and an agent's Assay run show in one
  // place, one at a time: the one last asked for shows, and closing it leaves
  // none open. Each had a flag of its own, and the one open hid the others:
  // the Assay button did nothing under the agent's Forge panel, and the Assay
  // panel opened by itself once that closed. Radical Forge generating stays:
  // closed, its run would be lost. Between two stages it is put aside, and
  // comes back where it was (forgeAside): replaced, it was opened afresh on
  // an empty Description, and the run could not be continued.
  const [runPanel, setRunPanel] = useState<RunPanel | null>(null)
  const runPanelShown = useRef(runPanel)
  runPanelShown.current = runPanel
  const forgeBusy = useRef(false)
  const [forgeAside, setForgeAside] = useState(false)
  const showRunPanel = useCallback((panel: RunPanel) => {
    if (runPanelShown.current === 'forge' && panel !== 'forge') {
      if (forgeBusy.current) {
        useDiagramStore.getState().pushNotification('Radical Forge is generating: its panel stays open until it is done.', 'info')
        return
      }
      setForgeAside(true)
    }
    setRunPanel(panel)
  }, [])
  const closeRunPanel = useCallback((panel: RunPanel) => {
    if (panel === 'forge') setForgeAside(false)
    setRunPanel((open) => (open === panel ? null : open))
  }, [])
  const onForgeBusy = useCallback((busy: boolean) => { forgeBusy.current = busy }, [])
  const handleOpenForge = useCallback(() => {
    if (!aiReady(loadAISettings())) {
      useDiagramStore.getState().pushNotification(FORGE_NEEDS_AI, 'info')
      return
    }
    showRunPanel('forge')
  }, [showRunPanel])
  const handleCloseForge = useCallback(() => closeRunPanel('forge'), [closeRunPanel])

  const [hubOpen, setHubOpen] = useState(false)
  const [hubPreselectedIds, setHubPreselectedIds] = useState<string[] | undefined>(undefined)
  const [hubBindTo, setHubBindTo] = useState<string | undefined>(undefined)
  const handleOpenHub = useCallback(() => {
    setHubPreselectedIds(undefined)
    setHubBindTo(undefined)
    setHubOpen(true)
  }, [])
  const handleCloseHub = useCallback(() => {
    setHubOpen(false)
    setHubPreselectedIds(undefined)
    setHubBindTo(undefined)
  }, [])
  // The Inspector's concern finding opens the modal on its pack, bound to
  // the element the concern applies to (persistence/inspector.ts, openConcern),
  // and a Hub link (?hub=id1,id2) on its packs once a model is open (App).
  useEffect(() => {
    const onOpen = (e: Event): void => {
      const { ids, bindTo } = (e as CustomEvent<{ ids: string[]; bindTo?: string }>).detail
      setHubPreselectedIds(ids)
      setHubBindTo(bindTo)
      setHubOpen(true)
    }
    window.addEventListener(OPEN_HUB_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_HUB_EVENT, onOpen)
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
    const onOpen = () => handleOpenForge()
    window.addEventListener('radical:open-forge', onOpen as EventListener)
    return () => window.removeEventListener('radical:open-forge', onOpen as EventListener)
  },[handleOpenForge])

  // The Forge button opens a read-only view instead while an agent runs
  // Forge on this folder over MCP (see persistence/agentForge).
  const closeAgentForge = useCallback(() => closeRunPanel('agent-forge'), [closeRunPanel])
  useEffect(() => {
    const onOpen = () => showRunPanel('agent-forge')
    window.addEventListener('radical:open-agent-forge', onOpen as EventListener)
    return () => window.removeEventListener('radical:open-agent-forge', onOpen as EventListener)
  }, [showRunPanel])

  // The Assay button, shown only while an agent runs Assay with this folder
  // as its central model, opens a read-only view of that run (persistence/agentAssay).
  const closeAgentAssay = useCallback(() => closeRunPanel('agent-assay'), [closeRunPanel])
  useEffect(() => {
    const onOpen = () => showRunPanel('agent-assay')
    window.addEventListener('radical:open-agent-assay', onOpen as EventListener)
    return () => window.removeEventListener('radical:open-agent-assay', onOpen as EventListener)
  }, [showRunPanel])

  const bar = useRef<HTMLDivElement>(null)
  const compact = useMiddleRoom(bar, true, appMode)

  // The toolbar's and the rail's actions, for `>` in Quick Search.
  useRegisterCommands('toolbar', () => {
    const state = () => useDiagramStore.getState()
    const mode = (m: Parameters<typeof setAppMode>[0], title: string) => ({
      id: `mode.${m}`, title, group: 'Perspective', when: () => state().appMode !== m,
      run: () => m === 'designer' || m === 'viewer' ? switchPerspective(m) : setAppMode(m),
    })
    return [
      mode('designer', 'Designer: edit the model'),
      mode('viewer', 'Viewer: explore the model'),
      { id: 'place.presentations', title: 'Presentations: build and play slides', group: 'Perspective', run: openPresentations, when: () => state().appMode !== 'presenter' && state().appMode !== 'metamodel' },
      mode('metamodel', 'Metamodel editor'),
      { id: 'panel.inspector', title: useInspectorNav.getState().open ? 'Inspector: hide the panel' : 'Inspector: show the panel (model quality and changes)', group: 'Panels', keys: INSPECTOR_KEYS,
        run: () => toggleInspector(), when: () => state().appMode !== 'metamodel' && (useInspectorNav.getState().open || inspectorAvailable()) },
      { id: 'check.settings', title: 'Inspector settings… (check.json: goals and rules)', group: 'Settings', run: openCheckSettings },
      { id: 'edit.undo', title: 'Undo', group: 'Edit', keys: '⌘Z', run: () => state().undo(), when: () => state().appMode === 'designer' && state().canUndo },
      { id: 'edit.redo', title: 'Redo', group: 'Edit', keys: '⌘⇧Z', run: () => state().redo(), when: () => state().appMode === 'designer' && state().canRedo },
      { id: 'nav.back', title: 'Go back', group: 'Navigate', keys: 'Alt+←', run: () => goBack(placeGone) },
      { id: 'nav.forward', title: 'Go forward', group: 'Navigate', keys: 'Alt+→', run: () => goForward(placeGone) },
      { id: 'present.start', title: 'Start presentation', group: 'Present', keys: 'F5', run: () => state().startPresentation(), when: () => state().presentationSlides.length > 0 },
      { id: 'models.manage', title: 'Models…', group: 'Models', run: handleManage },
      { id: 'hub.open', title: 'Import from Radical Hub…', group: 'Models', run: handleOpenHub, when: () => state().appMode === 'designer' },
      { id: 'forge.open', title: 'Radical Forge: generate a model from a description', group: 'AI', run: handleOpenForge, when: () => aiReady(loadAISettings()) },
      { id: 'ai.settings', title: 'AI providers…', group: 'AI', run: handleOpenAISettings },
      { id: 'export.png', title: 'Export as PNG', group: 'Export', run: handleExportPNG },
      { id: 'export.svg', title: 'Export as SVG', group: 'Export', run: handleExportSVG },
      { id: 'export.copy', title: 'Copy image to clipboard', group: 'Export', run: () => { void copyToClipboard() } },
      { id: 'settings.theme', title: theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme', group: 'Settings', run: toggleTheme, when: () => !isVSCode },
      { id: 'settings.setup', title: 'Setup: theme, special key, canvas, AI', group: 'Settings', run: openSetup, when: () => !isVSCode },
      { id: 'settings.smartFit', title: autoFitActive ? 'Smart fit: turn off' : 'Smart fit: turn on', group: 'Settings', run: toggleAutoFit },
      { id: 'settings.keepSmart', title: keepSmartOn ? 'Keep smart by default: turn off' : 'Keep smart by default: turn on', group: 'Settings',
        run: () => state().setKeepSmartDefault(!state().keepSmartDefault) },
      { id: 'about', title: 'About Radical Studio', group: 'Help', run: handleOpenAbout },
    ]
  }, [theme, autoFitActive, keepSmartOn, setAppMode, handleManage, handleOpenHub, handleOpenForge, handleOpenAISettings, handleExportPNG, handleExportSVG, copyToClipboard, toggleTheme, toggleAutoFit, handleOpenAbout, isVSCode])

  return (
    <div className={`toolbar${compact ? ' compact' : ''}`} ref={bar}>
      <AISettingsModal open={aiSettingsOpen} onClose={handleCloseAISettings} />
      <AboutDialog open={aboutOpen} onClose={handleCloseAbout} />
      <HubImportModal open={hubOpen} onClose={handleCloseHub} preselectedIds={hubPreselectedIds} bindTo={hubBindTo} />
      <RadicalForgeModal open={runPanel === 'forge'} resume={forgeAside} onClose={handleCloseForge} onBusy={onForgeBusy} />
      <AgentForgeModal open={runPanel === 'agent-forge'} onClose={closeAgentForge} />
      <AgentAssayModal open={runPanel === 'agent-assay'} onClose={closeAgentAssay} />
      <AppMenu
        onManage={handleManage}
        activeDocLabel={activeDoc?.name ?? null}
        activeDocSource={activeDoc?.source ?? null}
        // The other models it depends on (a federation), everywhere. The
        // branch's changes are the Inspector's This branch.
        branch={dependsOnOthers ? <OtherModelsButton /> : null}
        connectionModifier={connectionModifier}
        setConnectionModifier={setConnectionModifier}
        themePref={themePref}
        onThemePref={saveThemePref}
        showTheme={!isVSCode}
        onOpenSetup={openSetup}
        smartFitActive={autoFitActive}
        onToggleSmartFit={toggleAutoFit}
        metamodelActive={appMode === 'metamodel'}
        onToggleMetamodel={() => setAppMode(appMode === 'metamodel' ? 'designer' : 'metamodel')}
        onOpenAISettings={handleOpenAISettings}
        onOpenAbout={handleOpenAbout}
        onOpenHub={handleOpenHub}
        onOpenForge={handleOpenForge}
        onExportPNG={handleExportPNG}
        onExportSVG={handleExportSVG}
        onCopyToClipboard={copyToClipboard}
        exportBusy={exportBusy}
      />
      {/* Undo belongs to Designer: Viewer and Presenter change nothing of
          the model, and the metamodel editor's steps are undone
          back in Designer (shown there, enabled, they did nothing). Fit, zoom
          and Smart Layout are on the canvas (CanvasControls). */}
      {/* Around Quick Search in the middle (App draws it): Undo and Redo
          before it, in Designer; Back, Forward and the History list after
          it, in every perspective. */}
      <div className="toolbar-center">
        {appMode === 'designer' && (
          <div className="toolbar-group toolbar-edit toolbar-center-before" role="group" aria-label="Edit">
            <button className="toolbar-btn toolbar-icon-btn" onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo (⌘Z)">
              <IconUndo />
            </button>
            <button className="toolbar-btn toolbar-icon-btn" onClick={redo} disabled={!canRedo} aria-label="Redo" title="Redo (⌘⇧Z)">
              <IconRedo />
            </button>
          </div>
        )}
        <div className="toolbar-center-after">
          <div className="toolbar-group" role="group" aria-label="Navigate"><NavHistory part="arrows" /></div>
          <div className="toolbar-group"><NavHistory part="list" /></div>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <div className="toolbar-mode-switch">
        {/* Presentations are a place of the rail: open over Designer or
            Viewer, that one stays lit; a click on the other keeps them open
            over it (made over Designer, played over Viewer). */}
        <button
          className={`toolbar-mode-btn${shownPerspective === 'designer' ? ' active' : ''}`}
          onClick={() => switchPerspective('designer')}
          title="Designer perspective — edit the model"
        >
          <IconModelling /><span className="toolbar-label">Designer</span>
        </button>
        <button
          className={`toolbar-mode-btn${shownPerspective === 'viewer' ? ' active' : ''}`}
          onClick={() => switchPerspective('viewer')}
          title="Viewer perspective — explore the model"
        >
          <IconView /><span className="toolbar-label">Viewer</span>
        </button>
      </div>

      <DocumentManagerModal open={managerOpen} onClose={() => setManagerOpen(false)} />
    </div>
  )
}
