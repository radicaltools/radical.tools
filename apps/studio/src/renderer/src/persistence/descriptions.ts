// ─── Descriptions an md folder has not loaded yet ───────────────────────────
//
// A Markdown folder loads element descriptions on demand, so the store's
// nodes lack the ones nobody has opened. Comparing them with another copy
// of the model (the outside-change flash, the branch's changes) needs them.

import type { C4Node } from '@radical/common/c4'
import { deserializeFromMdFolder } from '@radical/common/formats/mdFolder'

/** Descriptions of the files last parsed, keyed by the files object. */
let parsed: { files: Record<string, string>; descriptions: Record<string, string | undefined> } | null = null

/** `nodes` with the descriptions Studio has not read into memory yet (an md
 *  folder loads them on demand) taken from the files they were loaded from,
 *  so a description edited outside counts and an unread one does not. */
export function withDescriptions(
  nodes: Record<string, C4Node>, pending: string[], files: Record<string, string> | undefined,
): Record<string, C4Node> {
  if (!pending.length || !files) return nodes
  if (parsed?.files !== files) {
    parsed = { files, descriptions: Object.fromEntries(deserializeFromMdFolder(files).data.nodes.map((n) => [n.id, n.description])) }
  }
  const out = { ...nodes }
  for (const id of pending) {
    if (out[id] && out[id].description === undefined) out[id] = { ...out[id], description: parsed.descriptions[id] }
  }
  return out
}

