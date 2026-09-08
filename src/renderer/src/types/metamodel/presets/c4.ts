// ─── Built-in C4 preset ──────────────────────────────────────────────────
//
// Generated from the legacy per-type constants in `../../c4` so existing
// models keep working unchanged.

import {
  NODE_COLORS,
  NODE_FG,
  TYPE_LABELS,
  TYPE_ICON_PATHS,
  NODE_SIZES,
  COLLAPSED_HEIGHT,
  COLLAPSED_WIDTH,
} from '../../c4'
import { Metamodel, NodeTypeDef, PropertyDef, RelationPair, RelationTypeDef } from '../types'

export function builtInC4Metamodel(): Metamodel {
  const nodeTypes: Record<string, NodeTypeDef> = {}

  // C4 containment rules:
  //  • person                    → root only, or inside a group
  //  • system                    → root OR inside another system / group
  //  • container                 → inside a system or group
  //  • component                 → inside a container or group
  //  • database / webapp / queue → inside a system or group
  //  • group                     → root OR inside another group (recursive,
  //                                purely organisational — no semantics)
  const allowedParentsMap: Record<string, string[] | undefined> = {
    person:    ['group'],
    system:    ['system', 'group'],
    container: ['system', 'group'],
    component: ['container', 'webapp', 'group'],
    database:  ['system', 'group'],
    webapp:    ['system', 'group'],
    queue:     ['system', 'group'],
    group:     ['group'],
  }

  const techTypes = new Set(['container', 'component', 'database', 'webapp', 'queue'])
  const types: Array<keyof typeof NODE_COLORS> = [
    'person', 'system', 'container', 'component', 'database', 'webapp', 'queue', 'group',
  ]

  for (const t of types) {
    const props: PropertyDef[] = [
      { key: 'description', label: 'Description', type: 'textarea' },
    ]
    if (techTypes.has(t)) props.push({ key: 'technology', label: 'Technology', type: 'text' })
    if (t !== 'group') props.push({ key: 'external', label: 'External', type: 'boolean' })

    nodeTypes[t] = {
      id: t,
      label: TYPE_LABELS[t],
      color: NODE_COLORS[t],
      fg: NODE_FG[t],
      iconPath: TYPE_ICON_PATHS[t],
      width: NODE_SIZES[t].width,
      height: NODE_SIZES[t].height,
      collapsedWidth: COLLAPSED_WIDTH[t],
      collapsedHeight: COLLAPSED_HEIGHT[t],
      allowedParents: allowedParentsMap[t],
      // person, system, and group are top-level concepts and may live at the root.
      allowedAtRoot: t === 'person' || t === 'system' || t === 'group',
      builtin: true,
      properties: props,
    }
  }

  // Relation rules.
  //
  // "Interacts" — any meaningful interaction between C4 elements:
  //   initiator calls/uses/delivers-to a target.
  //   Forbids database → * (passive store, never initiates).
  const interactsPairs: RelationPair[] = [
    // Person interacts with the system surface
    { from: 'person', to: 'system' },
    { from: 'person', to: 'container' },
    { from: 'person', to: 'webapp' },

    // System-level dependencies
    { from: 'system', to: 'person' },
    { from: 'system', to: 'system' },
    { from: 'system', to: 'container' },
    { from: 'system', to: 'database' },
    { from: 'system', to: 'webapp' },
    { from: 'system', to: 'queue' },

    // Container-level calls
    { from: 'container', to: 'person' },
    { from: 'container', to: 'system' },
    { from: 'container', to: 'container' },
    { from: 'container', to: 'database' },
    { from: 'container', to: 'webapp' },
    { from: 'container', to: 'queue' },

    // Web / UI container
    { from: 'webapp', to: 'person' },
    { from: 'webapp', to: 'system' },
    { from: 'webapp', to: 'container' },
    { from: 'webapp', to: 'database' },
    { from: 'webapp', to: 'webapp' },
    { from: 'webapp', to: 'queue' },

    // Queues fan out to consumers
    { from: 'queue', to: 'container' },
    { from: 'queue', to: 'webapp' },
    { from: 'queue', to: 'component' },

    // Component-level calls
    { from: 'component', to: 'component' },
    { from: 'component', to: 'container' },
    { from: 'component', to: 'webapp' },
    { from: 'component', to: 'database' },
    { from: 'component', to: 'queue' },
  ]

  const relationTypes: Record<string, RelationTypeDef> = {
    interacts: {
      id: 'interacts',
      label: 'Interacts',
      allowedPairs: interactsPairs,
      properties: [
        { key: 'technology', label: 'Technology', type: 'text' },
      ],
      builtin: true,
    },
  }

  return { id: 'c4-builtin', name: 'C4 (built-in)', nodeTypes, relationTypes }
}
