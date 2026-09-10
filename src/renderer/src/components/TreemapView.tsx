import React, { useMemo, useRef, useEffect, useLayoutEffect, useState, useCallback } from 'react'
import { useDiagramStore } from '../store/diagramStore'
import type { C4Node, C4Relation } from '../types/c4'

// ─── Color palette per C4 type ──────────────────────────────────────────────
const TYPE_COLORS_LIGHT: Record<string, readonly [string, string, string]> = {
  domain:    ['#b8d4f0', '#5a9ad8', '#1a3a5c'],
  system:    ['#bedad8', '#5aa8e0', '#1a3d5c'],
  container: ['#cae0f8', '#7ab4ec', '#1a4060'],
  component: ['#d4eefa', '#8cc4f4', '#1a4560'],
  database:  ['#ddd0f8', '#9c7cdc', '#2e1060'],
  webapp:    ['#b8e8d0', '#54c490', '#0e3d22'],
  queue:     ['#f8e4a8', '#e0b040', '#5a3c00'],
  person:    ['#f8d0cc', '#e07868', '#5c1a14'],
} as const

const TYPE_COLORS_DARK: Record<string, readonly [string, string, string]> = {
  domain:    ['#0a1e38', '#1a4a7a', '#90bcdf'],
  system:    ['#0d3a6e', '#1168bd', '#b0d4f5'],
  container: ['#154f88', '#3880c4', '#c5e2f8'],
  component: ['#1e5f9e', '#5e9fd8', '#daeefb'],
  database:  ['#321060', '#7e3dbf', '#c9a8f0'],
  webapp:    ['#0a3a1e', '#20924f', '#9de2b8'],
  queue:     ['#4a2000', '#c47a10', '#f0c88a'],
  person:    ['#4a0a10', '#b83020', '#f0a8a8'],
} as const

const FALLBACK_COLORS_LIGHT = ['#d4d4ec', '#9090c0', '#1a1a3a'] as const
const FALLBACK_COLORS_DARK  = ['#181830', '#36366a', '#9090b8'] as const

function useIsDarkTheme(): boolean {
  const [dark, setDark] = useState(
    () => document.documentElement.getAttribute('data-theme') !== 'light'
  )
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setDark(document.documentElement.getAttribute('data-theme') !== 'light')
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return dark
}

// ─── Types ──────────────────────────────────────────────────────────────────

type SizeBy = 'leaves' | 'uniform' | 'relations'

interface TNode {
  id:           string
  label:        string
  type:         string
  depth:        number
  value:        number
  relCount:     number
  descendants:  number  // total leaves under this node (1 if leaf)
  children:     TNode[]
  hasKids:      boolean
  rect?:        Rect
}

interface Rect { x: number; y: number; w: number; h: number }

// ─── Build tree ──────────────────────────────────────────────────────────────
// Always builds the WHOLE tree, unconditionally — there is no depth cutoff at
// build time any more. `treemapMaxDepth` is a *render-time* visibility window
// relative to whatever node is currently focused (see `applyViewNow` below),
// so the camera can zoom continuously across a single static layout instead
// of rebuilding a new one every time the focus changes.

function buildTree(
  nodes:      Record<string, C4Node>,
  relCount:   Record<string, number>,
  viewFilter: Set<string> | undefined,
  parentId:   string | undefined,
  depth:      number,
  sizeBy:     SizeBy,
): TNode[] {
  const result: TNode[] = []
  for (const n of Object.values(nodes)) {
    if (n.parentId !== parentId) continue
    if (viewFilter && !viewFilter.has(n.id)) continue
    const children = buildTree(nodes, relCount, viewFilter, n.id, depth + 1, sizeBy)
    const hasKids = children.length > 0
    const rc = relCount[n.id] ?? 0
    const descendants = children.length === 0
      ? 1
      : children.reduce((s, c) => s + c.descendants, 0)
    let value: number
    if (sizeBy === 'uniform') {
      // every sibling weighs the same; parent = number of own children (>=1)
      value = children.length === 0 ? 1 : children.reduce((s, c) => s + c.value, 0)
    } else if (sizeBy === 'relations') {
      // legacy: leaves sized by relation count
      value = children.length === 0
        ? Math.max(1, rc + 1)
        : children.reduce((s, c) => s + c.value, 0)
    } else {
      // 'leaves' (default) — area ∝ number of descendant leaves
      value = descendants
    }
    result.push({ id: n.id, label: n.label, type: n.type, depth, relCount: rc, descendants, children, hasKids, value })
  }
  return result
}

// ─── Squarify layout ────────────────────────────────────────────────────────

function worstRatio(row: number[], side: number): number {
  if (!row.length) return Infinity
  const s  = row.reduce((a, b) => a + b, 0)
  const hi = Math.max(...row)
  const lo = Math.min(...row)
  return Math.max((side * side * hi) / (s * s), (s * s) / (side * side * lo))
}

function squarifySlice(nodes: TNode[], vals: number[], rect: Rect): void {
  if (!nodes.length || rect.w < 1 || rect.h < 1) return
  const { x, y, w, h } = rect
  const isH  = w >= h
  const side = isH ? h : w
  let row: number[] = []
  let cut = 0
  while (cut < vals.length) {
    const next = [...row, vals[cut]]
    if (row.length && worstRatio(next, side) > worstRatio(row, side)) break
    row = next; cut++
  }
  if (!row.length) { row = [vals[0]]; cut = 1 }
  const rSum = row.reduce((a, b) => a + b, 0)
  const rExt = rSum / side
  let off = 0
  for (let i = 0; i < row.length; i++) {
    const len = (row[i] / rSum) * side
    nodes[i].rect = isH
      ? { x, y: y + off, w: rExt, h: len }
      : { x: x + off, y, w: len, h: rExt }
    off += len
  }
  if (cut < nodes.length) {
    squarifySlice(
      nodes.slice(cut), vals.slice(cut),
      isH ? { x: x + rExt, y, w: w - rExt, h } : { x, y: y + rExt, w, h: h - rExt },
    )
  }
}

const GAP        = [3, 2, 1, 1]    // inter-sibling gap per depth level
const OUTER_PAD  = [4, 3, 2, 2]    // gap between a parent's own edge and its children
// Every visible tile can be labeled (see applyViewNow), so a node with
// children reserves extra room at its own top edge — its children are inset
// below this band, never under where its own label sits. Without it, a
// parent's label and its top-left child's tile would land on the same spot.
const LABEL_PAD_TOP = [20, 18, 16, 15]

function applyLayout(nodes: TNode[], rect: Rect, depth: number): void {
  if (!nodes.length || rect.w < 2 || rect.h < 2) return
  nodes.sort((a, b) => b.value - a.value)
  const total = nodes.reduce((s, n) => s + n.value, 0)
  if (!total) return
  squarifySlice(nodes, nodes.map(n => (n.value / total) * rect.w * rect.h), rect)
  // Shrink each tile by a gap to create visible separation between siblings.
  const gap = GAP[Math.min(depth, 3)]
  for (const n of nodes) {
    if (!n.rect) continue
    n.rect = {
      x: n.rect.x + gap,
      y: n.rect.y + gap,
      w: Math.max(0, n.rect.w - gap * 2),
      h: Math.max(0, n.rect.h - gap * 2),
    }
  }
  const pad = OUTER_PAD[Math.min(depth, 3)]
  const padTop = LABEL_PAD_TOP[Math.min(depth, 3)]
  for (const n of nodes) {
    if (!n.rect || !n.children.length) continue
    const inner = {
      x: n.rect.x + pad, y: n.rect.y + padTop,
      w: Math.max(0, n.rect.w - pad * 2),
      h: Math.max(0, n.rect.h - padTop - pad),
    }
    if (inner.w > 4 && inner.h > 4) applyLayout(n.children, inner, depth + 1)
  }
}

function flatten(nodes: TNode[], out: TNode[] = []): TNode[] {
  for (const n of nodes) { out.push(n); flatten(n.children, out) }
  return out
}

type View = [x0: number, y0: number, x1: number, y1: number]

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

// ─── Component ──────────────────────────────────────────────────────────────

const MARGIN = 16

export function TreemapView(): React.ReactElement {
  const isDark          = useIsDarkTheme()
  const TYPE_COLORS     = isDark ? TYPE_COLORS_DARK : TYPE_COLORS_LIGHT
  const FALLBACK_COLORS = isDark ? FALLBACK_COLORS_DARK : FALLBACK_COLORS_LIGHT
  const c4Nodes         = useDiagramStore(s => s.c4Nodes)
  const c4Relations     = useDiagramStore(s => s.c4Relations)
  const activeViewId    = useDiagramStore(s => s.activeViewId)
  const views           = useDiagramStore(s => s.views)
  const selectNode      = useDiagramStore(s => s.selectNode)
  const selectedNodeId  = useDiagramStore(s => s.selectedNodeId)
  const setTreemapFocus = useDiagramStore(s => s.setTreemapFocus)
  const setTreemapSizeBy = useDiagramStore(s => s.setTreemapSizeBy)
  const setTreemapMaxDepth = useDiagramStore(s => s.setTreemapMaxDepth)

  const activeView = activeViewId ? views[activeViewId] : null
  const focusId    = activeView?.treemapFocusId ?? null
  const sizeBy: SizeBy = activeView?.treemapSizeBy ?? 'leaves'
  // null/undefined = unlimited. Default = 2 levels below focus (children +
  // grandchildren) — keeps the view legible; user can change via dropdown.
  // This is now a *render-time* window (see applyViewNow), not a build cutoff.
  const maxDepthRaw = activeView?.treemapMaxDepth
  const maxDepth: number =
    maxDepthRaw === null ? Infinity
    : (typeof maxDepthRaw === 'number' && maxDepthRaw > 0) ? maxDepthRaw
    : 2

  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize]       = useState({ w: 800, h: 600 })
  const [hovered, setHovered] = useState<TNode | null>(null)
  const [mouse, setMouse]     = useState({ x: 0, y: 0 })

  // Track container size
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      setSize({ w: Math.max(1, e.contentRect.width), h: Math.max(1, e.contentRect.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const setFocus = useCallback((id: string | null) => {
    if (!activeViewId) return
    setTreemapFocus(activeViewId, id)
  }, [activeViewId, setTreemapFocus])

  // View filter — show ancestors of every selected nodeId. If the view has no
  // nodes selected at all, fall back to showing the whole model (a fresh
  // treemap view should never be empty).
  const viewFilter = useMemo(() => {
    if (!activeView) return undefined
    if (!activeView.nodeIds || activeView.nodeIds.length === 0) return undefined
    const s = new Set<string>()
    for (const id of activeView.nodeIds) {
      let cur: string | undefined = id
      while (cur && c4Nodes[cur]) { s.add(cur); cur = c4Nodes[cur].parentId }
    }
    return s
  }, [activeView, c4Nodes])

  // Relation count (only needed when sizeBy='relations' or for tooltip meta).
  const relCount = useMemo(() => {
    const rc: Record<string, number> = {}
    for (const r of Object.values(c4Relations) as C4Relation[]) {
      rc[r.sourceId] = (rc[r.sourceId] ?? 0) + 1
      rc[r.targetId] = (rc[r.targetId] ?? 0) + 1
    }
    return rc
  }, [c4Relations])

  // Breadcrumb path: top-level → focused node
  const breadcrumb = useMemo(() => {
    const path: { id: string | null; label: string }[] = [{ id: null, label: 'All' }]
    if (focusId && c4Nodes[focusId]) {
      const chain: C4Node[] = []
      let cur: string | undefined = focusId
      while (cur && c4Nodes[cur]) { chain.unshift(c4Nodes[cur]); cur = c4Nodes[cur].parentId }
      for (const n of chain) path.push({ id: n.id, label: n.label })
    }
    return path
  }, [focusId, c4Nodes])

  // Reset focus if focused node was removed
  useEffect(() => {
    if (focusId && !c4Nodes[focusId]) setFocus(null)
  }, [focusId, c4Nodes, setFocus])

  // Single static layout for the WHOLE tree, rooted at the true top level.
  // Recomputed only when the data, filter, container size or sizing mode
  // change — never when the focus changes. Zooming in/out is purely a camera
  // move over this one layout (see applyViewNow), which is what makes the
  // drill continuous instead of a rebuild-and-crossfade.
  const flatNodes = useMemo(() => {
    const roots = buildTree(c4Nodes, relCount, viewFilter, undefined, 0, sizeBy)
    applyLayout(roots, {
      x: MARGIN, y: MARGIN,
      w: Math.max(1, size.w - MARGIN * 2),
      h: Math.max(1, size.h - MARGIN * 2),
    }, 0)
    return flatten(roots)
  }, [c4Nodes, relCount, viewFilter, size, sizeBy])

  const nodeById = useMemo(() => {
    const m = new Map<string, TNode>()
    for (const n of flatNodes) m.set(n.id, n)
    return m
  }, [flatNodes])

  const outerView = useMemo<View>(() => [
    MARGIN, MARGIN,
    Math.max(MARGIN + 1, size.w - MARGIN),
    Math.max(MARGIN + 1, size.h - MARGIN),
  ], [size])

  const isEmpty = flatNodes.length === 0

  // ── camera-zoom engine ──────────────────────────────────────────────────
  // React creates the <rect>/<text> elements once per flatNodes change (data
  // / size / sizeBy); everything about WHERE they sit on screen and whether
  // they're visible is then owned imperatively by this effect, keyed off
  // `focusId`. Because x/y/width/height are never re-derived from state in
  // JSX (they're set once from the static base layout and never change
  // value), React's reconciliation never touches them again, so mutating
  // them directly here doesn't fight re-renders triggered by anything else
  // (hover, selection, unrelated store updates).
  const rectRefs   = useRef<Map<string, SVGRectElement>>(new Map())
  const textRefs   = useRef<Map<string, SVGTextElement>>(new Map())
  const viewRef     = useRef<View>(outerView)
  const zoomRafRef  = useRef<number | null>(null)
  const prevFocusIdRef = useRef<string | null>(focusId)

  const truncateLabel = useCallback((label: string, widthPx: number): string => {
    const avail = widthPx - 14
    const maxChars = Math.floor(avail / 6.2)
    if (maxChars <= 0) return ''
    if (label.length <= maxChars) return label
    if (maxChars <= 1) return '…'
    return label.slice(0, maxChars - 1) + '…'
  }, [])

  const applyViewNow = useCallback((view: View, focusDepth: number) => {
    const kx = size.w / Math.max(1e-6, view[2] - view[0])
    const ky = size.h / Math.max(1e-6, view[3] - view[1])
    const depthCeiling = maxDepth === Infinity ? Infinity : focusDepth + maxDepth
    for (const n of flatNodes) {
      const r = n.rect
      if (!r) continue
      const rd = n.depth - focusDepth
      const visible = rd >= 0 && n.depth <= depthCeiling
      const x = (r.x - view[0]) * kx
      const y = (r.y - view[1]) * ky
      const w = Math.max(0, r.w * kx)
      const h = Math.max(0, r.h * ky)
      const rectEl = rectRefs.current.get(n.id)
      if (rectEl) {
        rectEl.setAttribute('x', String(x))
        rectEl.setAttribute('y', String(y))
        rectEl.setAttribute('width', String(w))
        rectEl.setAttribute('height', String(h))
        rectEl.style.opacity = visible ? '1' : '0'
        rectEl.style.pointerEvents = visible ? 'auto' : 'none'
      }
      const textEl = textRefs.current.get(n.id)
      if (textEl) {
        // Label every visible tile except the focus's own (rd 0) — that one
        // is covered by its children anyway (its label would sit right where
        // the first child's tile paints) and its name is already in the
        // breadcrumb. Unlike the bubble/square mockup — which only had a
        // single real root — this app can have several independent
        // top-level nodes, so *every* visible level below focus needs its
        // own label, not just the immediate children.
        const showLabel = visible && rd >= 1 && w > 34 && h > 16
        textEl.style.display = showLabel ? 'inline' : 'none'
        if (showLabel) {
          // Nodes with children reserve a top band sized by LABEL_PAD_TOP
          // (see applyLayout) — sit the label inside that band. Leaves have
          // no reserved band, so a smaller fixed inset is enough.
          const labelY = n.hasKids ? LABEL_PAD_TOP[Math.min(n.depth, 3)] - 6 : 15
          textEl.setAttribute('x', String(x + 7))
          textEl.setAttribute('y', String(y + labelY))
          textEl.textContent = truncateLabel(n.label, w)
        }
      }
    }
  }, [flatNodes, size, maxDepth, truncateLabel])

  // Drive the camera to whatever node is focused. Animates on a real focus
  // change; snaps instantly when only the underlying layout changed (resize,
  // data edit, sizeBy) so those never produce a spurious "zoom".
  useLayoutEffect(() => {
    const focusNode  = focusId ? nodeById.get(focusId) : undefined
    const targetView: View = focusNode?.rect
      ? [focusNode.rect.x, focusNode.rect.y, focusNode.rect.x + focusNode.rect.w, focusNode.rect.y + focusNode.rect.h]
      : outerView
    const targetDepth = focusNode ? focusNode.depth : -1

    const changed = prevFocusIdRef.current !== focusId
    prevFocusIdRef.current = focusId

    if (zoomRafRef.current !== null) { cancelAnimationFrame(zoomRafRef.current); zoomRafRef.current = null }

    const reduced = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (!changed || reduced) {
      viewRef.current = targetView
      applyViewNow(targetView, targetDepth)
      return
    }

    const start = viewRef.current
    const duration = 550
    const t0 = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration)
      const e = easeInOutCubic(t)
      const v: View = [
        start[0] + (targetView[0] - start[0]) * e,
        start[1] + (targetView[1] - start[1]) * e,
        start[2] + (targetView[2] - start[2]) * e,
        start[3] + (targetView[3] - start[3]) * e,
      ]
      viewRef.current = v
      applyViewNow(v, targetDepth)
      zoomRafRef.current = t < 1 ? requestAnimationFrame(tick) : null
    }
    zoomRafRef.current = requestAnimationFrame(tick)
  }, [focusId, flatNodes, outerView, nodeById, applyViewNow])

  useEffect(() => () => {
    if (zoomRafRef.current !== null) cancelAnimationFrame(zoomRafRef.current)
  }, [])

  const handleBack = useCallback(() => {
    if (!focusId) return
    setFocus(c4Nodes[focusId]?.parentId ?? null)
  }, [focusId, c4Nodes, setFocus])

  // Keyboard: Esc / Backspace to zoom out one level
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (focusId === null) return
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault()
        handleBack()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusId, handleBack])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    setMouse({ x: e.clientX, y: e.clientY })
  }, [])

  // Single click always selects (leaf or container) — a container's own
  // properties should be reachable without having to drill into it.
  // Double-click is the drilling gesture: on a node with children it zooms
  // in; on the currently-focused node's own tile (the sliver still visible
  // behind its children) it zooms out one level, mirroring the breadcrumb.
  const handleClick = useCallback((n: TNode) => {
    selectNode(n.id)
  }, [selectNode])

  const handleDoubleClick = useCallback((n: TNode) => {
    if (n.id === focusId) setFocus(c4Nodes[n.id]?.parentId ?? null)
    else if (n.hasKids) setFocus(n.id)
  }, [focusId, c4Nodes, setFocus])

  return (
    <div className="treemap-wrap-outer">
      {/* Breadcrumb + controls bar */}
      <div className="treemap-breadcrumb">
        {breadcrumb.map((b, i) => {
          const isLast = i === breadcrumb.length - 1
          return (
            <React.Fragment key={b.id ?? '__root'}>
              {i > 0 && <span className="tm-bc-sep">›</span>}
              <button
                className={`tm-bc-item ${isLast ? 'active' : ''}`}
                onClick={() => setFocus(b.id)}
                disabled={isLast}
                title={isLast ? 'Current root' : `Zoom out to ${b.label}`}
              >
                {b.label}
              </button>
            </React.Fragment>
          )
        })}

        <div className="tm-bc-spacer" />

        <label className="tm-bc-sizeby" title="How to size rectangles">
          Size:
          <select
            value={sizeBy}
            onChange={(e) => activeViewId && setTreemapSizeBy(activeViewId, e.target.value as SizeBy)}
          >
            <option value="leaves">leaves (hierarchy)</option>
            <option value="uniform">uniform</option>
            <option value="relations">relations</option>
          </select>
        </label>

        <label className="tm-bc-sizeby" title="How many descendant levels to render below the current focus">
          Levels:
          <select
            value={maxDepth === Infinity ? 'all' : String(maxDepth)}
            onChange={(e) => {
              if (!activeViewId) return
              const v = e.target.value
              setTreemapMaxDepth(activeViewId, v === 'all' ? null : parseInt(v, 10))
            }}
          >
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="all">all</option>
          </select>
        </label>

        {focusId !== null && (
          <button
            className="tm-bc-back"
            onClick={handleBack}
            title="Zoom out one level (Esc)"
          >
            ↑ Up
          </button>
        )}
      </div>

      <div
        ref={containerRef}
        className="treemap-wrap"
        onMouseMove={onMouseMove}
        onMouseLeave={() => setHovered(null)}
      >
        {isEmpty ? (
          <div className="treemap-empty">
            {focusId ? 'No child elements. Zoom out to navigate.' : 'No elements to display.'}
          </div>
        ) : (
          <svg
            width={size.w} height={size.h}
            style={{ display: 'block', userSelect: 'none' }}
            onClick={() => selectNode(null)}
            onDoubleClick={() => setFocus(null)}
          >
            {/* Pass 1: every rect, painted back-to-front by tree order so a
                parent always sits behind its own children. */}
            <g>
              {flatNodes.map((n) => {
                if (!n.rect) return null
                const [fill, border, fg] = (TYPE_COLORS[n.type] ?? FALLBACK_COLORS) as [string, string, string]
                const isHov = hovered?.id === n.id
                const isSel = selectedNodeId === n.id
                const strokeCol = isSel ? '#ffd84d' : isHov ? fg : border
                const strokeW = isSel ? 2 : isHov ? 1.5 : 0.8
                return (
                  <rect
                    key={n.id}
                    ref={(el) => {
                      if (el) rectRefs.current.set(n.id, el)
                      else rectRefs.current.delete(n.id)
                    }}
                    x={n.rect.x} y={n.rect.y} width={n.rect.w} height={n.rect.h}
                    rx={Math.max(0, 6 - n.depth * 2)}
                    fill={fill} stroke={strokeCol} strokeWidth={strokeW}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHovered(n)}
                    onClick={(e) => { e.stopPropagation(); handleClick(n) }}
                    onDoubleClick={(e) => { e.stopPropagation(); handleDoubleClick(n) }}
                  />
                )
              })}
            </g>
            {/* Pass 2: labels, painted after every rect so a parent's own
                label is never hidden behind its first child's tile. */}
            <g pointerEvents="none" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
              {flatNodes.map((n) => {
                if (!n.rect) return null
                const [, , fg] = (TYPE_COLORS[n.type] ?? FALLBACK_COLORS) as [string, string, string]
                return (
                  <text
                    key={`t-${n.id}`}
                    ref={(el) => {
                      if (el) textRefs.current.set(n.id, el)
                      else textRefs.current.delete(n.id)
                    }}
                    x={n.rect.x + 7} y={n.rect.y + 15}
                    fill={fg}
                    fontSize={11}
                    fontWeight={600}
                    style={{ display: 'none' }}
                  />
                )
              })}
            </g>
          </svg>
        )}

        {/* Tooltip — hierarchy first, relations second */}
        {hovered && hovered.rect && (
          <div
            className="treemap-tooltip"
            style={{ left: mouse.x + 14, top: mouse.y - 10 }}
          >
            <span className="tm-tt-type">{hovered.type}</span>
            <span className="tm-tt-label">{hovered.label}</span>
            <span className="tm-tt-meta">
              depth {hovered.depth}
              {hovered.children.length > 0 && ` · ${hovered.children.length} children`}
              {hovered.hasKids && ` · ${hovered.descendants} leaves`}
            </span>
            {hovered.relCount > 0 && (
              <span className="tm-tt-meta tm-tt-dim">
                {hovered.relCount} relation{hovered.relCount !== 1 ? 's' : ''}
              </span>
            )}
            <span className="tm-tt-hint">
              {hovered.hasKids
                ? 'click → select · double-click → zoom in'
                : 'click → select'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
