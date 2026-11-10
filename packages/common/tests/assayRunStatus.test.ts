import { describe, it, expect } from 'vitest'
import {
  ASSAY_RUN_FILE, ASSAY_RUN_STALE_MS, ASSAY_STAGES, assayRunCurrentStage, assayRunPhase, parseAssayRun, serializeAssayRun,
  type AssayRunStatus,
} from '../src/formats/assayRunStatus'

const at = new Date('2026-11-10T12:00:00Z')
const run = (state: AssayRunStatus['state'], statuses: Record<string, AssayRunStatus['stages'][number]['status']> = {}, waiting = 0): AssayRunStatus =>
  parseAssayRun(serializeAssayRun({
    client: 'claude-code',
    repositories: [{ name: 'RS2', units: 3, facts: 1200 }],
    sources: 1,
    startedAt: at.toISOString(),
    state,
    stages: ASSAY_STAGES.map((s) => ({ id: s.id, status: statuses[s.id] ?? 'pending', ...(statuses[s.id] === 'done' ? { plans: 2, refused: 1, added: { nodes: 12, relations: 9 } } : {}) })),
    proposals: { waiting, accepted: 3, rejected: 1 },
  }, at))!

describe('agent Assay run status file', () => {
  it('lives next to the Forge run status and round-trips', () => {
    expect(ASSAY_RUN_FILE).toBe('.state/assay-run.json')
    const status = run('active', { c4: 'done', explore: 'skipped', documents: 'working' }, 2)
    expect(status).toMatchObject({
      version: 1, client: 'claude-code', updatedAt: at.toISOString(), state: 'active', sources: 1,
      repositories: [{ name: 'RS2', units: 3, facts: 1200 }], proposals: { waiting: 2, accepted: 3, rejected: 1 },
    })
    expect(status.stages.map((s) => s.id)).toEqual(['c4', 'explore', 'documents', 'domain', 'processes', 'states', 'scenarios'])
    expect(status.stages[0]).toEqual({ id: 'c4', status: 'done', plans: 2, refused: 1, added: { nodes: 12, relations: 9 } })
    expect(status.stages[1]).toEqual({ id: 'explore', status: 'skipped' })
    expect(parseAssayRun('{"version":2}')).toBeNull()
    expect(parseAssayRun('not json')).toBeNull()
    expect(parseAssayRun(JSON.stringify({ ...status, stages: [{ id: 'nope', status: 'done' }] }))).toBeNull()
    expect(parseAssayRun(JSON.stringify({ ...status, stages: [{ id: 'c4', status: 'generating' }] }))).toBeNull()
    expect(parseAssayRun(JSON.stringify({ ...status, repositories: [{ units: 1 }] }))).toBeNull()
    // Counts that are no counts are left out.
    expect(parseAssayRun(JSON.stringify({ ...status, stages: [{ id: 'c4', status: 'working', plans: -1, added: { nodes: 'x', relations: 1 } }] }))!.stages).toEqual([{ id: 'c4', status: 'working' }])
  })

  it('works while the agent does, waits while proposals wait for the user, and pauses when closed or quiet', () => {
    const now = at.getTime() + 60_000
    expect(assayRunPhase(run('active', { c4: 'working' }), now)).toBe('working')
    expect(assayRunPhase(run('active', { scenarios: 'working' }, 2), now)).toBe('waiting')
    expect(assayRunPhase(run('finished', { scenarios: 'done' }, 2), now)).toBe('done')
    expect(assayRunPhase(run('closed', { domain: 'working' }), now)).toBe('paused')
    expect(assayRunPhase(run('active', { domain: 'working' }), at.getTime() + ASSAY_RUN_STALE_MS + 1)).toBe('paused')
  })

  it('is at the stage working, else the last one done, else the first', () => {
    expect(assayRunCurrentStage(run('active', { c4: 'done', explore: 'skipped', domain: 'working' }))?.id).toBe('domain')
    expect(assayRunCurrentStage(run('finished', { c4: 'done', domain: 'done', processes: 'skipped', scenarios: 'skipped' }))?.id).toBe('domain')
    expect(assayRunCurrentStage(run('active'))?.id).toBe('c4')
  })
})
