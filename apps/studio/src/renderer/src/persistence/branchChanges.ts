// ─── The changes of the branch, in Studio ───────────────────────────────────
//
// Studio has no git. The CLI (radical diff --save-base, the git hooks) and
// the MCP server (get_changes) save the model as it was where the branch
// left main in the folder's .radical/base.json; Studio polls that file for
// the active md-folder document, as inspector.ts polls the test results,
// and compares the model with it as it is edited (branchChanges from
// @radical/common, the comparison the CLI runs). Changes on branch shows
// them on the canvas through the store's diff overlay; the Inspector lists
// the requirements and ADRs among them whether it is on or not. The only
// file written here is the base a Radical Forge run saves where git saved
// none (saveForgeBase), so a folder outside git shows what the run changes.

import { create } from 'zustand'
import type { C4Node } from '@radical/common/c4'
import { forgeModelBase, isBaseOld, mayReplaceWithForgeBase, parseModelBase, type ModelBase } from '@radical/common/formats/modelBase'
import { baseCopy, branchChanges, type BranchChanges } from '@radical/common/branchChanges'
import type { ModelCopy } from '@radical/common/model'
import { useDiagramStore, type BranchOverlay } from '@radical/ui/store/diagramStore'
import { documents, useDocumentsStore } from '../store/documentStore'
import { loadingDocumentId, onDocumentLoaded } from './autosave'

const POLL_MS = 3000
/** After the last change of the model, so a drag does not compare every frame. */
const RECOMPUTE_MS = 300

interface BranchState {
  /** The base beside the active model; null when there is none (or it is no base file). */
  base: ModelBase | null
  /** The base as a model copy, for the comparison. */
  baseModel: ModelCopy | null
  /** The model now, as compared. */
  model: ModelCopy | null
  /** What changed since the base; null without one. */
  changes: BranchChanges | null
  /** Changes on branch: the changes shown on the canvas. */
  on: boolean
}

export const useBranchStore = create<BranchState>(() => ({ base: null, baseModel: null, model: null, changes: null, on: false }))

/** Changes on branch on or off; it stays off without a base. */
export function setBranchChangesShown(on: boolean): void {
  useBranchStore.setState({ on: on && !!useBranchStore.getState().base })
  showOverlay()
}

/** The base is old: it may come from another branch or an older main. */
export const branchBaseIsOld = (base: ModelBase, now = Date.now()): boolean => isBaseOld(base, now)

const byId = <T extends { id: string }>(items: T[]): Record<string, T> => Object.fromEntries(items.map((item) => [item.id, item]))

function recompute(): void {
  const { baseModel } = useBranchStore.getState()
  const id = documents.getActiveId()
  if (!baseModel || !id || loadingDocumentId() === id) {
    if (!baseModel) useBranchStore.setState({ changes: null, model: null })
    return
  }
  // saveDiagram gives the live model also while a milestone is on screen.
  const data = useDiagramStore.getState().saveDiagram()
  const model = { nodes: byId(data.nodes), relations: byId(data.relations) }
  useBranchStore.setState({ model, changes: branchChanges(baseModel, model.nodes, model.relations) })
  showOverlay()
}

/** Reads the base again at once (after saveForgeBase wrote one). */
let pollNow: () => Promise<void> = async () => {}

/** As a Forge run starts on a folder model: saves the model as it is now
 *  as its base, unless git saved one (see mayReplaceWithForgeBase). True
 *  when it did. */
export async function saveForgeBase(): Promise<boolean> {
  const id = documents.getActiveId()
  if (!id) return false
  const existing = await documents.readModelBase(id).catch(() => null)
  if (!mayReplaceWithForgeBase(existing)) return false
  const data = useDiagramStore.getState().saveDiagram()
  if (!(await documents.writeModelBase(id, forgeModelBase(data.nodes, data.relations)))) return false
  await pollNow()
  return true
}

/** Puts the changes on the canvas, or takes them off. */
function showOverlay(): void {
  const { on, changes, baseModel } = useBranchStore.getState()
  const store = useDiagramStore.getState()
  if (!on || !changes || !baseModel || store.activeSnapshotId) {
    store.showBranchChanges(null)
    return
  }
  const baseNodes: Record<string, C4Node> = {}
  for (const [id, mark] of Object.entries(changes.nodes)) if (mark !== 'new') baseNodes[id] = baseModel.nodes[id]
  const overlay: BranchOverlay = {
    nodes: changes.nodes,
    relations: changes.relations,
    baseNodes,
    ghostNodes: byId(changes.removedNodes),
    ghostRelations: byId(changes.removedRelations),
  }
  store.showBranchChanges(overlay)
}

if (typeof window !== 'undefined') {
  let polledFor: string | null = null
  let lastText: string | null = null

  const poll = async (): Promise<void> => {
    const id = documents.getActiveId()
    if (id !== polledFor) {
      polledFor = id
      lastText = null
      useBranchStore.setState({ base: null, baseModel: null, model: null, changes: null, on: false })
      showOverlay()
    }
    if (!id) return
    const text = await documents.readModelBase(id).catch(() => null)
    if (documents.getActiveId() !== id || text === lastText) return
    lastText = text
    const base = text ? parseModelBase(text) : null
    useBranchStore.setState((s) => ({ base, baseModel: base ? baseCopy(base) : null, on: s.on && !!base }))
    recompute()
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  useDiagramStore.subscribe((s, prev) => {
    // Leaving a milestone gives the overlay back.
    if (s.activeSnapshotId !== prev.activeSnapshotId) { showOverlay(); return }
    if (s.c4Nodes === prev.c4Nodes && s.c4Relations === prev.c4Relations && s.liveBackup === prev.liveBackup) return
    clearTimeout(timer)
    timer = setTimeout(recompute, RECOMPUTE_MS)
  })
  // A (re)loaded model clears the overlay: compare again at once.
  onDocumentLoaded((id) => { if (id === documents.getActiveId()) { recompute(); void poll() } })

  pollNow = poll
  setInterval(() => { void poll() }, POLL_MS)
  useDocumentsStore.subscribe((s) => { if (s.activeId !== polledFor) void poll() })
  void poll()
}
