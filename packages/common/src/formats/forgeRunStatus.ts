// ─── Agent Forge run status file ────────────────────────────────────────────
//
// Where a Radical Forge run that an agent drives over MCP stands, written by
// the MCP server into the model folder after every forge_* step so Studio,
// open on the same folder, can show it (read only). It lives next to the
// canvas selection under `.radical/`, which the md-folder format never lists
// or watches and `.radical/.gitignore` keeps out of version control. The
// server keeps the run itself in memory; this is only a picture of it.

import { FORGE_STAGES, type ForgeStageId } from '../ai/forge/prompts'
import { SELECTION_DIR } from './canvasSelection'

export const FORGE_RUN_FILE = `${SELECTION_DIR}/forge-run.json`

/** A run nobody has touched for this long is shown as paused: the agent may
 *  have gone away without the server noticing (a crash, a killed process). */
export const FORGE_RUN_STALE_MS = 30 * 60 * 1000

export type ForgeRunStageStatus = 'pending' | 'clarifying' | 'generating' | 'done'

export interface ForgeRunStageInfo {
  id: ForgeStageId
  status: ForgeRunStageStatus
  /** What the agent said the stage created, when it is done. */
  summary?: string
  /** How many elements and relations it added. */
  added?: { nodes: number; relations: number }
}

export interface ForgeRunStatus {
  version: 1
  /** The MCP client driving the run, as it named itself (claude-code, …). */
  client?: string
  /** The need the run started from. */
  need?: { id: string; label: string }
  startedAt: string
  updatedAt: string
  /** active: running; finished: forge_finish was called; closed: the
   *  server shut down before the run finished. */
  state: 'active' | 'finished' | 'closed'
  stages: ForgeRunStageInfo[]
}

export function serializeForgeRun(status: Omit<ForgeRunStatus, 'version' | 'updatedAt'>, now = new Date()): string {
  const out: ForgeRunStatus = { version: 1, ...status, updatedAt: now.toISOString() }
  return `${JSON.stringify(out, null, 2)}\n`
}

const STAGE_IDS = new Set<string>(FORGE_STAGES.map((s) => s.id))
const STATUSES = new Set<string>(['pending', 'clarifying', 'generating', 'done'])

/** The run status in `text`, or null when it is not one. */
export function parseForgeRun(text: string): ForgeRunStatus | null {
  let raw: unknown
  try { raw = JSON.parse(text) } catch { return null }
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.version !== 1 || typeof r.startedAt !== 'string' || typeof r.updatedAt !== 'string') return null
  if (r.state !== 'active' && r.state !== 'finished' && r.state !== 'closed') return null
  if (!Array.isArray(r.stages)) return null
  const stages: ForgeRunStageInfo[] = []
  for (const s of r.stages as Record<string, unknown>[]) {
    if (!s || typeof s.id !== 'string' || !STAGE_IDS.has(s.id) || typeof s.status !== 'string' || !STATUSES.has(s.status)) return null
    const added = s.added as { nodes?: unknown; relations?: unknown } | undefined
    stages.push({
      id: s.id as ForgeStageId,
      status: s.status as ForgeRunStageStatus,
      ...(typeof s.summary === 'string' ? { summary: s.summary } : {}),
      ...(added && typeof added.nodes === 'number' && typeof added.relations === 'number' ? { added: { nodes: added.nodes, relations: added.relations } } : {}),
    })
  }
  const need = r.need as { id?: unknown; label?: unknown } | undefined
  return {
    version: 1,
    ...(typeof r.client === 'string' ? { client: r.client } : {}),
    ...(need && typeof need.id === 'string' && typeof need.label === 'string' ? { need: { id: need.id, label: need.label } } : {}),
    startedAt: r.startedAt,
    updatedAt: r.updatedAt,
    state: r.state,
    stages,
  }
}

/** How Studio shows a run: `working` while the agent generates a stage,
 *  `waiting` while it talks to the user (questions, how to arrange, whether
 *  to go on), `done` once finished, `paused` when it ended early or went
 *  quiet for FORGE_RUN_STALE_MS. */
export type ForgeRunPhase = 'working' | 'waiting' | 'done' | 'paused'

export function forgeRunPhase(status: ForgeRunStatus, now = Date.now()): ForgeRunPhase {
  if (status.state === 'finished') return 'done'
  if (status.state === 'closed') return 'paused'
  if (now - Date.parse(status.updatedAt) > FORGE_RUN_STALE_MS) return 'paused'
  return status.stages.some((s) => s.status === 'generating') ? 'working' : 'waiting'
}

/** The stage the run is at: the one in progress, else the next to run. */
export function forgeRunCurrentStage(status: ForgeRunStatus): ForgeRunStageInfo | undefined {
  return status.stages.find((s) => s.status === 'generating' || s.status === 'clarifying')
    ?? status.stages.find((s) => s.status === 'pending')
}

/** A person-readable name for the MCP client that drives a run. */
export function forgeRunClientName(client: string | undefined): string {
  if (!client) return 'an agent'
  const known: Record<string, string> = { 'claude-code': 'Claude Code', 'claude-ai': 'Claude Desktop' }
  return known[client] ?? client
}
