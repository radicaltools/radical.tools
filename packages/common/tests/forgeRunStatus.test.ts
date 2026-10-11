import { describe, it, expect } from 'vitest'
import {
  FORGE_RUN_FILE, FORGE_RUN_STALE_MS, forgeRunClientName, forgeRunCurrentStage, forgeRunPhase, parseForgeRun, serializeForgeRun,
  type ForgeRunStatus,
} from '../src/formats/forgeRunStatus'
import { FORGE_STAGES } from '../src/ai/forge'

const at = new Date('2026-10-09T12:00:00Z')
const run = (state: ForgeRunStatus['state'], statuses: Record<string, ForgeRunStatus['stages'][number]['status']> = {}): ForgeRunStatus =>
  parseForgeRun(serializeForgeRun({
    client: 'claude-code',
    need: { id: 'n1', label: 'Click & collect' },
    startedAt: at.toISOString(),
    state,
    stages: FORGE_STAGES.map((s) => ({ id: s.id, status: statuses[s.id] ?? 'pending' })),
  }, at))!

describe('agent Forge run status file', () => {
  it('lives next to the canvas selection and round-trips', () => {
    expect(FORGE_RUN_FILE).toBe('.radical/forge-run.json')
    const status = run('active', { requirements: 'done', domain: 'generating' })
    expect(status).toMatchObject({ version: 1, client: 'claude-code', updatedAt: at.toISOString(), state: 'active' })
    expect(status.stages).toHaveLength(FORGE_STAGES.length)
    expect(parseForgeRun('{"version":2}')).toBeNull()
    expect(parseForgeRun('not json')).toBeNull()
    expect(parseForgeRun(JSON.stringify({ ...status, stages: [{ id: 'nope', status: 'done' }] }))).toBeNull()
  })

  it('works while a stage generates, waits on the user otherwise, and pauses when closed or quiet', () => {
    const now = at.getTime() + 60_000
    expect(forgeRunPhase(run('active', { requirements: 'done', domain: 'generating' }), now)).toBe('working')
    expect(forgeRunPhase(run('active', { requirements: 'done', domain: 'clarifying' }), now)).toBe('waiting')
    expect(forgeRunPhase(run('active', { requirements: 'done' }), now)).toBe('waiting')
    expect(forgeRunPhase(run('finished'), now)).toBe('done')
    expect(forgeRunPhase(run('closed'), now)).toBe('paused')
    expect(forgeRunPhase(run('active', { domain: 'generating' }), at.getTime() + FORGE_RUN_STALE_MS + 1)).toBe('paused')
  })

  it('is at the stage in progress, else the last one done until the next begins', () => {
    expect(forgeRunCurrentStage(run('active', { requirements: 'done', domain: 'clarifying' }))?.id).toBe('domain')
    // Done, and the agent asks the user how to arrange it and whether to go on.
    expect(forgeRunCurrentStage(run('active', { requirements: 'done' }))?.id).toBe('requirements')
    expect(forgeRunCurrentStage(run('active'))?.id).toBe('requirements')
    expect(forgeRunCurrentStage(run('finished', Object.fromEntries(FORGE_STAGES.map((s) => [s.id, 'done']))))?.id).toBe('c4')
  })

  it('names the client for people', () => {
    expect(forgeRunClientName('claude-code')).toBe('Claude Code')
    expect(forgeRunClientName('claude-ai')).toBe('Claude Desktop')
    expect(forgeRunClientName('codex')).toBe('codex')
    expect(forgeRunClientName(undefined)).toBe('an agent')
  })
})
