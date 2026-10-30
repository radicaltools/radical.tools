import React, { useMemo } from 'react'
import { CANVAS_MAX_ELEMENTS, type DiagramView } from '@radical/common/c4'
import { oversizedCanvas, useDiagramStore } from '../store/diagramStore'

/** Asks the left panel to open a view's properties (detail: the view id). */
export const OPEN_VIEW_PROPERTIES_EVENT = 'radical:open-view-properties'

/** The canvas view shown and its count, when it has more elements than a
 *  canvas draws (oversizedCanvas); null otherwise. */
export function useOversizedCanvas(): { view: DiagramView; count: number } | null {
  const view = useDiagramStore((s) => (s.activeViewId ? s.views[s.activeViewId] : undefined))
  const nodes = useDiagramStore((s) => s.c4Nodes)
  const relations = useDiagramStore((s) => s.c4Relations)
  return useMemo(() => oversizedCanvas({ activeViewId: view?.id ?? null, views: view ? { [view.id]: view } : {}, c4Nodes: nodes, c4Relations: relations }), [view, nodes, relations])
}

/** In place of a canvas with more elements than a canvas draws: how many,
 *  and the ways on (a table shows any number). */
export function LargeCanvasNotice({ view, count, readOnly }: { view: DiagramView; count: number; readOnly?: boolean }): React.ReactElement {
  const setViewKind = useDiagramStore((s) => s.setViewKind)
  return (
    <main className="lcn-wrap" aria-label="View too large for a canvas">
      <div className="lcn-box">
        <div className="lcn-title">{view.name} shows {count.toLocaleString('en')} elements</div>
        <div className="lcn-sub">
          A canvas draws up to {CANVAS_MAX_ELEMENTS.toLocaleString('en')}. {readOnly ? 'Open it in Designer to show it as a table or to narrow its filter.' : 'Show the view as a table, which shows any number, or narrow its filter.'}
        </div>
        {!readOnly && (
          <div className="lcn-actions">
            <button type="button" className="lcn-btn lcn-primary" onClick={() => setViewKind(view.id, 'table')}>Show as a table</button>
            <button type="button" className="lcn-btn" onClick={() => window.dispatchEvent(new CustomEvent(OPEN_VIEW_PROPERTIES_EVENT, { detail: view.id }))}>Edit the filter</button>
          </div>
        )}
      </div>
    </main>
  )
}
