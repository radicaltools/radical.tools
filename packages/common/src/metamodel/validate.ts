// ─── Metamodel validator ─────────────────────────────────────────────────

import { C4Node, C4Relation } from '../c4'
import { Metamodel, PropertyDef } from './types'
import { GROUP_TYPE, hasPlaceUnder, placeOf, propertyKeyProblem } from './lookup'
import { validateStateMachines } from './statechart'
import { validateDomainModel } from './domainModel'
import { refIds, refProblem } from './refs'

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
      } else if (parent.type === GROUP_TYPE && !hasPlaceUnder(metamodel, n.type, placeOf(parent, nodes)?.type)) {
        // A group gives no place the element could not have without it. A
        // warning: models made before the rule may hold such elements.
        const place = placeOf(parent, nodes)
        const where = place ? `inside ${metamodel.nodeTypes[place.type]?.label ?? place.type} "${place.label}"` : 'at the top of the model'
        issues.push({
          id: `bad-place:${n.id}`,
          severity: 'warning',
          message: `${def.label} "${n.label}" is in group "${parent.label}", which is ${where}, where a ${def.label} has no place.`,
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

  // Two properties of a type with one key are one field of the element.
  for (const def of [...Object.values(metamodel.nodeTypes), ...Object.values(metamodel.relationTypes)]) {
    const seen = new Set<string>()
    for (const p of def.properties ?? []) {
      if (seen.has(p.key)) {
        const isNode = !!metamodel.nodeTypes[def.id] && metamodel.nodeTypes[def.id] === def
        issues.push({ id: `dup-prop:${def.id}:${p.key}`, severity: 'error', message: `${isNode ? def.label : `Relation type "${def.label}"`}: two properties have the key "${p.key}"; give one another key.`, ...(isNode ? { nodeTypeId: def.id } : {}) })
      }
      seen.add(p.key)
    }
  }

  // A property keyed like a field every element has would edit that field.
  for (const def of Object.values(metamodel.nodeTypes)) {
    for (const p of def.properties ?? []) {
      const problem = propertyKeyProblem(p.key, 'node')
      if (problem) {
        issues.push({ id: `reserved-prop:${def.id}:${p.key}`, severity: 'error', message: `${def.label}: property key ${problem}`, nodeTypeId: def.id })
      }
    }
  }
  for (const def of Object.values(metamodel.relationTypes)) {
    for (const p of def.properties ?? []) {
      const problem = propertyKeyProblem(p.key, 'relation')
      if (problem) {
        issues.push({ id: `reserved-rel-prop:${def.id}:${p.key}`, severity: 'error', message: `Relation type "${def.label}": property key ${problem}` })
      }
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

  // A relation joins two elements of the model, and is of a type the
  // metamodel has (one written through the MCP server's properties bag was
  // neither, and nothing said so).
  for (const r of Object.values(relations)) {
    const missing = [r.sourceId, r.targetId].filter((id) => !nodes[id])
    if (missing.length) {
      issues.push({
        id: `rel-end-missing:${r.id}`,
        severity: 'error',
        message: `Relation "${r.label ?? r.id}" ${missing.length === 2 ? 'has no element at either end' : `points at "${missing[0]}", which is no element of the model`}.`,
        relationId: r.id,
      })
    }
    if (r.relationType && !metamodel.relationTypes[r.relationType]) {
      issues.push({
        id: `unknown-rel-type:${r.id}`,
        severity: 'error',
        message: `Relation "${r.label ?? r.id}" has unknown type "${r.relationType}".`,
        relationId: r.id,
      })
    }
  }

  // A relation that names its type is one that type has between its ends
  // (the check above only asks whether any type has the pair).
  for (const r of Object.values(relations)) {
    const def = r.relationType ? metamodel.relationTypes[r.relationType] : undefined
    const src = nodes[r.sourceId]
    const dst = nodes[r.targetId]
    if (!def || !src || !dst || def.allowedPairs.length === 0) continue
    if (def.allowedPairs.some(p => p.from === src.type && p.to === dst.type)) continue
    issues.push({
      id: `bad-rel-type:${r.id}`,
      severity: 'warning',
      message: `Relation "${src.label}" → "${dst.label}" is "${def.label}", which does not connect ${src.type}→${dst.type}.`,
      relationId: r.id,
    })
  }

  // Reference properties point at existing nodes of their type.
  const checkRefs = (item: Record<string, unknown>, props: PropertyDef[] | undefined, at: { nodeId?: string; relationId?: string }, what: string): void => {
    for (const p of props ?? []) {
      if (p.type !== 'ref') continue
      for (const id of refIds(item[p.key])) {
        const problem = refProblem(p, id, nodes)
        if (problem) {
          issues.push({
            id: `bad-ref:${at.nodeId ?? at.relationId}:${p.key}:${id}`,
            severity: 'warning',
            message: `${what}: "${p.label}" points at nothing valid (${problem}).`,
            ...at,
          })
        }
      }
    }
  }
  for (const n of nodeList) {
    const def = metamodel.nodeTypes[n.type]
    if (def) checkRefs(n as unknown as Record<string, unknown>, def.properties, { nodeId: n.id }, `${def.label} "${n.label}"`)
  }
  for (const r of Object.values(relations)) {
    const def = r.relationType ? metamodel.relationTypes[r.relationType] : undefined
    if (!def) continue
    const src = nodes[r.sourceId]?.label ?? r.sourceId
    const dst = nodes[r.targetId]?.label ?? r.targetId
    checkRefs(r as unknown as Record<string, unknown>, def.properties, { relationId: r.id }, `${def.label} "${src}" → "${dst}"`)
  }

  // Aggregate rules, for metamodels that carry the built-in entity type.
  if (metamodel.nodeTypes.entity && metamodel.relationTypes['part-of']) {
    issues.push(...validateDomainModel(nodes, relations))
  }

  // Statechart rules, for metamodels that carry the built-in behaviour types.
  if (metamodel.nodeTypes.state && metamodel.relationTypes.transition) {
    issues.push(...validateStateMachines(nodes, relations))
  }

  return issues
}
