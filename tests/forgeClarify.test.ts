/**
 * Radical Forge's pre-stage clarifying-questions parsing — this has to
 * tolerate real model output (markdown fences, stray prose, a model that
 * ignores the format) without ever throwing or blocking the wizard.
 */
import { describe, it, expect, vi } from 'vitest'
import { parseClarifyResponse, formatClarificationAnswers, HUB_MATCHES_QUESTION_ID, buildClarifyPrompt } from '../src/renderer/src/ai/forgeClarify'

describe('parseClarifyResponse', () => {
  it('parses a clean JSON array', () => {
    const text = '[{"id":"auth","question":"Which auth mechanism?","kind":"text"}]'
    expect(parseClarifyResponse(text)).toEqual([{ id: 'auth', question: 'Which auth mechanism?', kind: 'text' }])
  })

  it('strips a ```json fence', () => {
    const text = '```json\n[{"id":"a","question":"Q?","kind":"text"}]\n```'
    expect(parseClarifyResponse(text)).toHaveLength(1)
  })

  it('tolerates leading/trailing prose around the array', () => {
    const text = 'Sure, here are my questions:\n[{"id":"a","question":"Q?","kind":"text"}]\nLet me know!'
    expect(parseClarifyResponse(text)).toHaveLength(1)
  })

  it('returns [] for an empty array response', () => {
    expect(parseClarifyResponse('[]')).toEqual([])
  })

  it('returns [] for malformed JSON instead of throwing', () => {
    expect(parseClarifyResponse('not json at all')).toEqual([])
    expect(parseClarifyResponse('[{"id":"a", broken')).toEqual([])
  })

  it('drops entries missing required fields', () => {
    const text = '[{"id":"a","question":"Q?","kind":"text"},{"question":"no id","kind":"text"},{"id":"b","question":"bad kind","kind":"essay"}]'
    expect(parseClarifyResponse(text)).toEqual([{ id: 'a', question: 'Q?', kind: 'text' }])
  })

  it('requires options for a select question', () => {
    const withOptions = '[{"id":"a","question":"Q?","kind":"select","options":["x","y"]}]'
    const withoutOptions = '[{"id":"a","question":"Q?","kind":"select"}]'
    expect(parseClarifyResponse(withOptions)).toHaveLength(1)
    expect(parseClarifyResponse(withoutOptions)).toEqual([])
  })
})

describe('buildClarifyPrompt', () => {
  it('requires the hub_matches question only when there are hub matches', () => {
    const withMatches = buildClarifyPrompt('C4 model', 'desc', [
      { id: 'p1', category: 'pattern', name: 'Pattern One', description: 'd', tags: [] } as any,
    ])
    const withoutMatches = buildClarifyPrompt('C4 model', 'desc', undefined)
    expect(withMatches).toContain(HUB_MATCHES_QUESTION_ID)
    expect(withoutMatches).not.toContain(HUB_MATCHES_QUESTION_ID)
  })

  it('includes prior-stage Q&A (and the do-not-repeat instruction) only when passed', () => {
    const priorQA = 'Q: Which auth mechanism?\nA: OAuth2'
    const withPrior = buildClarifyPrompt('C4 model', 'desc', undefined, priorQA)
    const withoutPrior = buildClarifyPrompt('C4 model', 'desc', undefined)
    expect(withPrior).toContain(priorQA)
    expect(withPrior).toContain('do NOT ask about these')
    expect(withoutPrior).not.toContain('do NOT ask about these')
  })
})

describe('formatClarificationAnswers', () => {
  it('formats answered text/select questions as Q/A pairs', () => {
    const questions = [
      { id: 'auth', question: 'Which auth?', kind: 'text' as const },
      { id: 'tier', question: 'Which tier?', kind: 'select' as const, options: ['free', 'paid'] },
    ]
    const answers = { auth: 'OAuth2', tier: ['paid'] }
    const out = formatClarificationAnswers(questions, answers)
    expect(out).toContain('Q: Which auth?\nA: OAuth2')
    expect(out).toContain('Q: Which tier?\nA: paid')
  })

  it('excludes the hub_matches question and skips unanswered ones', () => {
    const questions = [
      { id: HUB_MATCHES_QUESTION_ID, question: 'Which patterns?', kind: 'select' as const, options: ['A'], multiSelect: true },
      { id: 'unanswered', question: 'Skipped?', kind: 'text' as const },
    ]
    const out = formatClarificationAnswers(questions, { [HUB_MATCHES_QUESTION_ID]: ['A'] })
    expect(out).toBe('')
  })

  it('returns "" when there are no questions or no answers', () => {
    expect(formatClarificationAnswers(undefined, {})).toBe('')
    expect(formatClarificationAnswers([], {})).toBe('')
    expect(formatClarificationAnswers([{ id: 'a', question: 'Q?', kind: 'text' }], undefined)).toBe('')
  })
})

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
