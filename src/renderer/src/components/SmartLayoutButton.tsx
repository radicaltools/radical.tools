/**
 * Smart Layout trigger + "why this layout?" report popover.
 *
 * Shared between the Studio toolbar (Toolbar.tsx) and the Hub concept
 * preview (hub/HubApp.tsx) — both profiles run the exact same
 * runSmartLayout() ensemble/SA pipeline, so they get the exact same button,
 * live progress label, and ranking popover instead of two independently
 * maintained copies that can drift.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useDiagramStore, type SmartLayoutReport } from '../store/diagramStore'
import type { SmartLayoutProgress } from '../layout/smartLayoutRunner'
import { useOutsideClick } from '../hooks/useOutsideClick'

const IconSmartLayout = () => (
  <svg className="toolbar-btn-accent-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 2v2M8 12v2M2 8h2M12 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4" />
    <circle cx="8" cy="8" r="2" />
  </svg>
)

// Hierarchical tree icon — root branching down to two children, each with two
// leaves. Used when the active view is configured for the nested-tree layout.
const IconTreeLayout = () => (
  <svg className="toolbar-btn-accent-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="2.5" r="1.2" />
    <circle cx="4" cy="8" r="1.2" />
    <circle cx="12" cy="8" r="1.2" />
    <circle cx="2.5" cy="13.5" r="1" />
    <circle cx="5.5" cy="13.5" r="1" />
    <circle cx="10.5" cy="13.5" r="1" />
    <circle cx="13.5" cy="13.5" r="1" />
    <path d="M8 3.7v1.5M8 5.2L4 6.8M8 5.2l4 1.6M4 9.2v1.5M4 10.7l-1.5 1.8M4 10.7l1.5 1.8M12 9.2v1.5M12 10.7l-1.5 1.8M12 10.7l1.5 1.8" />
  </svg>
)

const IconInfo = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="8" r="6.2" />
    <path d="M8 7.2v4M8 5.1v.05" />
  </svg>
)

function smartLayoutProgressLabel(p: SmartLayoutProgress | null): string | null {
  if (!p) return null
  if (p.phase === 'candidates') return `Trying ${p.total} algorithms… ${p.done}/${p.total}`
  if (p.phase === 'refining-a') return 'Refining with simulated annealing…'
  if (p.phase === 'refining-b') return 'Refining containers…'
  return 'Polishing…'
}

/**
 * Surfaces the full candidate ranking that Smart Layout already computes
 * (previously a console.info-only breadcrumb) so the ensemble's reasoning
 * is legible without opening DevTools.
 */
function SmartLayoutReportButton({ report }: { report: SmartLayoutReport }): React.ReactElement {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  useOutsideClick([wrapRef], open, useCallback(() => setOpen(false), []))
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey) }
  }, [open])

  const arrow = ' → '

  return (
    <div className="smart-layout-report-wrap" ref={wrapRef}>
      <button
        className="toolbar-btn toolbar-btn-icon-only"
        onClick={() => setOpen((o) => !o)}
        title="Why this layout? — full ranking of every algorithm Smart Layout tried"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <IconInfo />
      </button>
      {open && (
        <div className="smart-layout-report-popover" role="dialog" aria-label="Smart Layout report">
          <div className="smart-layout-report-header">
            <div className="smart-layout-report-title">Why this layout?</div>
            <div className="smart-layout-report-sub">
              Winner: <strong>{report.winnerName}</strong> · crossings {report.before.crossings}{arrow}{report.after.crossings},
              {' '}overdraws {report.before.overdraws}{arrow}{report.after.overdraws} · {report.planarity.verdict}
              {report.planarity.verdict !== 'planar' && ` (${report.planarity.crossingEdges}/${report.planarity.totalEdges} edges cross)`}
            </div>
            <div className="smart-layout-report-sub">
              Simulated annealing: {report.refinement.before.toFixed(0)}{arrow}{report.refinement.after.toFixed(0)} cost
              {' '}over {report.refinement.iterations} iterations
            </div>
          </div>
          <div className="smart-layout-report-table-wrap">
            <table className="smart-layout-report-table">
              <thead>
                <tr>
                  <th>Algorithm</th>
                  <th title="Composite aesthetic cost — lower is better">Score</th>
                  <th title="Edge crossings (rendered)">Cross</th>
                  <th title="Edge/node overdraws (rendered)">Draw</th>
                </tr>
              </thead>
              <tbody>
                {report.candidates.map((c) => (
                  <tr key={c.name} className={c.name === report.winnerName ? 'winner' : undefined}>
                    <td>{c.name === report.winnerName ? '★ ' : ''}{c.name}</td>
                    <td>{c.composite.toFixed(0)}</td>
                    <td>{c.renderedCrossings}</td>
                    <td>{c.renderedOverdraws}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * The Smart Layout button + its report popover, as one unit. Self-contained
 * (reads everything it needs from the store) so mounting it in Toolbar.tsx
 * or HubApp.tsx behaves identically — callers only decide *when* to mount
 * it (e.g. hide it on treemap/table/wiki views).
 */
export function SmartLayoutButton({ readOnlyNote }: { readOnlyNote?: string } = {}): React.ReactElement {
  const runSmartLayout = useDiagramStore((s) => s.runSmartLayout)
  const isLayoutRunning = useDiagramStore((s) => s.isLayoutRunning)
  const appMode = useDiagramStore((s) => s.appMode)
  const smartLayoutProgress = useDiagramStore((s) => s.smartLayoutProgress)
  const lastSmartLayoutReport = useDiagramStore((s) => s.lastSmartLayoutReport)
  const activeViewLayoutMode = useDiagramStore((s) =>
    s.activeViewId ? s.views[s.activeViewId]?.layoutMode ?? 'auto' : 'auto'
  )

  const baseTitle = activeViewLayoutMode === 'tree'
    ? 'Tree Layout — hierarchical nested-tree arrangement (configured for the active view).'
    : 'Smart Layout — ensemble of layered + semantic algorithms with edge-crossing minimisation, picks the cleanest result.'

  return (
    <>
      <button
        className={`toolbar-btn toolbar-btn-accent${isLayoutRunning ? ' toolbar-btn-busy' : ''}`}
        onClick={() => { void runSmartLayout() }}
        disabled={isLayoutRunning || appMode === 'metamodel'}
        title={readOnlyNote ? `${baseTitle} ${readOnlyNote}` : baseTitle}
      >
        {isLayoutRunning && activeViewLayoutMode !== 'tree' ? (
          <><span className="toolbar-btn-spin"><IconSmartLayout /></span> {smartLayoutProgressLabel(smartLayoutProgress) ?? 'Working…'}</>
        ) : activeViewLayoutMode === 'tree' ? (
          <><IconTreeLayout /> Tree Layout</>
        ) : (
          <><IconSmartLayout /> Smart Layout</>
        )}
      </button>
      {!isLayoutRunning && activeViewLayoutMode !== 'tree' && lastSmartLayoutReport && (
        <SmartLayoutReportButton report={lastSmartLayoutReport} />
      )}
    </>
  )
}
