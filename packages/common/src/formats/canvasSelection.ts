// ─── Canvas selection file ───────────────────────────────────────────────────
//
// What is selected on Studio's canvas, written into the model folder so an AI
// client working on the same folder (the MCP server) can act on "the selected
// element". It lives under `.state/`, which the md-folder format never
// lists, stamps or watches, so writing it is not a model change. A
// `.state/.gitignore` keeps it out of version control.

/** A model folder's state out of git: the selection, the base, the cache,
 *  the fetched models, test results, measurements, agent turns. */
export const STATE_DIR = '.state'
/** Where versions before ADR "Radical in one .radical folder" kept it: a
 *  state file is still read from there while STATE_DIR lacks it. */
export const OLD_STATE_DIR = '.radical'
/** Where an older version kept the state file `path` (under STATE_DIR). */
export const oldStatePath = (path: string): string =>
  path.startsWith(`${STATE_DIR}/`) ? `${OLD_STATE_DIR}/${path.slice(STATE_DIR.length + 1)}` : path
export const SELECTION_FILE = `${STATE_DIR}/selection.json`
export const SELECTION_GITIGNORE = `${STATE_DIR}/.gitignore`
/** Everything under `.state/` is per-user editor state. */
export const SELECTION_GITIGNORE_CONTENT = '*\n'

export interface CanvasSelection {
  version: 1
  /** ISO time Studio wrote it. */
  updatedAt: string
  /** The view on the canvas; null for All elements. */
  viewId: string | null
  /** Selected nodes, in the order they were selected. */
  nodeIds: string[]
  relationIds: string[]
}

export function serializeSelection(selection: Omit<CanvasSelection, 'version' | 'updatedAt'>, now = new Date()): string {
  const out: CanvasSelection = { version: 1, updatedAt: now.toISOString(), ...selection }
  return `${JSON.stringify(out, null, 2)}\n`
}

const isIdList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((id) => typeof id === 'string' && id.length > 0)

/** The selection in `text`, or null when it is not a selection file. */
export function parseSelection(text: string): CanvasSelection | null {
  let raw: unknown
  try { raw = JSON.parse(text) } catch { return null }
  if (!raw || typeof raw !== 'object') return null
  const { version, updatedAt, viewId, nodeIds, relationIds } = raw as Record<string, unknown>
  if (version !== 1 || typeof updatedAt !== 'string' || !isIdList(nodeIds) || !isIdList(relationIds)) return null
  if (viewId !== null && typeof viewId !== 'string') return null
  return { version, updatedAt, viewId, nodeIds, relationIds }
}
