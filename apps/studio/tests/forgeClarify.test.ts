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

  it('returns the concern packs the model picked, their questions added', async () => {
    const packs = [
      { id: 'concern-authentication', name: 'Authentication', description: 'Who is calling.', concern: { id: 'authentication', trigger: 'LIST NODES', why: 'w' },
        templateParams: [{ key: 'IDENTITY', label: 'How do people sign in?', defaultValue: 'idp', options: [{ value: 'idp', label: 'a provider' }, { value: 'none', label: 'nobody' }] }] },
      { id: 'concern-secrets', name: 'Secrets', description: 'Credentials.', concern: { id: 'secrets', trigger: 'LIST NODES', why: 'w' }, templateParams: [] },
    ] as any[]
    const settings = { enabled: true, active: 'anthropic', providers: { anthropic: { apiKey: 'x' }, ollama: {}, openai: {}, gemini: {} } } as any
    const ask = async (text: string) => {
      vi.resetModules()
      const chat = vi.fn(async () => ({ content: [{ type: 'text', text }], stopReason: 'end_turn' }))
      vi.doMock('../src/renderer/src/ai/registry', () => ({ getAdapter: () => ({ id: 'anthropic', label: 'Claude', defaultModel: 'claude-x', chat }) }))
      const { askClarifyingQuestions } = await import('../src/renderer/src/ai/forgeClarify')
      const result = await askClarifyingQuestions('Requirements', 'Ticket sales', packs, settings)
      vi.doUnmock('../src/renderer/src/ai/registry')
      return { result, prompt: (chat.mock.calls[0] as any)[0].messages[0].content as string }
    }

    const { result, prompt } = await ask('[{"id":"concerns","question":"Settle?","kind":"select","multiSelect":true,"options":["Authentication"]}]')
    expect(prompt).toContain('- concern-secrets | Secrets: Credentials.')
    expect(result.picked.map((c) => c.id)).toEqual(['concern-authentication'])
    expect(result.questions).toEqual([
      { id: 'concerns', question: expect.stringContaining('uncheck any that does not apply'), kind: 'select', multiSelect: true, options: ['Authentication'] },
      { id: 'concern:concern-authentication:IDENTITY', question: 'Authentication — How do people sign in?', kind: 'select', options: ['a provider', 'nobody'], defaultOption: 'a provider' },
    ])
    expect((await ask('[]')).result.picked).toEqual([])
    expect((await ask('I would rather not.')).result.picked).toEqual([])
  })

  it('proposes the baseline packs checked even when the reply is no JSON, and in Review every open concern, the prompt saying they are still open (Baseline packs proposed, Open concerns settled in Review)', async () => {
    const pack = (id: string, name: string) => ({ id, name, description: `${name}.`, concern: { id, trigger: 'LIST NODES', why: 'w' },
      templateParams: [{ key: 'LEVEL', label: 'How far?', defaultValue: 'some', options: [{ value: 'some', label: 'some' }, { value: 'all', label: 'all' }] }] }) as any
    const tests = pack('concern-test-strategy', 'Test strategy')
    const usability = pack('concern-usability', 'Usability')
    const settings = { enabled: true, active: 'anthropic', providers: { anthropic: { apiKey: 'x' }, ollama: {}, openai: {}, gemini: {} } } as any
    const ask = async (text: string, stageTitle: string, packs: any[], concerns?: any) => {
      vi.resetModules()
      const chat = vi.fn(async () => ({ content: [{ type: 'text', text }], stopReason: 'end_turn' }))
      vi.doMock('../src/renderer/src/ai/registry', () => ({ getAdapter: () => ({ id: 'anthropic', label: 'Claude', defaultModel: 'claude-x', chat }) }))
      const { askClarifyingQuestions } = await import('../src/renderer/src/ai/forgeClarify')
      const result = await askClarifyingQuestions(stageTitle, 'A shop', packs, settings, undefined, undefined, concerns)
      vi.doUnmock('../src/renderer/src/ai/registry')
      return { result, prompt: (chat.mock.calls[0] as any)[0].messages[0].content as string }
    }

    const requirements = await ask('I would rather not.', 'Requirements', [tests, usability])
    expect(requirements.result.picked.map((p) => p.id)).toEqual(['concern-test-strategy'])
    expect(requirements.result.questions.find((q) => q.id === 'concerns')).toMatchObject({ multiSelect: true, options: ['Test strategy'] })
    expect(requirements.prompt).toContain('Always include the baseline packs: Test strategy.')

    const review = await ask('[]', 'Review', [usability], { stage: 'review', appliesTo: { 'concern-usability': ['Storefront'] } })
    expect(review.result.picked.map((p) => p.id)).toEqual(['concern-usability'])
    expect(review.result.questions.map((q) => q.id)).toEqual(['concerns', 'concern:concern-usability:LEVEL'])
    expect(review.prompt).toContain('These concerns the model raises are still open')
    expect(review.prompt).toContain('Open for: "Storefront".')
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
