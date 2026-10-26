import React, { useState, useEffect } from 'react'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { keepKeysHere } from '@radical/ui/components/keysHere'

/**
 * Blocking modal that appears when the user tries to switch milestones
 * while there are unsaved edits. Offers Propagate / Save as new / Discard.
 * The persistent banner was replaced by a compact badge in Canvas.tsx.
 */
export function MilestoneEditOverlay(): React.ReactElement | null {
  const activeSnapshotId = useDiagramStore(s => s.activeSnapshotId)
  const snapshots = useDiagramStore(s => s.snapshots)
  const milestoneDirty = useDiagramStore(s => s.milestoneDirty)
  const promptOpen = useDiagramStore(s => s.milestonePromptOpen)
  const commit = useDiagramStore(s => s.commitMilestoneChanges)
  const discard = useDiagramStore(s => s.discardMilestoneChanges)
  const dismiss = useDiagramStore(s => s.dismissMilestonePrompt)
  const appMode = useDiagramStore(s => s.appMode)

  const active = activeSnapshotId ? snapshots.find(s => s.id === activeSnapshotId) : null
  const idx = activeSnapshotId ? snapshots.findIndex(s => s.id === activeSnapshotId) : -1
  const laterCount = idx >= 0 ? snapshots.length - 1 - idx : 0

  const [newName, setNewName] = useState('')
  useEffect(() => {
    if (active) setNewName(`${active.name} (edited)`)
  }, [active?.id])

  const shown = !!active && appMode === 'designer' && promptOpen && milestoneDirty
  // What had the focus when the question opened (the name of an element
  // just added, being typed) has it again once it is answered.
  useEffect(() => {
    if (!shown) return
    const before = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null
    return () => { if (before?.isConnected) before.focus() }
  }, [shown])

  if (!shown) return null

  return (
    <div className="milestone-modal-backdrop" onClick={dismiss}>
      {/* A modal dialog: Studio's shortcuts stay out of it (dialogKeys). F5
          started a presentation behind it, and its Propagate then took
          the playing slide's model. */}
      <div className="milestone-modal" role="dialog" aria-modal="true" aria-labelledby="milestone-modal-title" onClick={e => e.stopPropagation()}>
        <h3 id="milestone-modal-title" className="milestone-modal-title">Editing milestone &quot;{active.name}&quot;</h3>
        <p className="milestone-modal-text">
          You changed a milestone in the past. How should this be saved?
        </p>
        <div className="milestone-modal-options">
          <button className="milestone-option" onClick={() => commit('propagate')}>
            <div className="milestone-option-title">Propagate to later milestones</div>
            <div className="milestone-option-desc">
              Apply these changes to <strong>{active.name}</strong> and all{' '}
              <strong>{laterCount}</strong> milestone(s) that come after.
            </div>
          </button>
          {/* The name field is beside the button, not in it: in it, a space
              typed into the name pressed the button ("Target 2027" saved as
              "Target", and "2027" went to the canvas). */}
          <div className="milestone-option">
            <button type="button" className="milestone-option-main" onClick={() => commit('new', newName)}>
              <div className="milestone-option-title">Save as new milestone</div>
              <div className="milestone-option-desc">
                Insert a new milestone right after <strong>{active.name}</strong>. Later
                milestones stay unchanged.
              </div>
            </button>
            <input
              className="milestone-option-input"
              aria-label="New milestone name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                keepKeysHere(e)
                if (e.key === 'Enter') { e.preventDefault(); commit('new', newName) }
              }}
              placeholder="New milestone name"
            />
          </div>
          <button className="milestone-option ghost" onClick={discard}>
            <div className="milestone-option-title">Discard changes</div>
            <div className="milestone-option-desc">
              Throw away the edits and return to live HEAD.
            </div>
          </button>
        </div>
        <div className="milestone-modal-footer">
          <button className="milestone-btn ghost" onClick={dismiss}>
            Continue editing (decide later)
          </button>
        </div>
      </div>
    </div>
  )
}
