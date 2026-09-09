// ─── Built-in C4 preset ──────────────────────────────────────────────────
//
// The canonical source of truth for the C4 node types: label, color, icon,
// and default/collapsed sizing are defined here, not in `../../c4` — that
// module's legacy per-type lookup tables are generated FROM the built-in
// presets (see `builtInGovernanceMetamodel`, the superset of all of them).

import { Metamodel, NodeTypeDef, PropertyDef, RelationPair, RelationTypeDef } from '../types'

interface Visual {
  label: string
  color: string
  fg: string
  iconPath: string
  width: number
  height: number
  collapsedWidth: number
  collapsedHeight: number
}

const VISUALS: Record<string, Visual> = {
  person: {
    label: 'Person', color: '#08427b', fg: '#fff',
    iconPath: 'M8 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 12.5C3 10.01 5.24 8 8 8s5 2.01 5 4.5V14H3v-1.5Z',
    width: 150, height: 170, collapsedWidth: 150, collapsedHeight: 170,
  },
  system: {
    label: 'Software System', color: '#1168bd', fg: '#fff',
    iconPath: 'M2 3.5A1.5 1.5 0 0 1 3.5 2h9A1.5 1.5 0 0 1 14 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5v-9ZM4 5h8v1H4V5Zm0 2.5h8v1H4v-1Zm0 2.5h5v1H4V10Z',
    width: 360, height: 260, collapsedWidth: 280, collapsedHeight: 180,
  },
  container: {
    label: 'Container', color: '#438dd5', fg: '#fff',
    iconPath: 'M1 4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1H1V4Zm0 2.5h14V12a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V6.5ZM3 3a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1Zm2 0a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1Z',
    width: 300, height: 200, collapsedWidth: 240, collapsedHeight: 160,
  },
  component: {
    label: 'Component', color: '#85bbf0', fg: '#000',
    iconPath: 'M5 1v2H3a1 1 0 0 0-1 1v2h2v2H2v2h2v2H2v2a1 1 0 0 0 1 1h2v2h2v-2h2v2h2v-2h2a1 1 0 0 0 1-1v-2h-2v-2h2V8h-2V6h2V4a1 1 0 0 0-1-1h-2V1H9v2H7V1H5Z',
    width: 200, height: 120, collapsedWidth: 200, collapsedHeight: 120,
  },
  database: {
    label: 'Database', color: '#438dd5', fg: '#fff',
    iconPath: 'M8 1C4.7 1 2 2.3 2 4v8c0 1.7 2.7 3 6 3s6-1.3 6-3V4c0-1.7-2.7-3-6-3ZM2 4c0 1.7 2.7 3 6 3s6-1.3 6-3',
    width: 190, height: 130, collapsedWidth: 190, collapsedHeight: 130,
  },
  webapp: {
    label: 'Web App', color: '#438dd5', fg: '#fff',
    iconPath: 'M2 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3Zm1 2.5V13h10V5.5H3ZM4 3.5a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1Zm1.5 0a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1Zm1.5 0a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1Z',
    width: 210, height: 140, collapsedWidth: 210, collapsedHeight: 140,
  },
  queue: {
    label: 'Queue', color: '#438dd5', fg: '#fff',
    iconPath: 'M4 3a3 2 0 1 0 0 4h8a3 2 0 1 0 0-4H4Zm-2 5.5a3 2 0 0 0 4 0v-1a3 2 0 0 1-4 0v1Zm10 0a3 2 0 0 0 4 0v-1a3 2 0 0 1-4 0v1Z',
    width: 220, height: 95, collapsedWidth: 220, collapsedHeight: 95,
  },
  group: {
    label: 'Group', color: '#64748b', fg: '#fff',
    // Folder icon.
    iconPath: 'M2 3.5C2 2.67 2.67 2 3.5 2H7l1.5 2h4c.83 0 1.5.67 1.5 1.5v7c0 .83-.67 1.5-1.5 1.5h-9C2.67 14 2 13.33 2 12.5v-9Z',
    width: 520, height: 360, collapsedWidth: 360, collapsedHeight: 220,
  },
}

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
  const types: Array<keyof typeof VISUALS> = [
    'person', 'system', 'container', 'component', 'database', 'webapp', 'queue', 'group',
  ]

  for (const t of types) {
    const props: PropertyDef[] = [
      { key: 'description', label: 'Description', type: 'textarea' },
    ]
    if (techTypes.has(t)) props.push({ key: 'technology', label: 'Technology', type: 'text' })
    if (t !== 'group') props.push({ key: 'external', label: 'External', type: 'boolean' })

    const v = VISUALS[t]
    nodeTypes[t] = {
      id: t,
      label: v.label,
      color: v.color,
      fg: v.fg,
      iconPath: v.iconPath,
      width: v.width,
      height: v.height,
      collapsedWidth: v.collapsedWidth,
      collapsedHeight: v.collapsedHeight,
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
