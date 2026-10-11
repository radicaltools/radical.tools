/**
 * Radical Forge's clarify call in Studio: one cheap, tool-less provider call
 * whose answer is parsed by @radical/common/ai/forge (tested there).
 */
import { describe, it, expect, vi } from 'vitest'

describe('askClarifyingQuestions', () => {
  it('returns both the parsed questions and the usage from the underlying chat call — this is real spend even though it never touches the diagram', async () => {
    vi.resetModules()
    vi.doMock('../src/renderer/src/ai/registry', () => ({
      getAdapter: () => ({
        id: 'anthropic',
        label: 'Claude',
        defaultModel: 'claude-x',
        chat: vi.fn(async () => ({
          content: [{ type: 'text', text: '[{"id":"auth","question":"Which auth?","kind":"text"}]' }],
          stopReason: 'end_turn',
          usage: { inputTokens: 300, outputTokens: 20 },
        })),
      }),
    }))
    const { askClarifyingQuestions } = await import('../src/renderer/src/ai/forgeClarify')
    const settings = { enabled: true, active: 'anthropic', providers: { anthropic: { apiKey: 'x' }, ollama: {}, openai: {}, gemini: {} } } as any

    const result = await askClarifyingQuestions('Requirements', 'desc', undefined, settings)

    expect(result.questions).toEqual([{ id: 'auth', question: 'Which auth?', kind: 'text' }])
    expect(result.usage).toEqual({ inputTokens: 300, outputTokens: 20 })
    vi.doUnmock('../src/renderer/src/ai/registry')
  })

  it('returns the Hub candidates the model picked, or null when its reply is unreadable', async () => {
    const candidates = [
      { id: 'pattern-saga', category: 'pattern', name: 'Saga (Orchestrated)', description: 'd', tags: [] },
      { id: 'pattern-cqrs', category: 'pattern', name: 'CQRS with Event Sourcing', description: 'd', tags: [] },
    ] as any[]
    const settings = { enabled: true, active: 'anthropic', providers: { anthropic: { apiKey: 'x' }, ollama: {}, openai: {}, gemini: {} } } as any
    const ask = async (text: string) => {
      vi.resetModules()
      const chat = vi.fn(async () => ({ content: [{ type: 'text', text }], stopReason: 'end_turn' }))
      vi.doMock('../src/renderer/src/ai/registry', () => ({ getAdapter: () => ({ id: 'anthropic', label: 'Claude', defaultModel: 'claude-x', chat }) }))
      const { askClarifyingQuestions } = await import('../src/renderer/src/ai/forgeClarify')
      const result = await askClarifyingQuestions('C4 model', 'Ticket sales', candidates, settings)
      vi.doUnmock('../src/renderer/src/ai/registry')
      return { result, prompt: (chat.mock.calls[0] as any)[0].messages[0].content as string }
    }

    const { result, prompt } = await ask('[{"id":"hub_matches","question":"Apply?","kind":"select","multiSelect":true,"options":["Saga (Orchestrated)"]}]')
    expect(prompt).toContain('- pattern-cqrs | [pattern] CQRS with Event Sourcing: d')
    expect(result.picked!.map((c) => c.id)).toEqual(['pattern-saga'])
    expect(result.questions[0].options).toEqual(['Saga (Orchestrated)'])
    expect((await ask('[]')).result.picked).toEqual([])
    expect((await ask('I would rather not.')).result.picked).toBeNull()
  })

  it('always routes to the adapter\'s cheap/fast defaultModel, ignoring a pricier model configured for generation', async () => {
    vi.resetModules()
    const chat = vi.fn(async () => ({
      content: [{ type: 'text', text: '[]' }],
      stopReason: 'end_turn',
      usage: { inputTokens: 10, outputTokens: 5 },
    }))
    vi.doMock('../src/renderer/src/ai/registry', () => ({
      getAdapter: () => ({ id: 'anthropic', label: 'Claude', defaultModel: 'claude-haiku-cheap', chat }),
    }))
    const { askClarifyingQuestions } = await import('../src/renderer/src/ai/forgeClarify')
    const settings = {
      enabled: true,
      active: 'anthropic',
      providers: { anthropic: { apiKey: 'x', model: 'claude-opus-expensive' }, ollama: {}, openai: {}, gemini: {} },
    } as any

    await askClarifyingQuestions('Requirements', 'desc', undefined, settings)

    expect(chat).toHaveBeenCalledTimes(1)
    expect(chat.mock.calls[0][0].model).toBe('claude-haiku-cheap')
    vi.doUnmock('../src/renderer/src/ai/registry')
  })
})
