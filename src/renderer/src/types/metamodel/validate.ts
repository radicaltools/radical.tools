// ─── Metamodel validator ─────────────────────────────────────────────────

import { C4Node, C4Relation } from '../c4'
import { Metamodel } from './types'

export type IssueSeverity = 'error' | 'warning'

export interface Issue {
  id: string
  severity: IssueSeverity
  message: string
  nodeId?: string
  relationId?: string
  nodeTypeId?: string
}

export function validateModel(
  nodes: Record<string, C4Node>,
  relations: Record<string, C4Relation>,
  metamodel: Metamodel,
): Issue[] {
  const issues: Issue[] = []
  const nodeList = Object.values(nodes)

  for (const n of nodeList) {
    const def = metamodel.nodeTypes[n.type]
    if (!def) {
      issues.push({
        id: `unknown-type:${n.id}`,
        severity: 'error',
        message: `Node "${n.label}" has unknown type "${n.type}".`,
        nodeId: n.id,
      })
      continue
    }

    // Parent check
    const allowed = def.allowedParents
    if (n.parentId) {
      const parent = nodes[n.parentId]
      if (!parent) {
        issues.push({
          id: `parent-missing:${n.id}`,
          severity: 'error',
          message: `Node "${n.label}" references a missing parent.`,
          nodeId: n.id,
        })
      } else if (allowed && !allowed.includes(parent.type)) {
        const parentLabel = metamodel.nodeTypes[parent.type]?.label ?? parent.type
        issues.push({
          id: `bad-parent:${n.id}`,
          severity: 'error',
          message: `${def.label} "${n.label}" cannot be inside ${parentLabel}. Allowed parents: ${allowed.length ? allowed.join(', ') : '(none — must be root)'}.`,
          nodeId: n.id,
        })
      }
    } else if (def.allowedAtRoot === false || (def.allowedAtRoot === undefined && allowed && allowed.length > 0)) {
      issues.push({
        id: `needs-parent:${n.id}`,
        severity: 'error',
        message: `${def.label} "${n.label}" must be inside ${allowed && allowed.length ? allowed.join(' or ') : 'a parent'}.`,
        nodeId: n.id,
      })
    }

    // Required properties
    for (const p of def.properties ?? []) {
      if (!p.required) continue
      const v = (n as unknown as Record<string, unknown>)[p.key]
      if (v == null || v === '') {
        issues.push({
          id: `missing-prop:${n.id}:${p.key}`,
          severity: 'warning',
          message: `${def.label} "${n.label}" is missing required property "${p.label}".`,
          nodeId: n.id,
        })
      }
    }
  }

  // Type cardinality
  for (const def of Object.values(metamodel.nodeTypes)) {
    const c = def.cardinality
    if (!c) continue
    const count = nodeList.filter(n => n.type === def.id).length
    if (c.min != null && count < c.min) {
      issues.push({
        id: `cardinality-min:${def.id}`,
        severity: 'warning',
        message: `Model has ${count} ${def.label} (minimum ${c.min}).`,
        nodeTypeId: def.id,
      })
    }
    if (c.max != null && count > c.max) {
      issues.push({
        id: `cardinality-max:${def.id}`,
        severity: 'warning',
        message: `Model has ${count} ${def.label} (maximum ${c.max}).`,
        nodeTypeId: def.id,
      })
    }
  }

  // Relation pair check.
  // Current data model has no explicit per-relation type tag, so we treat the
  // metamodel's relation types as a UNION of allowed pairs: a relation is
  // valid iff (a) at least one relation type allows any pair, OR (b) some
  // restrictive type explicitly lists the (from, to) pair.
  const restrictiveTypes = Object.values(metamodel.relationTypes).filter(rt => rt.allowedPairs.length > 0)
  const anyAllows = Object.values(metamodel.relationTypes).some(rt => rt.allowedPairs.length === 0)
  if (restrictiveTypes.length > 0 && !anyAllows) {
    for (const r of Object.values(relations)) {
      const src = nodes[r.sourceId]
      const dst = nodes[r.targetId]
      if (!src || !dst) continue
      const ok = restrictiveTypes.some(rt =>
        rt.allowedPairs.some(p => p.from === src.type && p.to === dst.type),
      )
      if (!ok) {
        issues.push({
          id: `bad-rel:${r.id}`,
          severity: 'warning',
          message: `Relation "${src.label}" → "${dst.label}" (${src.type}→${dst.type}) is not allowed by metamodel.`,
          relationId: r.id,
        })
      }
    }
  }

  return issues
}
