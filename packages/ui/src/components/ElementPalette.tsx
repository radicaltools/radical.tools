import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useDiagramStore } from '../store/diagramStore'
import { C4ElementType, NODE_COLORS, TYPE_LABELS, TYPE_ICON_PATHS } from '@radical/common/c4'
import { NODE_TYPE_CATEGORIES, CUSTOM_CATEGORY, type Metamodel } from '@radical/common/metamodel'

// ── Elements palette ─────────────────────────────────────────────────────────
// The strip above the canvas, and above the table view, in Designer: one chip per element type the
// metamodel has, grouped by category, dragged onto the canvas (or a table
// view) to add an element. Each chip shows its icon with the type's name
// under it, the description in the tooltip; each group has its name centred
// above its chips. When one row is too narrow for them all, the groups wrap
// onto more rows. Its tab on the bottom edge folds it away, as the side
// panels' tabs do.

// Descriptions for built-in C4/DDD types. Custom types fall back to def.description.
const PALETTE_SUBLABELS: Record<string, string> = {
  person:    'Actor / user',
  system:    'Software system',
  container: 'App, DB, service…',
  component: 'Class, module…',
  database:  'Database store',
  webapp:    'Web application',
  queue:     'Message queue / bus',
  domain:    'DDD problem space',
}

// Order: domain first (when present), then standard C4 order, then any custom types last.
const PALETTE_ORDER = ['domain', 'group', 'person', 'system', 'container', 'component', 'database', 'webapp', 'queue']

interface PaletteEntry {
  typeId: string
  label: string
  sublabel: string
  color: string
  iconPath: string
}

/** The palette's groups for a metamodel, in category order; types no
 *  category lists come last under "Custom". */
function paletteGroups(metamodel: Metamodel | null | undefined): Array<{ label: string; items: PaletteEntry[] }> {
  const allTypeIds = metamodel ? Object.keys(metamodel.nodeTypes) : [...PALETTE_ORDER]

  const makeItem = (typeId: string): PaletteEntry => {
    const def = metamodel?.nodeTypes[typeId]
    const t = typeId as C4ElementType
    const builtIn = (TYPE_LABELS as Record<string, string>)[typeId] !== undefined
    return {
      typeId,
      label: def?.label ?? (builtIn ? TYPE_LABELS[t] : typeId),
      sublabel: PALETTE_SUBLABELS[typeId] ?? def?.description ?? '',
      color: builtIn ? NODE_COLORS[t] : (def?.color ?? '#64748b'),
      iconPath: builtIn ? TYPE_ICON_PATHS[t] : (TYPE_ICON_PATHS.system),
    }
  }

  const assignedTypes = new Set(NODE_TYPE_CATEGORIES.flatMap(g => g.types))
  const customTypes = allTypeIds.filter(t => !assignedTypes.has(t) && !metamodel?.nodeTypes[t]?.hubOnly)

  const groups = NODE_TYPE_CATEGORIES
    .map(g => ({ label: g.label, items: g.types.filter(t => allTypeIds.includes(t) && !metamodel?.nodeTypes[t]?.hubOnly).map(makeItem) }))
    .filter(g => g.items.length > 0)

  if (customTypes.length > 0) {
    groups.push({ label: CUSTOM_CATEGORY.label, items: customTypes.map(makeItem) })
  }
  return groups
}

function PaletteItem({ typeId, label, sublabel, color, iconPath }: PaletteEntry) {
  const onDragStart = (event: React.DragEvent) => {
    event.dataTransfer.setData('application/c4-type', typeId)
    event.dataTransfer.effectAllowed = 'copy'
  }
  return (
    <div className="palette-item" draggable onDragStart={onDragStart}
      title={sublabel ? `${label} — ${sublabel}. Drag onto the canvas.` : `${label}. Drag onto the canvas.`}>
      <div className="palette-badge" style={{ background: color }}>
        <svg viewBox="0 0 16 16" width="13" height="13" fill="#fff">
          <path d={iconPath} />
        </svg>
      </div>
      <span className="palette-label">{label}</span>
    </div>
  )
}

const PALETTE_COLLAPSED_KEY = 'radical-palette-collapsed'

/** Whether the palette is folded away, and the toggle; remembered in this
 *  browser, the same for the canvas and the table view. */
export function usePaletteCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(PALETTE_COLLAPSED_KEY) === '1' } catch { return false }
  })
  const toggle = useCallback(() => {
    setCollapsed((c) => {
      try { localStorage.setItem(PALETTE_COLLAPSED_KEY, c ? '0' : '1') } catch { /* not remembered */ }
      return !c
    })
  }, [])
  return [collapsed, toggle]
}

/** The palette's collapse tab on its bottom edge, like the side panels'. */
function PaletteToggle({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <button
      className={`panel-toggle panel-toggle-top${collapsed ? ' collapsed' : ''}`}
      onClick={onToggle}
      title={collapsed ? 'Show the elements' : 'Hide the elements'}
      aria-label={collapsed ? 'Show the elements' : 'Hide the elements'}
      aria-expanded={!collapsed}
    >
      <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        {collapsed ? <path d="M4 6 L8 10 L12 6" /> : <path d="M4 10 L8 6 L12 10" />}
      </svg>
    </button>
  )
}

export function ElementPalette({ collapsed = false, onToggleCollapsed }: {
  collapsed?: boolean
  onToggleCollapsed?: () => void
}): React.ReactElement {
  const metamodel = useDiagramStore((s) => s.metamodel)
  const groups = useMemo(() => paletteGroups(metamodel), [metamodel])

  // One row while it fits, more rows once it does not. Measured on the
  // element itself, before the browser paints.
  const ref = useRef<HTMLDivElement>(null)
  const [wrapped, setWrapped] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || collapsed) return
    const fit = () => {
      const shown = el.classList.contains('wrapped')
      el.classList.remove('wrapped')
      const fits = el.scrollWidth <= el.clientWidth
      el.classList.toggle('wrapped', shown)
      setWrapped(!fits)
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(el)
    return () => observer.disconnect()
  }, [groups, collapsed])

  return (
    <div className={`element-palette${collapsed ? ' collapsed' : ''}`}>
      {!collapsed && (
        <div ref={ref} className={`element-palette-strip${wrapped ? ' wrapped' : ''}`} role="toolbar" aria-label="Elements">
          {groups.map((group) => (
            <div className="palette-group" key={group.label} role="group" aria-label={group.label}>
              <div className="palette-group-label">{group.label}</div>
              <div className="palette-group-items">
                {group.items.map((item) => (
                  <PaletteItem key={item.typeId} {...item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {onToggleCollapsed && <PaletteToggle collapsed={collapsed} onToggle={onToggleCollapsed} />}
    </div>
  )
}
