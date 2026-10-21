// ─── Agent activity file ─────────────────────────────────────────────────────
//
// Turn-taking between an agent writing a model folder over MCP and Studio open
// on the same folder. After each write the MCP server marks the folder as
// being written by an agent until a moment a little later; while the mark
// holds, Studio keeps the edits made on its canvas, merges them into each
// change of the agent it reloads, and saves them once the agent pauses. Two
// writers that take turns rarely meet in one file, and when they do the
// three-way merge on write (mergeMdFolderFiles) keeps both.
//
// It lives under `.radical/` with the canvas selection, which the md-folder
// format never lists or watches and `.radical/.gitignore` keeps out of
// version control.

import { SELECTION_DIR } from './canvasSelection'

export const AGENT_ACTIVITY_FILE = `${SELECTION_DIR}/agent-activity.json`

/** How long after its last write an agent counts as writing: long enough to
 *  span the pause between two tool calls, short enough that Studio saves
 *  soon after the agent has finished. */
export const AGENT_ACTIVE_MS = 15_000

export interface AgentActivity {
  version: 1
  /** The MCP client writing, as it named itself (claude-code, …). */
  client?: string
  /** The product version of the MCP server writing (displayVersion), for
   *  Studio to tell a server of another version. */
  radical?: string
  /** Until when (ms since the epoch) the agent counts as writing. */
  until: number
}

export function serializeAgentActivity(client: string | undefined, now = Date.now(), radical?: string): string {
  const out: AgentActivity = { version: 1, ...(client ? { client } : {}), ...(radical ? { radical } : {}), until: now + AGENT_ACTIVE_MS }
  return `${JSON.stringify(out, null, 2)}\n`
}

/** The activity in `text`, or null when it is not one. */
export function parseAgentActivity(text: string | null | undefined): AgentActivity | null {
  if (!text) return null
  let raw: unknown
  try { raw = JSON.parse(text) } catch { return null }
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.version !== 1 || typeof r.until !== 'number' || !Number.isFinite(r.until)) return null
  return {
    version: 1,
    ...(typeof r.client === 'string' ? { client: r.client } : {}),
    ...(typeof r.radical === 'string' && r.radical ? { radical: r.radical } : {}),
    until: r.until,
  }
}

/** Until when an agent writes the folder, per its activity file; 0 when it
 *  does not (no file, a file that does not read, a mark that has passed). A
 *  mark further ahead than one period (a clock that jumped, a server whose
 *  clock runs ahead) is cut to one period after `seenAt`, when the reader
 *  first saw this mark. Cut to one from each check, it renewed itself, and
 *  held Studio's saves as long as the mark said (item 237). */
export function agentWritingUntil(text: string | null | undefined, now = Date.now(), seenAt = now): number {
  const activity = parseAgentActivity(text)
  if (!activity || activity.until <= now) return 0
  const until = Math.min(activity.until, seenAt + AGENT_ACTIVE_MS)
  return until > now ? until : 0
}
