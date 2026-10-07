import { describe, it, expect } from 'vitest'
import { AI_SYSTEM_PROMPT, buildContextMessage } from '@radical/common/ai/systemPrompt'
import { buildSystemMessages } from '../src/renderer/src/ai/systemPrompt'
import type { C4Node, C4Relation } from '@radical/common/c4'
import type { Metamodel } from '@radical/common/metamodel'

const node = (over: Partial<C4Node>): C4Node => ({
  id: 'n', type: 'system', label: 'L', collapsed: false,
  x: 0, y: 0, width: 100, height: 100, ...over,
})

describe('AI_SYSTEM_PROMPT contract', () => {
  it('instructs the model to follow metamodel rules', () => {
    expect(AI_SYSTEM_PROMPT).toMatch(/metamodel/i)
    expect(AI_SYSTEM_PROMPT).toMatch(/allowedParents/)
  })

  it('documents the requirement decomposition (derives) workflow', () => {
    expect(AI_SYSTEM_PROMPT).toMatch(/derives/)
    expect(AI_SYSTEM_PROMPT).toMatch(/ears_type/)
  })

  it('tells the model to stop making tool calls once it has a final answer', () => {
    expect(AI_SYSTEM_PROMPT).toMatch(/no further tool calls|no tool calls/i)
  })
})

describe('buildContextMessage', () => {
  it('serialises base fields and spreads governance properties, but not layout', () => {
    const n = node({ id: 'n1', label: 'A', type: 'requirement' }) as unknown as Record<string, unknown>
    n.ears_type = 'event-driven'
    const msg = buildContextMessage(
      { n1: n as unknown as C4Node },
      { r1: { id: 'r1', sourceId: 'n1', targetId: 'n1', label: 'self', relationType: 'derives' } as C4Relation },
    )
    expect(msg).toContain('"id":"n1"')
    expect(msg).toContain('"label":"A"')
    expect(msg).toContain('"ears_type":"event-driven"')
    expect(msg).toContain('"relationType":"derives"')
    // x/y/width/height/collapsed are NOT included (layout is the tool's job)
    expect(msg).not.toMatch(/"width"/)
    // JSON is compact (no pretty-print indentation) to save tokens
    expect(msg).not.toMatch(/\n {2}"/)
  })

  it('serialises view kind', () => {
    const msg = buildContextMessage({}, {}, null, {
      v1: { id: 'v1', name: 'Governance', kind: 'table', nodeIds: [], positions: {} },
    })
    expect(msg).toContain('"kind":"table"')
  })
})

describe('buildSystemMessages', () => {
  it('returns exactly the prompt and (cacheable) metamodel messages, in order — the diagram-state message now lives in the conversation turns instead (see ai/runner.ts)', () => {
    const msgs = buildSystemMessages(undefined, {})
    expect(msgs).toHaveLength(2)
    expect(msgs[0]).toEqual({ role: 'system', content: AI_SYSTEM_PROMPT })
    expect(msgs[1].role).toBe('system')
    expect(msgs[1].content).toMatch(/Metamodel/i)
    expect(msgs[1].cacheBreakpoint).toBe(true)
  })
})
