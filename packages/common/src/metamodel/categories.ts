// ─── Node type categories ──────────────────────────────────────────────────
//
// How node types are grouped for people: the Elements palette's sections and
// the metamodel diagram's frames. Types not listed here (custom types) fall
// into CUSTOM_CATEGORY.

export interface NodeTypeCategory {
  id: string
  label: string
  /** Node type ids, in display order. */
  types: string[]
}

export const NODE_TYPE_CATEGORIES: readonly NodeTypeCategory[] = [
  { id: 'c4', label: 'C4', types: ['person', 'system', 'container', 'component', 'database', 'webapp', 'queue'] },
  { id: 'domain', label: 'Domain', types: ['domain'] },
  { id: 'governance', label: 'Governance', types: ['adr', 'fitness-fn', 'blueprint'] },
  { id: 'requirements', label: 'Requirements', types: ['need', 'requirement', 'scenario'] },
  { id: 'ux', label: 'UX', types: ['mockup'] },
  { id: 'other', label: 'Other', types: ['group'] },
]

export const CUSTOM_CATEGORY: Omit<NodeTypeCategory, 'types'> = { id: 'custom', label: 'Custom' }

export function nodeTypeCategory(typeId: string): Omit<NodeTypeCategory, 'types'> {
  const cat = NODE_TYPE_CATEGORIES.find((c) => c.types.includes(typeId))
  return cat ? { id: cat.id, label: cat.label } : CUSTOM_CATEGORY
}
