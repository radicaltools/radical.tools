import { describe, it, expect, beforeEach, vi } from 'vitest'
import { runAIPrompt } from '../src/renderer/src/ai/runner'
import { defaultAISettings } from '../src/renderer/src/ai/settings'
import type { DiagramFacade } from '../src/renderer/src/ai/diagramFacade'
import type { C4Node, C4Relation } from '../src/renderer/src/types/c4'

function makeFacade(): DiagramFacade & { _nodes: Record<string, C4Node>; _rels: Record<string, C4Relation> } {
  const nodes: Record<string, C4Node> = {}
  const rels: Record<string, C4Relation> = {}
  let seq = 0
  return {
    _nodes: nodes,
    _rels: rels,
    getNodes: () => nodes,
    getRelations: () => rels,
    addNode: (n) => { const id = `n${++seq}`; nodes[id] = { id, ...n }; return id },
    updateNode: (id, u) => { if (nodes[id]) Object.assign(nodes[id], u) },
    removeNode: (id) => { delete nodes[id] },
    addRelation: (r) => { const id = `r${++seq}`; rels[id] = { id, ...r } },
    updateRelation: (id, u) => { if (rels[id]) Object.assign(rels[id], u) },
    removeRelation: (id) => { delete rels[id] },
  }
}

// Most runner tests target the Anthropic adapter (see providers/claude.ts);
// a smaller parity block at the end targets OpenAI (providers/openai.ts) to
// prove the loop itself — dispatch, batching, self-correction — behaves the
// same regardless of which real-tool-calling adapter is under it. Both
// override the default-active provider (intentionally OpenAI-with-no-key in
// production, so the AI agent stays hidden until the user sets a key).
function anthropicSettings() {
  const s = defaultAISettings()
  s.active = 'anthropic'
  s.providers.anthropic.apiKey = 'test-key'
  return s
}

function openaiSettings() {
  const s = defaultAISettings()
  s.active = 'openai'
  s.providers.openai.apiKey = 'test-key'
  return s
}

function geminiSettings() {
  const s = defaultAISettings()
  s.active = 'gemini'
  s.providers.gemini.apiKey = 'test-key'
  return s
}

function ollamaSettings() {
  const s = defaultAISettings()
  s.active = 'ollama'
  return s
}

interface FakeRound {
  content: unknown[]
  stop_reason: string
  usage?: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number }
}

function fakeAnthropicFetch(rounds: FakeRound[]) {
  let call = 0
  const bodies: any[] = []
  ;(globalThis as any).fetch = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.body) bodies.push(JSON.parse(init.body as string))
    const round = rounds[Math.min(call, rounds.length - 1)]
    call++
    return new Response(
      JSON.stringify({ model: 'claude-haiku-4-5', content: round.content, stop_reason: round.stop_reason, usage: round.usage }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  })
  return { calls: () => call, bodies: () => bodies }
}

const toolUse = (id: string, name: string, input: unknown) => ({ type: 'tool_use', id, name, input })
const text = (t: string) => ({ type: 'text', text: t })

describe('runAIPrompt — end-to-end with mocked Anthropic tool-calling', () => {
  beforeEach(() => { delete (globalThis as any).fetch })

  it('executes tool calls from one round, then returns the final text answer', async () => {
    fakeAnthropicFetch([
      {
        content: [
          toolUse('c1', 'add_node', { tempId: 't1', type: 'system', label: 'Web App' }),
          toolUse('c2', 'add_node', { tempId: 't2', type: 'database', label: 'DB' }),
          toolUse('c3', 'add_relation', { sourceId: 't1', targetId: 't2', label: 'reads' }),
        ],
        stop_reason: 'tool_use',
      },
      { content: [text('Created Web App and DB.')], stop_reason: 'end_turn' },
    ])
    const facade = makeFacade()
    const result = await runAIPrompt({
      prompt: 'Make a web app and a DB it reads from',
      settings: anthropicSettings(),
      diagram: facade,
    })
    expect(result.summary).toMatch(/Created/)
    expect(result.report.added.nodes).toBe(2)
    expect(result.report.added.relations).toBe(1)
    expect(result.iterations).toBe(1)
    expect(Object.keys(facade._nodes)).toHaveLength(2)
  })

  it('feeds a rejected tool call back as an error result and lets the model self-correct', async () => {
    // Round 1: adds a "database" with no parent -> facade rejects it (empty id).
    // Round 2: model adds the system first, then the database with parentId.
    fakeAnthropicFetch([
      { content: [toolUse('c1', 'add_node', { tempId: 't1', type: 'database', label: 'DB' })], stop_reason: 'tool_use' },
      {
        content: [
          toolUse('c2', 'add_node', { tempId: 's1', type: 'system', label: 'Sys' }),
          toolUse('c3', 'add_node', { tempId: 'd1', type: 'database', label: 'DB', parentId: 's1' }),
        ],
        stop_reason: 'tool_use',
      },
      { content: [text('Added the database under a new system.')], stop_reason: 'end_turn' },
    ])
    const base = makeFacade()
    const facade: DiagramFacade = {
      ...base,
      addNode: (n) => (n.type === 'database' && !n.parentId ? '' : base.addNode(n)),
    }
    const result = await runAIPrompt({
      prompt: 'add a database',
      settings: anthropicSettings(),
      diagram: facade,
    })
    expect(result.iterations).toBe(2)
    expect(result.report.added.nodes).toBe(2) // system + database from round 2
    expect(result.report.errors).toEqual([]) // round 2 was clean, so errors were cleared
  })

  it('preserves focus_node in the aggregated report', async () => {
    fakeAnthropicFetch([
      {
        content: [
          toolUse('c1', 'add_node', { tempId: 't1', type: 'system', label: 'API' }),
          toolUse('c2', 'focus_node', { id: 't1' }),
        ],
        stop_reason: 'tool_use',
      },
      { content: [text('Focused API.')], stop_reason: 'end_turn' },
    ])
    const result = await runAIPrompt({
      prompt: 'show me the API',
      settings: anthropicSettings(),
      diagram: makeFacade(),
    })
    expect(result.report.errors).toEqual([])
    expect(result.report.focusNodeId).toMatch(/^n\d+$/)
  })

  it('runs search_model and continues with the next round', async () => {
    fakeAnthropicFetch([
      { content: [toolUse('c1', 'search_model', { query: 'LIST TECHNOLOGIES' })], stop_reason: 'tool_use' },
      { content: [text('Technologies in use:\n- React\n- HTTPS')], stop_reason: 'end_turn' },
    ])
    const facade = makeFacade()
    facade.addNode({
      type: 'system', label: 'Web App', technology: 'React', collapsed: false, x: 0, y: 0, width: 100, height: 100,
    })
    facade.addRelation({ sourceId: 'n1', targetId: 'n1', technology: 'HTTPS' })

    const result = await runAIPrompt({
      prompt: 'List all technologies in the model',
      settings: anthropicSettings(),
      diagram: facade,
    })
    expect(result.report.errors).toEqual([])
    expect(result.summary).toMatch(/React/)
    expect(result.summary).toMatch(/HTTPS/)
  })

  it('stops after maxIterations if the model never returns a final answer', async () => {
    const { calls } = fakeAnthropicFetch([
      { content: [toolUse('c1', 'search_model', { query: 'STATS MODEL' })], stop_reason: 'tool_use' },
    ])
    const result = await runAIPrompt({
      prompt: 'loop forever',
      settings: anthropicSettings(),
      diagram: makeFacade(),
      maxIterations: 3,
    })
    expect(result.iterations).toBe(3)
    expect(result.report.errors[0]).toMatch(/Stopped after 3/)
    expect(calls()).toBe(3) // maxIterations rounds executed, then the cap check breaks before a 4th call
  })

  it('returns the full run transcript in `history` for the caller to persist', async () => {
    fakeAnthropicFetch([
      { content: [toolUse('c1', 'add_node', { tempId: 't1', type: 'system', label: 'API' })], stop_reason: 'tool_use' },
      { content: [text('Done.')], stop_reason: 'end_turn' },
    ])
    const result = await runAIPrompt({
      prompt: 'add an API system',
      settings: anthropicSettings(),
      diagram: makeFacade(),
    })
    // The initial user turn now carries a trailing diagram-state snapshot
    // block after the original prompt text (see ai/runner.ts's
    // `withTrailingText`) instead of the live state going out as a
    // separate, ever-changing system message — that's what makes the
    // system prefix in front of it byte-stable and cacheable across
    // rounds/stages. It must be TRAILING, not leading: Anthropic requires
    // `tool_result` blocks to be the first content in a user turn that
    // follows a `tool_use` — a block ahead of them is rejected.
    expect(result.history[0].role).toBe('user')
    const firstContent = result.history[0].content
    expect(Array.isArray(firstContent)).toBe(true)
    expect(firstContent).toEqual([
      { type: 'text', text: 'add an API system' },
      { type: 'text', text: expect.stringMatching(/Current diagram state/) },
    ])
    expect(result.history.some((m) => m.role === 'assistant' && Array.isArray(m.content))).toBe(true)
    expect(result.history.at(-1)).toEqual({ role: 'assistant', content: [{ type: 'text', text: 'Done.' }] })
  })

  it('caches the growing within-stage prefix: a rolling second cache_control breakpoint moves forward each round instead of accumulating', async () => {
    const { bodies } = fakeAnthropicFetch([
      { content: [toolUse('c1', 'add_node', { tempId: 't1', type: 'system', label: 'API' })], stop_reason: 'tool_use' },
      { content: [toolUse('c2', 'add_node', { tempId: 't2', type: 'system', label: 'DB' })], stop_reason: 'tool_use' },
      { content: [text('Done.')], stop_reason: 'end_turn' },
    ])
    await runAIPrompt({ prompt: 'add two systems', settings: anthropicSettings(), diagram: makeFacade() })
    const reqs = bodies()
    expect(reqs).toHaveLength(3)

    const cacheControlBlocks = (body: any): number =>
      body.messages.flatMap((m: any) => (Array.isArray(m.content) ? m.content : [])).filter((b: any) => b.cache_control).length
      + body.system.filter((b: any) => b.cache_control).length

    // Round 1: only the system-prefix breakpoint (metamodel message) exists yet.
    expect(cacheControlBlocks(reqs[0])).toBe(1)
    // Round 2+: the system breakpoint plus exactly one rolling breakpoint in
    // `messages` marking the end of the previously-sent, now-stable turns —
    // never more than one there, however many rounds accumulate.
    expect(cacheControlBlocks(reqs[1])).toBe(2)
    expect(cacheControlBlocks(reqs[2])).toBe(2)

    // Every round's outgoing final message carries a fresh diagram-state
    // snapshot APPENDED after its tool_result blocks — never before them,
    // since Anthropic requires tool_result to be the first content
    // immediately following the tool_use it answers.
    const lastMsg2 = reqs[1].messages.at(-1)
    expect(lastMsg2.content[0].type).toBe('tool_result')
    expect(lastMsg2.content.at(-1).text).toMatch(/Current diagram state/)
  })
})

interface FakeOpenAIRound { tool_calls?: Array<{ id: string; name: string; args: unknown }>; text?: string }

function fakeOpenAIFetch(rounds: FakeOpenAIRound[]) {
  let call = 0
  ;(globalThis as any).fetch = vi.fn(async () => {
    const round = rounds[Math.min(call, rounds.length - 1)]
    call++
    const message: Record<string, unknown> = { content: round.text ?? null }
    if (round.tool_calls) {
      message.tool_calls = round.tool_calls.map((c) => ({
        id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args) },
      }))
    }
    return new Response(
      JSON.stringify({
        model: 'gpt-4o-mini',
        choices: [{ message, finish_reason: round.tool_calls ? 'tool_calls' : 'stop' }],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  })
}

describe('runAIPrompt — parity check with mocked OpenAI tool-calling', () => {
  beforeEach(() => { delete (globalThis as any).fetch })

  it('executes tool calls from one round, then returns the final text answer', async () => {
    fakeOpenAIFetch([
      {
        tool_calls: [
          { id: 'c1', name: 'add_node', args: { tempId: 't1', type: 'system', label: 'Web App' } },
          { id: 'c2', name: 'add_node', args: { tempId: 't2', type: 'database', label: 'DB' } },
          { id: 'c3', name: 'add_relation', args: { sourceId: 't1', targetId: 't2', label: 'reads' } },
        ],
      },
      { text: 'Created Web App and DB.' },
    ])
    const facade = makeFacade()
    const result = await runAIPrompt({
      prompt: 'Make a web app and a DB it reads from',
      settings: openaiSettings(),
      diagram: facade,
    })
    expect(result.summary).toMatch(/Created/)
    expect(result.report.added.nodes).toBe(2)
    expect(result.report.added.relations).toBe(1)
    expect(Object.keys(facade._nodes)).toHaveLength(2)
  })
})

interface FakeGeminiRound { calls?: Array<{ name: string; args: unknown }>; text?: string }

function fakeGeminiFetch(rounds: FakeGeminiRound[]) {
  let call = 0
  ;(globalThis as any).fetch = vi.fn(async () => {
    const round = rounds[Math.min(call, rounds.length - 1)]
    call++
    const parts: unknown[] = []
    if (round.text) parts.push({ text: round.text })
    for (const c of round.calls ?? []) parts.push({ functionCall: { name: c.name, args: c.args } })
    return new Response(
      JSON.stringify({ modelVersion: 'gemini-1.5-flash', candidates: [{ content: { parts }, finishReason: 'STOP' }] }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  })
}

describe('runAIPrompt — parity check with mocked Gemini tool-calling (no call ids)', () => {
  beforeEach(() => { delete (globalThis as any).fetch })

  it('executes tool calls from one round, then returns the final text answer', async () => {
    fakeGeminiFetch([
      {
        calls: [
          { name: 'add_node', args: { tempId: 't1', type: 'system', label: 'Web App' } },
          { name: 'add_node', args: { tempId: 't2', type: 'database', label: 'DB' } },
          { name: 'add_relation', args: { sourceId: 't1', targetId: 't2', label: 'reads' } },
        ],
      },
      { text: 'Created Web App and DB.' },
    ])
    const facade = makeFacade()
    const result = await runAIPrompt({
      prompt: 'Make a web app and a DB it reads from',
      settings: geminiSettings(),
      diagram: facade,
    })
    expect(result.summary).toMatch(/Created/)
    expect(result.report.added.nodes).toBe(2)
    expect(result.report.added.relations).toBe(1)
    expect(Object.keys(facade._nodes)).toHaveLength(2)
  })
})

interface FakeOllamaRound { tool_calls?: Array<{ name: string; args: unknown }>; text?: string }

function fakeOllamaFetch(rounds: FakeOllamaRound[]) {
  let call = 0
  ;(globalThis as any).fetch = vi.fn(async () => {
    const round = rounds[Math.min(call, rounds.length - 1)]
    call++
    const message: Record<string, unknown> = { content: round.text ?? '' }
    if (round.tool_calls) {
      message.tool_calls = round.tool_calls.map((c) => ({ function: { name: c.name, arguments: c.args } }))
    }
    return new Response(
      JSON.stringify({ model: 'llama3.1', message }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  })
}

describe('runAIPrompt — parity check with mocked Ollama tool-calling (no call ids, best-effort)', () => {
  beforeEach(() => { delete (globalThis as any).fetch })

  it('executes tool calls from one round, then returns the final text answer', async () => {
    fakeOllamaFetch([
      {
        tool_calls: [
          { name: 'add_node', args: { tempId: 't1', type: 'system', label: 'Web App' } },
          { name: 'add_node', args: { tempId: 't2', type: 'database', label: 'DB' } },
          { name: 'add_relation', args: { sourceId: 't1', targetId: 't2', label: 'reads' } },
        ],
      },
      { text: 'Created Web App and DB.' },
    ])
    const facade = makeFacade()
    const result = await runAIPrompt({
      prompt: 'Make a web app and a DB it reads from',
      settings: ollamaSettings(),
      diagram: facade,
    })
    expect(result.summary).toMatch(/Created/)
    expect(result.report.added.nodes).toBe(2)
    expect(result.report.added.relations).toBe(1)
    expect(Object.keys(facade._nodes)).toHaveLength(2)
  })

  it('treats a model that ignores tools and just answers as a normal, immediate finish', async () => {
    fakeOllamaFetch([{ text: 'I cannot use tools, but the answer is 42.' }])
    const result = await runAIPrompt({
      prompt: 'what is the answer',
      settings: ollamaSettings(),
      diagram: makeFacade(),
    })
    expect(result.iterations).toBe(0)
    expect(result.summary).toMatch(/42/)
  })
})

describe('runAIPrompt — onProgress (live feed for Radical Forge)', () => {
  beforeEach(() => { delete (globalThis as any).fetch })

  it('emits a round event per round and an action event per tool call, with resolved node labels', async () => {
    fakeAnthropicFetch([
      {
        content: [
          toolUse('c1', 'add_node', { tempId: 't1', type: 'system', label: 'Web App' }),
          toolUse('c2', 'add_node', { tempId: 't2', type: 'database', label: 'DB' }),
          toolUse('c3', 'add_relation', { sourceId: 't1', targetId: 't2', label: 'reads' }),
        ],
        stop_reason: 'tool_use',
      },
      { content: [text('Created Web App and DB.')], stop_reason: 'end_turn' },
    ])
    const events: unknown[] = []
    await runAIPrompt({
      prompt: 'Make a web app and a DB it reads from',
      settings: anthropicSettings(),
      diagram: makeFacade(),
      onProgress: (e) => events.push(e),
    })

    expect(events).toEqual([
      { type: 'round', round: 1 },
      { type: 'action', ok: true, label: '+ system: Web App' },
      { type: 'action', ok: true, label: '+ database: DB' },
      // sourceId/targetId are tempIds ("t1"/"t2") — describeToolCall resolves
      // them through ctx to the real node labels, not the raw tempId strings.
      { type: 'action', ok: true, label: '+ relation: Web App → DB' },
      { type: 'round', round: 2 },
      { type: 'text', text: 'Created Web App and DB.' },
    ])
  })

  it('emits a failed action with ok:false when a tool call errors', async () => {
    fakeAnthropicFetch([
      { content: [toolUse('c1', 'add_node', { tempId: 't1', type: 'database', label: 'DB' })], stop_reason: 'tool_use' },
      { content: [text('Done.')], stop_reason: 'end_turn' },
    ])
    const base = makeFacade()
    // Same rejection trick as the "self-correct" test above: a parent-less
    // database is refused, forcing result.ok === false for this call.
    const facade: DiagramFacade = { ...base, addNode: (n) => (n.type === 'database' && !n.parentId ? '' : base.addNode(n)) }
    const events: unknown[] = []
    await runAIPrompt({
      prompt: 'Add a database',
      settings: anthropicSettings(),
      diagram: facade,
      onProgress: (e) => events.push(e),
    })
    const actions = events.filter((e): e is { type: 'action'; ok: boolean; label: string } => (e as any).type === 'action')
    expect(actions).toHaveLength(1)
    expect(actions[0].ok).toBe(false)
    expect(actions[0].label).toBe('add_node failed')
  })

  it('never calls onProgress when the caller does not pass it (no behavior change for existing callers)', async () => {
    fakeAnthropicFetch([{ content: [text('Just an answer, no tools.')], stop_reason: 'end_turn' }])
    // No onProgress in opts — should not throw, same as before this feature existed.
    const result = await runAIPrompt({
      prompt: 'hello',
      settings: anthropicSettings(),
      diagram: makeFacade(),
    })
    expect(result.summary).toMatch(/Just an answer/)
  })

  it('sums usage across every round and emits a running total via onProgress', async () => {
    fakeAnthropicFetch([
      {
        content: [toolUse('c1', 'add_node', { tempId: 't1', type: 'system', label: 'Web App' })],
        stop_reason: 'tool_use',
        usage: { input_tokens: 1000, output_tokens: 50, cache_read_input_tokens: 700 },
      },
      {
        content: [text('Done.')],
        stop_reason: 'end_turn',
        usage: { input_tokens: 1200, output_tokens: 20, cache_read_input_tokens: 900 },
      },
    ])
    const usageEvents: unknown[] = []
    const result = await runAIPrompt({
      prompt: 'Make a web app',
      settings: anthropicSettings(),
      diagram: makeFacade(),
      onProgress: (e) => { if (e.type === 'usage') usageEvents.push(e) },
    })
    // Running total after each round, not per-round deltas. Anthropic's
    // `input_tokens` is only the fresh, non-cached portion — the adapter
    // folds `cache_read_input_tokens` into `inputTokens` too (see
    // providers/claude.ts's `parseUsage`) so the total tracks real spend:
    // round 1 is 1000 + 700 = 1700, round 2 is 1200 + 900 = 2100.
    expect(usageEvents).toEqual([
      { type: 'usage', usage: { inputTokens: 1700, outputTokens: 50, cachedInputTokens: 700 } },
      { type: 'usage', usage: { inputTokens: 3800, outputTokens: 70, cachedInputTokens: 1600 } },
    ])
    expect(result.usage).toEqual({ inputTokens: 3800, outputTokens: 70, cachedInputTokens: 1600 })
  })

  it('leaves result.usage undefined when the provider never reports usage', async () => {
    fakeAnthropicFetch([{ content: [text('ok')], stop_reason: 'end_turn' }])
    const result = await runAIPrompt({ prompt: 'hello', settings: anthropicSettings(), diagram: makeFacade() })
    expect(result.usage).toBeUndefined()
  })
})
