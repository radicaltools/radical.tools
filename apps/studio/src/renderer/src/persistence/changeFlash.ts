// ─── Outside changes flash ───────────────────────────────────────────────────
//
// When the active folder document is reloaded because something outside
// Studio changed it (an MCP client, an editor, git), what changed is shown for
// a few seconds with the milestone diff overlay: new and changed elements get
// their badge, removed ones come back as ghosts. Changes arriving in a burst
// (an agent at work) add up, and the highlight goes FLASH_MS after the last
// one. Layout alone does not count. Nothing is saved. Imported for its side
// effects by main.tsx (and by the test setup).

import type { C4Node, C4Relation } from '@radical/common/c4'
import { deserializeFromMdFolder } from '@radical/common/formats/mdFolder'
import { computeDiffGhosts, computeSnapDiff, useDiagramStore } from '@radical/ui/store/diagramStore'
import { documents } from '../store/documentStore'
import { onOutsideEditLoaded } from './autosave'

type ChangeKind = 'new' | 'changed' | 'removed'

let flashMs = 5000

/** How long the highlight stays after the last change (tests shorten it). */
export function setChangeFlashDuration(ms: number): void {
  flashMs = ms
}

/** What is on the canvas now; null when nothing is flashing. */
let flash: {
  highlight: Record<string, ChangeKind>
  ghostNodes: Record<string, C4Node>
  ghostRelations: Record<string, C4Relation>
  /** The diff toggle as it was before the flash. */
  showDiff: boolean
} | null = null
let timer: ReturnType<typeof setTimeout> | null = null

/** Descriptions of the files last parsed, keyed by the files object. */
let parsed: { files: Record<string, string>; descriptions: Record<string, string | undefined> } | null = null

/** `nodes` with the descriptions Studio has not read into memory yet (an md
 *  folder loads them on demand) taken from the files they were loaded from,
 *  so a description edited outside counts and an unread one does not. */
function withDescriptions(
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

/** Takes the highlight down, unless a milestone's diff has the overlay now. */
function end(): void {
  timer = null
  const shown = flash
  flash = null
  const s = useDiagramStore.getState()
  if (!shown || s.diffHighlight !== shown.highlight) return
  useDiagramStore.setState({ diffHighlight: {}, diffGhostNodes: {}, diffGhostRelations: {}, showDiff: shown.showDiff })
  s._sync()
}

onOutsideEditLoaded((before) => {
  const s = useDiagramStore.getState()
  if (s.activeSnapshotId) return // a milestone being viewed has the overlay
  const prevNodes = withDescriptions(before.nodes, before.pendingBodies, before.files)
  const nodes = withDescriptions(s.c4Nodes, documents.getPendingBodyNodeIds(before.id), documents.loadedFolderFiles(before.id))
  const relations = s.c4Relations as Record<string, C4Relation>
  const diff = computeSnapDiff(prevNodes, nodes, before.relations, relations)
  if (!Object.keys(diff).length) return

  // Add up with what is still flashing: an element added and then changed is
  // still new, one added and removed again is gone without a trace.
  const highlight: Record<string, ChangeKind> = { ...(flash?.highlight ?? {}) }
  const ghostNodes: Record<string, C4Node> = { ...(flash?.ghostNodes ?? {}) }
  const ghostRelations: Record<string, C4Relation> = { ...(flash?.ghostRelations ?? {}) }
  const ghosts = computeDiffGhosts(prevNodes, nodes, before.relations, relations)
  for (const [id, kind] of Object.entries(diff)) {
    if (kind === 'removed' && highlight[id] === 'new') {
      delete highlight[id]
      continue
    }
    highlight[id] = kind === 'changed' && highlight[id] === 'new' ? 'new' : kind
    if (kind === 'removed') {
      if (ghosts.nodes[id]) ghostNodes[id] = ghosts.nodes[id]
      if (ghosts.relations[id]) ghostRelations[id] = ghosts.relations[id]
    }
  }
  // Something removed earlier in the burst and now back is no ghost.
  for (const id of Object.keys(ghostNodes)) if (nodes[id]) delete ghostNodes[id]
  for (const id of Object.keys(ghostRelations)) if (relations[id]) delete ghostRelations[id]

  flash = { highlight, ghostNodes, ghostRelations, showDiff: flash?.showDiff ?? s.showDiff }
  useDiagramStore.setState({ diffHighlight: highlight, diffGhostNodes: ghostNodes, diffGhostRelations: ghostRelations, showDiff: true })
  useDiagramStore.getState()._sync()
  if (timer !== null) clearTimeout(timer)
  timer = setTimeout(end, flashMs)
})
