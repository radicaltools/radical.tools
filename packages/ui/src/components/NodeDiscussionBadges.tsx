import React from 'react'
import { useStore } from 'reactflow'
import type { NodeDiscussionCounts } from '@radical/common/discussions'
import { editingControl } from './editingControl'

/** Screen-sized controls above relations, outside the viewport and left out
 * of an export (Studio's useExport). They follow node geometry without
 * changing its size or model data. */
export function NodeDiscussionBadges({ counts, onDiscuss }: { counts: NodeDiscussionCounts; onDiscuss: (nodeId: string) => void }): React.ReactElement | null {
  const [tx, ty, zoom] = useStore((s) => s.transform)
  const nodes = useStore((s) => s.nodeInternals)
  const width = useStore((s) => s.width)
  const height = useStore((s) => s.height)
  const buttons: React.ReactElement[] = []
  for (const [id, count] of Object.entries(counts)) {
    const node = nodes.get(id)
    if (!count.total || !node || node.hidden || !node.width) continue
    const position = node.positionAbsolute ?? node.position
    const left = (position.x + node.width) * zoom + tx + 8
    const top = position.y * zoom + ty - 8
    // Keep offscreen indicators out of the keyboard's tab order.
    if (left < 0 || left > width || top < 0 || top > height) continue
    const label = node.data.label ?? id
    const summary = `${count.total} discussion ${count.total === 1 ? 'thread' : 'threads'}, ${count.open ? `${count.open} open` : 'all resolved'}`
    buttons.push(
      <button key={id} type="button" data-discussion-node={id}
        className={`node-discussion-badge nodrag nopan${count.open ? '' : ' all-resolved'}${node.className?.includes('focus-dim') ? ' focus-dim' : ''}`}
        style={{ left, top }} title={summary} aria-label={`Open discussions for ${label}: ${summary}`}
        onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onClick={(event) => { event.stopPropagation(); onDiscuss(id) }}>
        <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 3h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H8l-5 3v-3.3A2 2 0 0 1 2 12V5a2 2 0 0 1 2-2Z" />
          <path d="M6 7h8M6 10h5" />
        </svg>
      </button>,
    )
  }
  return buttons.length ? <div {...editingControl} className="node-discussion-badges" role="group" aria-label="Node discussions">{buttons}</div> : null
}
