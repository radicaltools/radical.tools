// ─── Snapshot / milestone diff helpers ───────────────────────────────────────
//
// Pure diff functions comparing two model states (a milestone "base" vs. the
// live model): structural node/relation changes, sequence-membership changes,
// and the "ghost" maps of elements that existed in the base but not the current
// state. Extracted from diagramStore to keep the store body focused.

import { C4Node, C4Relation, DiagramSequence } from '../types/c4'

export function computeSnapDiff(
  prevNodes: Record<string, C4Node>,
  currNodes: Record<string, C4Node>,
  prevRels: Record<string, C4Relation>,
  currRels: Record<string, C4Relation>,
): Record<string, 'new' | 'changed' | 'removed'> {
  const result: Record<string, 'new' | 'changed' | 'removed'> = {}
  for (const id of Object.keys(currNodes)) {
    if (!prevNodes[id]) {
      result[id] = 'new'
    } else {
      const p = prevNodes[id],
        c = currNodes[id]
      if (
        p.label !== c.label ||
        p.description !== c.description ||
        p.technology !== c.technology ||
        p.type !== c.type ||
        p.parentId !== c.parentId ||
        p.external !== c.external
      ) {
        result[id] = 'changed'
      }
    }
  }
  // Removed nodes: in base but not in current.
  for (const id of Object.keys(prevNodes)) {
    if (!currNodes[id]) result[id] = 'removed'
  }
  for (const id of Object.keys(currRels)) {
    if (!prevRels[id]) {
      result[id] = 'new'
    } else {
      const p = prevRels[id],
        c = currRels[id]
      if (
        p.sourceId !== c.sourceId ||
        p.targetId !== c.targetId ||
        p.label !== c.label ||
        p.technology !== c.technology
      ) {
        result[id] = 'changed'
      }
    }
  }
  // Removed relations: in base but not in current.
  for (const id of Object.keys(prevRels)) {
    if (!currRels[id]) result[id] = 'removed'
  }
  return result
}

/**
 * Compute sequence-level diff: which relation IDs were added to or removed
 * from sequences between two snapshots. Only covers membership changes —
 * structural node/relation changes are handled by computeSnapDiff.
 * Structural diff entries always win; this fills the gaps.
 */
export function computeSeqDiff(
  prevSeqs: Record<string, DiagramSequence> | undefined,
  currSeqs: Record<string, DiagramSequence> | undefined,
): Record<string, 'new' | 'changed' | 'removed'> {
  const result: Record<string, 'new' | 'changed' | 'removed'> = {}
  const prev = prevSeqs ?? {}
  const curr = currSeqs ?? {}
  const allSeqIds = new Set([...Object.keys(prev), ...Object.keys(curr)])
  for (const seqId of allSeqIds) {
    const prevSeq = prev[seqId]
    const currSeq = curr[seqId]
    const prevIds = new Set(prevSeq?.relationIds ?? [])
    const currIds = new Set(currSeq?.relationIds ?? [])
    for (const rid of currIds) if (!prevIds.has(rid)) result[rid] = 'new'
    for (const rid of prevIds) if (!currIds.has(rid) && !result[rid]) result[rid] = 'removed'
    // Check step-description changes for relations present in both sequences at the same position.
    if (prevSeq && currSeq) {
      const len = Math.min(prevSeq.relationIds.length, currSeq.relationIds.length)
      for (let i = 0; i < len; i++) {
        const rid = currSeq.relationIds[i]
        if (rid !== prevSeq.relationIds[i]) continue // position shifted – skip
        if (result[rid]) continue // already 'new' or 'removed'
        const prevDesc = prevSeq.stepDescriptions?.[i] ?? ''
        const currDesc = currSeq.stepDescriptions?.[i] ?? ''
        if (prevDesc !== currDesc) result[rid] = 'changed'
      }
    }
  }
  return result
}

/**
 * Build the ghost maps for a diff: nodes/relations that existed in the base
 * but are not present in the current state. Returned as plain dictionaries
 * so they can be merged into the canvas at render time without polluting
 * the actual model.
 */
export function computeDiffGhosts(
  baseNodes: Record<string, C4Node>,
  currNodes: Record<string, C4Node>,
  baseRels: Record<string, C4Relation>,
  currRels: Record<string, C4Relation>,
): { nodes: Record<string, C4Node>; relations: Record<string, C4Relation> } {
  const nodes: Record<string, C4Node> = {}
  const relations: Record<string, C4Relation> = {}
  for (const id of Object.keys(baseNodes)) {
    if (!currNodes[id]) nodes[id] = JSON.parse(JSON.stringify(baseNodes[id]))
  }
  for (const id of Object.keys(baseRels)) {
    if (!currRels[id]) relations[id] = JSON.parse(JSON.stringify(baseRels[id]))
  }
  return { nodes, relations }
}
