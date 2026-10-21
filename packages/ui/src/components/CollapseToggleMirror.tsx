import React, { useLayoutEffect, useRef, useState } from 'react'
import { useStore, type Node } from 'reactflow'
import { useDiagramStore } from '../store/diagramStore'

/** A container's −/+ as drawn inside its node: where (relative to the
 *  node's top-left, in canvas units), how large, and how it looks. */
interface Toggle {
  id: string
  dx: number
  dy: number
  width: number
  height: number
  glyph: string
  style: React.CSSProperties
}

/**
 * The containers' expand / collapse buttons, drawn again above the
 * relations. Edges between elements in different containers are drawn
 * above the containers so they stay visible and clickable, and one could
 * run over a container's −/+ (zoomed out, across the dashed frame's corner,
 * it hid it). React Flow draws each node in a layer of its own, so the
 * button inside it cannot rise above the edges: this draws a copy of each
 * at the button's place, which the pointer passes through to the button
 * (a click on an edge over it is handed to the button, Canvas'
 * onClickCapture).
 *
 * Rendered as a ReactFlow child, outside the viewport element that exports
 * capture, like AlignmentGuides.
 */
export function CollapseToggleMirror(): React.ReactElement | null {
  const [tx, ty, zoom] = useStore((s) => s.transform)
  const nodeInternals = useStore((s) => s.nodeInternals)
  const domNode = useStore((s) => s.domNode)
  const rfNodes = useDiagramStore((s) => s.rfNodes)
  const lowDetail = useDiagramStore((s) => s.lowDetail)
  const [toggles, setToggles] = useState<Toggle[]>([])
  const last = useRef('')

  // Measured where the nodes drew their buttons, after they drew them.
  useLayoutEffect(() => {
    if (!domNode || !zoom) return
    const out: Toggle[] = []
    for (const button of domNode.querySelectorAll<HTMLElement>('.react-flow__node .c4-node-collapse-btn')) {
      const nodeEl = button.closest<HTMLElement>('.react-flow__node')
      const id = nodeEl?.dataset.id
      if (!nodeEl || !id) continue
      const b = button.getBoundingClientRect()
      const n = nodeEl.getBoundingClientRect()
      if (!b.width || !b.height) continue
      const cs = getComputedStyle(button)
      out.push({
        id,
        dx: (b.left - n.left) / zoom,
        dy: (b.top - n.top) / zoom,
        width: b.width / zoom,
        height: b.height / zoom,
        glyph: button.textContent ?? '',
        style: {
          color: cs.color,
          background: cs.backgroundColor,
          border: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`,
          borderRadius: cs.borderTopLeftRadius,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight as React.CSSProperties['fontWeight'],
          lineHeight: cs.lineHeight,
        },
      })
    }
    const key = JSON.stringify(out.map((t) => [t.id, Math.round(t.dx), Math.round(t.dy), Math.round(t.width), t.glyph, t.style.color, t.style.background, t.style.fontSize]))
    if (key === last.current) return
    last.current = key
    setToggles(out)
  }, [domNode, rfNodes, nodeInternals, lowDetail, zoom])

  if (!toggles.length) return null
  return (
    <div className="c4-collapse-mirror-layer" aria-hidden="true">
      {toggles.map((t) => {
        const n = nodeInternals.get(t.id) as (Node & { positionAbsolute?: { x: number; y: number } }) | undefined
        if (!n || n.hidden) return null
        const p = n.positionAbsolute ?? n.position
        return (
          <div
            key={t.id}
            className="c4-collapse-mirror"
            style={{
              ...t.style,
              width: t.width,
              height: t.height,
              transform: `translate(${(p.x + t.dx) * zoom + tx}px, ${(p.y + t.dy) * zoom + ty}px) scale(${zoom})`,
            }}
          >
            {t.glyph}
          </div>
        )
      })}
    </div>
  )
}
