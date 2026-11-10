// ─── Agent Assay run status file ────────────────────────────────────────────
//
// Where a Radical Assay run that an agent drives over MCP stands, written by
// the MCP server into the model folder (the central model) after every
// assay_* call, so Studio, open on the same folder, can show it (read only),
// as it shows an agent's Forge run (forgeRunStatus.ts). The agent, not the
// server, follows Assay's stages, so the server infers them from the calls
// (ADR Agent Assay runs show in Studio). The file lives under `.state/`,
// which the md-folder format never lists or watches and `.state/.gitignore`
// keeps out of version control.

import { STATE_DIR } from './canvasSelection'
import { FORGE_RUN_STALE_MS } from './forgeRunStatus'

export const ASSAY_RUN_FILE = `${STATE_DIR}/assay-run.json`

/** A run nobody has touched for this long is shown as paused, as a Forge run is. */
export const ASSAY_RUN_STALE_MS = FORGE_RUN_STALE_MS

/** Assay's stages that write into the model, in the order assay_procedure gives them. */
export const ASSAY_STAGES = [
  { id: 'c4', title: 'C4 model', short: 'C4' },
  { id: 'explore', title: 'Explore', short: 'Explore' },
  { id: 'documents', title: 'Documents', short: 'Documents' },
  { id: 'domain', title: 'Domain', short: 'Domain' },
  { id: 'processes', title: 'Processes', short: 'Processes' },
  { id: 'states', title: 'State machines', short: 'States' },
  { id: 'scenarios', title: 'Scenarios', short: 'Scenarios' },
] as const

export type AssayStageId = typeof ASSAY_STAGES[number]['id']

/** working: the stage the run is at; done: the run moved past it, or
 *  finished, after a plan of it; skipped: it did so with none. */
export type AssayRunStageStatus = 'pending' | 'working' | 'done' | 'skipped'

export interface AssayRunStageInfo {
  id: AssayStageId
  status: AssayRunStageStatus
  /** Plans of this stage the server wrote, and those it refused. */
  plans?: number
  refused?: number
  /** What its plans and its accepted proposals added to the model. */
  added?: { nodes: number; relations: number }
}

export interface AssayRunRepository {
  name: string
  /** Units of a stack Assay reads. */
  units: number
  /** Every fact read from it. */
  facts: number
}

export interface AssayRunStatus {
  version: 1
  /** The MCP client driving the run, as it named itself (claude-code, …). */
  client?: string
  repositories: AssayRunRepository[]
  /** Sources of documents taken. */
  sources: number
  startedAt: string
  updatedAt: string
  /** active: running; finished: assay_finish was called; closed: the
   *  server shut down before the run finished. */
  state: 'active' | 'finished' | 'closed'
  stages: AssayRunStageInfo[]
  /** Requirements, needs and decisions handed to the user. */
  proposals: { waiting: number; accepted: number; rejected: number }
}

export function serializeAssayRun(status: Omit<AssayRunStatus, 'version' | 'updatedAt'>, now = new Date()): string {
  const out: AssayRunStatus = { version: 1, ...status, updatedAt: now.toISOString() }
  return `${JSON.stringify(out, null, 2)}\n`
}

const STAGE_IDS = new Set<string>(ASSAY_STAGES.map((s) => s.id))
const STATUSES = new Set<string>(['pending', 'working', 'done', 'skipped'])
const count = (x: unknown): number | undefined => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : undefined)

/** The run status in `text`, or null when it is not one. */
export function parseAssayRun(text: string): AssayRunStatus | null {
  let raw: unknown
  try { raw = JSON.parse(text) } catch { return null }
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.version !== 1 || typeof r.startedAt !== 'string' || typeof r.updatedAt !== 'string') return null
  if (r.state !== 'active' && r.state !== 'finished' && r.state !== 'closed') return null
  if (!Array.isArray(r.stages) || !Array.isArray(r.repositories)) return null
  const stages: AssayRunStageInfo[] = []
  for (const s of r.stages as Record<string, unknown>[]) {
    if (!s || typeof s.id !== 'string' || !STAGE_IDS.has(s.id) || typeof s.status !== 'string' || !STATUSES.has(s.status)) return null
    const added = s.added as { nodes?: unknown; relations?: unknown } | undefined
    const plans = count(s.plans)
    const refused = count(s.refused)
    stages.push({
      id: s.id as AssayStageId,
      status: s.status as AssayRunStageStatus,
      ...(plans ? { plans } : {}),
      ...(refused ? { refused } : {}),
      ...(added && count(added.nodes) !== undefined && count(added.relations) !== undefined ? { added: { nodes: added.nodes as number, relations: added.relations as number } } : {}),
    })
  }
  const repositories: AssayRunRepository[] = []
  for (const x of r.repositories as Record<string, unknown>[]) {
    if (!x || typeof x.name !== 'string') return null
    repositories.push({ name: x.name, units: count(x.units) ?? 0, facts: count(x.facts) ?? 0 })
  }
  const p = (r.proposals ?? {}) as Record<string, unknown>
  return {
    version: 1,
    ...(typeof r.client === 'string' ? { client: r.client } : {}),
    repositories,
    sources: count(r.sources) ?? 0,
    startedAt: r.startedAt,
    updatedAt: r.updatedAt,
    state: r.state,
    stages,
    proposals: { waiting: count(p.waiting) ?? 0, accepted: count(p.accepted) ?? 0, rejected: count(p.rejected) ?? 0 },
  }
}

/** How Studio shows a run: `working` while the agent works on a stage,
 *  `waiting` while proposals wait for the user's answer, `done` once
 *  finished, `paused` when it ended early or went quiet for ASSAY_RUN_STALE_MS. */
export type AssayRunPhase = 'working' | 'waiting' | 'done' | 'paused'

export function assayRunPhase(status: AssayRunStatus, now = Date.now()): AssayRunPhase {
  if (status.state === 'finished') return 'done'
  if (status.state === 'closed') return 'paused'
  if (now - Date.parse(status.updatedAt) > ASSAY_RUN_STALE_MS) return 'paused'
  return status.proposals.waiting > 0 ? 'waiting' : 'working'
}

/** The stage the run is at: the one working; else, once finished, the last
 *  one with a plan; else the first. */
export function assayRunCurrentStage(status: AssayRunStatus): AssayRunStageInfo | undefined {
  return status.stages.find((s) => s.status === 'working')
    ?? [...status.stages].reverse().find((s) => s.status === 'done')
    ?? status.stages[0]
}
