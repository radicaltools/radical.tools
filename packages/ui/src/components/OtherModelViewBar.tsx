import React from 'react'
import { otherModelViewShown, useDiagramStore } from '../store/diagramStore'
import { OtherModelViewNote } from './RightPanel'

/**
 * The bar above another model's view (a federation) on any view type: whose
 * it is, that it is read-only, and, in Designer, Copy to this model, which
 * makes the model's own copy and opens it. A strip of its own, so that it
 * lies over none of the view's controls.
 */
export function OtherModelViewBar({ style }: { style?: React.CSSProperties }): React.ReactElement | null {
  const view = useDiagramStore(otherModelViewShown)
  const designer = useDiagramStore((s) => s.appMode === 'designer' && !s.presentationActive)
  const copy = useDiagramStore((s) => s.copyOtherModelView)
  if (!view?.origin) return null
  return (
    <div className="other-model-strip" style={style}>
      <OtherModelViewNote className="other-model-bar" origin={view.origin} onCopy={designer ? () => { copy(view.id) } : undefined} />
    </div>
  )
}
