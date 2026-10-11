// ─── What one Radical Forge stage run added to the model ────────────────────
// Regenerate runs a stage again on top of the model, so the previous attempt's
// additions are removed first; otherwise every regeneration stacks a copy.
// Updates and deletions an attempt made are not reverted. Studio reads the ids
// from its store, the MCP server from the folder.

export interface ModelIds {
  nodes: string[]
  relations: string[]
  views: string[]
}

export function modelIdsOf(model: { nodes: Record<string, unknown>; relations: Record<string, unknown>; views: Record<string, unknown> }): ModelIds {
  return { nodes: Object.keys(model.nodes), relations: Object.keys(model.relations), views: Object.keys(model.views) }
}

/** Ids in `now` that were not in `before`. */
export function idsAddedSince(before: ModelIds, now: ModelIds): ModelIds {
  const only = (ids: string[], old: string[]): string[] => {
    const seen = new Set(old)
    return ids.filter((id) => !seen.has(id))
  }
  return { nodes: only(now.nodes, before.nodes), relations: only(now.relations, before.relations), views: only(now.views, before.views) }
}
