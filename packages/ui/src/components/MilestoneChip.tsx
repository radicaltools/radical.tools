import React, { useMemo, useState } from 'react'
import { useDiagramStore } from '../store/diagramStore'
import { keepKeysHere } from './keysHere'

/**
 * The chip that names the milestone shown, with the diff toggle and, once
 * it was edited, "unsaved" and Propagate / New milestone / Discard: the one
 * the canvas draws in its corner, for the views that have no canvas (a
 * table, wiki, hierarchy, matrix or Warnier view). They showed nothing: in
 * a milestone, All elements as a table did not say which, nor that it had
 * unsaved edits.
 */
export function MilestoneChip({ style }: { style?: React.CSSProperties }): React.ReactElement | null {
  const activeSnapshotId = useDiagramStore((s) => s.activeSnapshotId)
  const snapshotName = useDiagramStore((s) =>
    s.activeSnapshotId ? s.snapshots.find((sn) => sn.id === s.activeSnapshotId)?.name : undefined
  )
  const milestoneDirty = useDiagramStore((s) => s.milestoneDirty)
  const appMode = useDiagramStore((s) => s.appMode)
  const commitMilestoneChanges = useDiagramStore((s) => s.commitMilestoneChanges)
  const discardMilestoneChanges = useDiagramStore((s) => s.discardMilestoneChanges)
  const diffHighlight = useDiagramStore((s) => s.diffHighlight)
  const showDiff = useDiagramStore((s) => s.showDiff)
  const toggleShowDiff = useDiagramStore((s) => s.toggleShowDiff)
  const [newName, setNewName] = useState<string | null>(null)
  const stats = useMemo(() => {
    let added = 0, changed = 0, removed = 0
    for (const k of Object.values(diffHighlight)) {
      if (k === 'new') added++
      else if (k === 'changed') changed++
      else if (k === 'removed') removed++
    }
    return { added, changed, removed }
  }, [diffHighlight])

  if (!activeSnapshotId || !snapshotName) return null
  const dirty = milestoneDirty && appMode === 'designer'
  const button: React.CSSProperties = { fontSize: 11, padding: '2px 6px', cursor: 'pointer', border: '1px solid var(--border-color)', borderRadius: 3 }
  const saveNew = (name: string): void => { commitMilestoneChanges('new', name); setNewName(null) }

  return (
    <div
      className="milestone-chip"
      role="status"
      aria-label={`Milestone ${snapshotName}`}
      style={{
        fontSize: 11,
        color: 'var(--text-muted)',
        background: 'var(--bg-panel)',
        border: `1px solid ${dirty ? 'var(--accent)' : 'var(--border-color)'}`,
        padding: '4px 8px',
        borderRadius: 4,
        display: 'flex',
        gap: 6,
        alignItems: 'center',
        ...style,
      }}
    >
      <span style={{ color: 'var(--accent)', fontSize: 10 }}>●</span>
      <span>
        Milestone: <strong style={{ color: 'var(--text-primary)' }}>{snapshotName}</strong>
        {dirty && <span style={{ color: 'var(--accent)', marginLeft: 4 }}>· unsaved</span>}
      </span>
      <button
        title={showDiff ? 'Hide diff' : 'Show changes vs. previous milestone'}
        onClick={toggleShowDiff}
        style={{ ...button, background: showDiff ? 'var(--accent)' : 'var(--bg-surface)', color: showDiff ? '#fff' : 'var(--text-muted)' }}
      >{showDiff ? '⊙ diff on' : '⊙ diff'}</button>
      {showDiff && (stats.added + stats.changed + stats.removed) > 0 && (
        <span style={{ marginLeft: 2, opacity: 0.9 }}>
          <span style={{ color: '#4ade80' }}>+{stats.added}</span>
          {' '}
          <span style={{ color: '#fb923c' }}>~{stats.changed}</span>
          {' '}
          <span style={{ color: '#f87171' }}>−{stats.removed}</span>
        </span>
      )}
      {dirty && (
        <>
          <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--border-color)', margin: '0 2px' }} />
          <button
            title="Apply changes to this and all later milestones"
            onClick={() => commitMilestoneChanges('propagate')}
            style={{ ...button, border: 'none', background: 'var(--accent)', color: '#fff' }}
          >Propagate</button>
          {newName !== null ? (
            <>
              <input
                autoFocus
                aria-label="New milestone name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  keepKeysHere(e)
                  if (e.key === 'Enter') saveNew(newName)
                  if (e.key === 'Escape') setNewName(null)
                }}
                placeholder="New milestone name…"
                style={{ fontSize: 11, padding: '2px 6px', borderRadius: 3, border: '1px solid var(--border-color)', background: 'var(--bg-input, var(--bg-surface))', color: 'var(--text-primary)', width: 160 }}
              />
              <button onClick={() => saveNew(newName)} style={{ ...button, background: 'var(--bg-surface)', color: 'var(--text-primary)' }}>Save</button>
            </>
          ) : (
            <button
              title="Save as new milestone"
              onClick={() => setNewName(`${snapshotName} (edited)`)}
              style={{ ...button, background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
            >New milestone</button>
          )}
          <button
            title="Discard changes and return to live"
            onClick={discardMilestoneChanges}
            style={{ ...button, background: 'none', color: 'var(--text-muted)' }}
          >Discard</button>
        </>
      )}
    </div>
  )
}
