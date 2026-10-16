import React, { useMemo } from 'react'
import { useDiagramStore } from '../store/diagramStore'
import { C4ElementType, NODE_COLORS, TYPE_LABELS, TYPE_ICON_PATHS } from '@radical/common/c4'
import { NODE_TYPE_CATEGORIES, CUSTOM_CATEGORY, type Metamodel } from '@radical/common/metamodel'

// ── Elements palette ─────────────────────────────────────────────────────────
// A bar down the left side of the canvas, always there in Designer: one chip
// per element type the metamodel has, grouped by category, dragged onto the
// canvas to add an element. One type to a row, its icon and its name beside
// it, the description in the tooltip; each group has its name above its
// types. It lies over the canvas, as the properties card does
// on the right; a canvas taller than it has it scroll.

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
        <svg viewBox="0 0 16 16" width="12" height="12" fill="#fff">
          <path d={iconPath} />
        </svg>
      </div>
      <span className="palette-label">{label}</span>
    </div>
  )
}

export function ElementPalette(): React.ReactElement {
  const metamodel = useDiagramStore((s) => s.metamodel)
  const groups = useMemo(() => paletteGroups(metamodel), [metamodel])
  return (
    <div className="element-palette" role="toolbar" aria-label="Elements" aria-orientation="vertical">
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
  )
}
