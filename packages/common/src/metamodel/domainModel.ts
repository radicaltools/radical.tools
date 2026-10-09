// ─── Domain model rules ─────────────────────────────────────────────────────
//
// Checks the aggregates of a DDD domain model, which allowedPairs cannot:
// a part (`part-of`) belongs to exactly one aggregate root, an aggregate root
// is part of nothing (aggregates refer to each other with `references`), and
// an entity that is not a root sits in an aggregate. Issues are warnings,
// like the rest of the soft validation.

import type { C4Node, C4Relation } from '../c4'
import type { Issue } from './validate'

const kindOf = (n: C4Node): string => {
  const kind = (n as unknown as Record<string, unknown>).kind
  return typeof kind === 'string' && kind ? kind : 'aggregate-root'
}

export function validateDomainModel(
  nodes: Record<string, C4Node>,
  relations: Record<string, C4Relation>,
): Issue[] {
  const entities = Object.values(nodes).filter((n) => n.type === 'entity')
  if (entities.length === 0) return []
  const issues: Issue[] = []
  const warn = (id: string, message: string, at: { nodeId?: string; relationId?: string }): void => {
    issues.push({ id, severity: 'warning', message, ...at })
  }

  const rootsOf = new Map<string, string[]>()
  for (const r of Object.values(relations)) {
    if (r.relationType !== 'part-of') continue
    const part = nodes[r.sourceId]
    const root = nodes[r.targetId]
    if (part?.type !== 'entity' || root?.type !== 'entity') continue
    if (kindOf(part) === 'aggregate-root') {
      warn(`ddd-root-part-of:${r.id}`, `Aggregate root "${part.label}" is part of "${root.label}"; aggregates refer to each other with "references" instead.`, { relationId: r.id })
      continue
    }
    if (kindOf(root) !== 'aggregate-root') {
      warn(`ddd-part-of-entity:${r.id}`, `"${part.label}" is part of "${root.label}", which is not an aggregate root.`, { relationId: r.id })
    }
    rootsOf.set(part.id, [...(rootsOf.get(part.id) ?? []), root.label])
  }

  for (const entity of entities) {
    if (kindOf(entity) !== 'entity') continue
    const roots = rootsOf.get(entity.id) ?? []
    if (roots.length === 0) {
      warn(`ddd-loose-entity:${entity.id}`, `Entity "${entity.label}" is not an aggregate root and part of no aggregate; link it to its root with "part-of", or make it a root.`, { nodeId: entity.id })
    } else if (roots.length > 1) {
      warn(`ddd-many-roots:${entity.id}`, `Entity "${entity.label}" is part of ${roots.length} aggregates (${roots.join(', ')}); it belongs to one.`, { nodeId: entity.id })
    }
  }
  return issues
}
