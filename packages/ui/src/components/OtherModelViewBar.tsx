import React from 'react'
import { otherModelViewShown, useDiagramStore } from '../store/diagramStore'
import { OtherModelViewNote } from './RightPanel'

/**
 * The bar over another model's view (a federation) on any view type: whose
 * it is, that it is read-only, and, in Designer, Copy to this model, which
 * makes the model's own copy and opens it.
 */
export function OtherModelViewBar({ style }: { style?: React.CSSProperties }): React.ReactElement | null {
  const view = useDiagramStore(otherModelViewShown)
  const designer = useDiagramStore((s) => s.appMode === 'designer' && !s.presentationActive)
  const copy = useDiagramStore((s) => s.copyOtherModelView)
  if (!view?.origin) return null
  return <OtherModelViewNote className="other-model-bar" origin={view.origin} onCopy={designer ? () => { copy(view.id) } : undefined} style={style} />
}
