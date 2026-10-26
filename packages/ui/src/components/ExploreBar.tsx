import React, { useEffect, useMemo, useRef, useState } from 'react'
import { normalizeViewFolder } from '@radical/common/c4'
import { onExploration, useDiagramStore } from '../store/diagramStore'
import { editingControl } from './editingControl'

/**
 * The bar of an exploration (Explore from here) over the canvas, where a
 * view shows its name: Save as view… (Designer only: Viewer keeps nothing)
 * and × to close it. Save as view asks a name and a folder. Each element
 * grows the exploration by its own + (ExploreMenu).
 */
export function ExploreBar(): React.ReactElement | null {
  const exploration = useDiagramStore((s) => (onExploration(s) ? s.exploration : null))
  const appMode = useDiagramStore((s) => s.appMode)
  const closeExploration = useDiagramStore((s) => s.closeExploration)
  const saveExploration = useDiagramStore((s) => s.saveExploration)
  const views = useDiagramStore((s) => s.views)
  const rootLabel = useDiagramStore((s) => {
    const first = s.exploration?.nodeIds[0]
    return first ? s.c4Nodes[first]?.label : undefined
  })
  const [saving, setSaving] = useState<{ name: string; folder: string } | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const folders = useMemo(() => [...new Set(Object.values(views).map((v) => normalizeViewFolder(v.folder)).filter(Boolean))].sort(), [views])
  // Another exploration, or none: what was being typed for the last goes.
  const explorationId = exploration?.id
  useEffect(() => { setSaving(null) }, [explorationId])
  useEffect(() => { if (saving) nameRef.current?.focus() }, [saving !== null])  // eslint-disable-line react-hooks/exhaustive-deps
  if (!exploration || (appMode !== 'designer' && appMode !== 'viewer')) return null
  const canSave = appMode === 'designer'
  const save = (): void => {
    if (!saving?.name.trim()) return
    if (saveExploration(saving.name, saving.folder)) setSaving(null)
  }
  return (
    <div {...editingControl} className="explore-bar" role="toolbar" aria-label="Exploration">
      <span className="explore-bar-name">
        Explore: <strong>{exploration.name.replace(/^Explore: /, '')}</strong>
      </span>
      {canSave && (
        <button type="button" className="explore-bar-btn" aria-expanded={saving !== null}
          onClick={() => setSaving(saving ? null : { name: `${rootLabel ?? 'Exploration'} context`, folder: '' })}
          title="Keep this exploration as a structure view">
          Save as view…
        </button>
      )}
      <button type="button" className="explore-bar-btn explore-bar-close" onClick={closeExploration}
        aria-label="Close the exploration" title="Close the exploration (it is not kept)">
        ×
      </button>
      {canSave && saving && (
        <form className="explore-bar-save" aria-label="Save as view" onSubmit={(e) => { e.preventDefault(); save() }}
          onKeyDown={(e) => { if (e.key === 'Escape') setSaving(null) }}>
          <label>
            <span>Name</span>
            <input ref={nameRef} value={saving.name} onChange={(e) => setSaving({ ...saving, name: e.target.value })} />
          </label>
          <label>
            <span>Folder</span>
            <input value={saving.folder} list="explore-bar-folders" placeholder="No folder"
              onChange={(e) => setSaving({ ...saving, folder: e.target.value })} />
            <datalist id="explore-bar-folders">
              {folders.map((f) => <option key={f} value={f} />)}
            </datalist>
          </label>
          <button type="submit" className="explore-bar-btn primary" disabled={!saving.name.trim()}>Save</button>
          <button type="button" className="explore-bar-btn" onClick={() => setSaving(null)}>Cancel</button>
        </form>
      )}
    </div>
  )
}
