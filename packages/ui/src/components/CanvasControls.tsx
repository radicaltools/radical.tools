import React from 'react'
import { useDiagramStore } from '../store/diagramStore'
import { SmartLayoutButton } from './SmartLayoutButton'

// ── Canvas controls ──────────────────────────────────────────────────────────
// Fit all, zoom out, zoom in and Smart Layout act on the canvas only, so they
// sit on it, centred at its bottom, rather than in the toolbar of every view.

const IconFitAll = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M2 5V2h3M11 2h3v3M14 11v3h-3M5 14H2v-3" />
    <rect x="5" y="5" width="6" height="6" rx="1" />
  </svg>
)

const IconZoomIn = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <circle cx="7" cy="7" r="5" />
    <path d="M7 5v4M5 7h4M12 12l2 2" />
  </svg>
)

const IconZoomOut = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <circle cx="7" cy="7" r="5" />
    <path d="M5 7h4M12 12l2 2" />
  </svg>
)

/** `smartLayoutNote` says what Smart Layout does to the model where it saves
 *  nothing (the Hub). */
export function CanvasControls({ smartLayoutNote }: { smartLayoutNote?: string }): React.ReactElement {
  const fitAll = useDiagramStore((s) => s.fitAll)
  const zoomIn = useDiagramStore((s) => s.zoomIn)
  const zoomOut = useDiagramStore((s) => s.zoomOut)
  return (
    <div className="canvas-controls" role="toolbar" aria-label="Canvas">
      <button className="toolbar-btn" onClick={fitAll} title="Fit all visible nodes to viewport">
        <IconFitAll /> Fit All
      </button>
      <button className="toolbar-btn" onClick={zoomOut} title="Zoom out (⌘−)">
        <IconZoomOut />
      </button>
      <button className="toolbar-btn" onClick={zoomIn} title="Zoom in (⌘+)">
        <IconZoomIn />
      </button>
      <SmartLayoutButton readOnlyNote={smartLayoutNote} />
    </div>
  )
}
