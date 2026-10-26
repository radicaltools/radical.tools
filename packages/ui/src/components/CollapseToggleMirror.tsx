import React, { useLayoutEffect, useRef, useState } from 'react'
import { useStore, type Node } from 'reactflow'
import { useDiagramStore } from '../store/diagramStore'
import { editingControl } from './editingControl'

/** The buttons drawn inside a node that a relation's line can run over:
 *  a container's −/+ and an exploration element's + and − (ExploreMore). */
const NODE_CONTROLS = '.c4-node-collapse-btn, .explore-more'

/** How far around a control a click still reaches it: the −/+ has a hit
 *  area 10 px beyond its box (CSS), an exploration's + and − none. */
const reachOf = (control: Element): number => control.classList.contains('c4-node-collapse-btn') ? 10 : 0

/**
 * The node control (NODE_CONTROLS) at a point on the screen inside `root`,
 * whatever is drawn over it there: the line of a relation drawn above the
 * elements took the click meant for it.
 */
export function nodeControlAt(root: Element | null | undefined, x: number, y: number): HTMLElement | null {
  for (const control of root?.querySelectorAll<HTMLElement>(NODE_CONTROLS) ?? []) {
    const r = control.getBoundingClientRect()
    const reach = reachOf(control)
    if (!r.width || !r.height) continue
    if (x >= r.left - reach && x <= r.right + reach && y >= r.top - reach && y <= r.bottom + reach) return control
  }
  return null
}

/** A node control as drawn inside its node: where (relative to the node's
 *  top-left, in canvas units), how large, and how it looks. */
interface Toggle {
  key: string
  id: string
  dx: number
  dy: number
  width: number
  height: number
  glyph: string
  style: React.CSSProperties
}

/**
 * The containers' expand / collapse buttons, and the + and − of an
 * exploration's elements, drawn again above the relations. Edges between
 * elements in different containers are drawn above the containers so they
 * stay visible and clickable, and one could run over a container's −/+
 * (zoomed out, across the dashed frame's corner, it hid it); a selected
 * element's lines are drawn above the elements, and one ran over its + in
 * an exploration (F-0012). React Flow draws each node in a layer of its
 * own, so the button inside it cannot rise above the edges: this draws a
 * copy of each at the button's place, which the pointer passes through to
 * the button (a click on an edge over it is handed to the button, Canvas'
 * onClickCapture and nodeControlAt).
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
  // An exploration's + shows a count and whether its menu is open.
  const exploreMore = useDiagramStore((s) => s.exploreMore)
  const exploreFoldable = useDiagramStore((s) => s.exploreFoldable)
  const exploreMenuFor = useDiagramStore((s) => s.exploreMenuFor)
  const [toggles, setToggles] = useState<Toggle[]>([])
  const last = useRef('')

  // Measured where the nodes drew their buttons, after they drew them.
  useLayoutEffect(() => {
    if (!domNode || !zoom) return
    const out: Toggle[] = []
    for (const button of domNode.querySelectorAll<HTMLElement>('.react-flow__node :is(.c4-node-collapse-btn, .explore-more)')) {
      const nodeEl = button.closest<HTMLElement>('.react-flow__node')
      const id = nodeEl?.dataset.id
      if (!nodeEl || !id) continue
      const b = button.getBoundingClientRect()
      const n = nodeEl.getBoundingClientRect()
      if (!b.width || !b.height) continue
      // The copy is what shows: the button under it, a fraction of a pixel
      // off, read as a shadow through the copy's see-through background. It
      // stays where it is to be clicked (opacity leaves its colours to read).
      button.dataset.mirrored = ''
      const cs = getComputedStyle(button)
      out.push({
        key: `${id} ${out.filter((t) => t.id === id).length}`,
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
  }, [domNode, rfNodes, nodeInternals, lowDetail, zoom, exploreMore, exploreFoldable, exploreMenuFor])

  if (!toggles.length) return null
  return (
    <div {...editingControl} className="c4-collapse-mirror-layer" aria-hidden="true">
      {toggles.map((t) => {
        const n = nodeInternals.get(t.id) as (Node & { positionAbsolute?: { x: number; y: number } }) | undefined
        if (!n || n.hidden) return null
        const p = n.positionAbsolute ?? n.position
        return (
          <div
            key={t.key}
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
