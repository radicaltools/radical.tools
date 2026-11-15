import React, { useMemo } from 'react'
import { CANVAS_MAX_ELEMENTS, type DiagramView } from '@radical/common/c4'
import { viewpointsOf } from '@radical/common/viewpoints'
import { oversizedCanvas, setByGroup, useDiagramStore } from '../store/diagramStore'

/** Asks the left panel to open a view's properties (detail: the view id). */
export const OPEN_VIEW_PROPERTIES_EVENT = 'radical:open-view-properties'

/** The viewpoint the Metamodel editor opens on next, its card open (the
 *  notice's Edit the viewpoint); null for none. */
let viewpointToEdit: string | null = null

/** The viewpoint the Metamodel editor was asked to open on, once. */
export function takeViewpointToEdit(): string | null {
  const id = viewpointToEdit
  viewpointToEdit = null
  return id
}

/** The canvas view shown and its count, when it has more elements than a
 *  canvas draws (oversizedCanvas); null otherwise. */
export function useOversizedCanvas(): { view: DiagramView; count: number } | null {
  const view = useDiagramStore((s) => (s.activeViewId ? s.views[s.activeViewId] : undefined))
  // Only the count: the elements change every frame while the live layout
  // moves them, and the app around the canvas drew again each time.
  const count = useDiagramStore((s) => oversizedCanvas(s)?.count ?? 0)
  return useMemo(() => (view && count ? { view, count } : null), [view, count])
}

/** In place of a canvas with more elements than a canvas draws: how many,
 *  and the ways on (a table shows any number). One of a group's views per
 *  element takes its view type and filter from the group's viewpoint
 *  (setByGroup): its way on is the viewpoint, where Show as a table and
 *  Edit the filter did nothing (F-0159). */
export function LargeCanvasNotice({ view, count, readOnly }: { view: DiagramView; count: number; readOnly?: boolean }): React.ReactElement {
  const setViewKind = useDiagramStore((s) => s.setViewKind)
  const setAppMode = useDiagramStore((s) => s.setAppMode)
  const byGroup = useDiagramStore((s) => setByGroup(s, view.id))
  const viewpoint = useDiagramStore((s) => (view.viewpoint ? viewpointsOf(s.metamodel).find((t) => t.id === view.viewpoint) : undefined))
  const group = useDiagramStore((s) => (view.partOf ? s.views[view.partOf] : undefined))
  const ofGroup = byGroup
    ? `It is one of the views of ${group?.name ?? 'a group'}, whose viewpoint${viewpoint ? ` ${viewpoint.label}` : ''} sets its view type and filter. `
    : ''
  const ways = byGroup
    ? readOnly ? 'Open the metamodel in Designer to make the viewpoint a table or to narrow its filter.' : 'Make the viewpoint a table, which shows any number, or narrow its filter: every view of the group follows it.'
    : readOnly ? 'Open it in Designer to show it as a table or to narrow its filter.' : 'Show the view as a table, which shows any number, or narrow its filter.'
  return (
    <main className="lcn-wrap" aria-label="View too large for a canvas">
      <div className="lcn-box">
        <div className="lcn-title">{view.name} shows {count.toLocaleString('en')} elements</div>
        <div className="lcn-sub">
          A canvas draws up to {CANVAS_MAX_ELEMENTS.toLocaleString('en')}. {ofGroup}{ways}
        </div>
        {!readOnly && byGroup && viewpoint && (
          <div className="lcn-actions">
            <button type="button" className="lcn-btn lcn-primary" onClick={() => { viewpointToEdit = viewpoint.id; setAppMode('metamodel') }}>Edit the viewpoint</button>
          </div>
        )}
        {!readOnly && !byGroup && (
          <div className="lcn-actions">
            <button type="button" className="lcn-btn lcn-primary" onClick={() => setViewKind(view.id, 'table')}>Show as a table</button>
            <button type="button" className="lcn-btn" onClick={() => window.dispatchEvent(new CustomEvent(OPEN_VIEW_PROPERTIES_EVENT, { detail: view.id }))}>Edit the filter</button>
          </div>
        )}
      </div>
    </main>
  )
}
