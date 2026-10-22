/**
 * Radical Forge's pre-stage clarifying-questions parsing — this has to
 * tolerate real model output (markdown fences, stray prose, a model that
 * ignores the format) without ever throwing or blocking the wizard.
 */
import { describe, it, expect } from 'vitest'
import { parseClarifyResponse, parseClarifyReply, formatClarificationAnswers, buildClarifyPrompt } from '../src/ai/forge/clarify'
import { CONCERNS_QUESTION_ID } from '../src/ai/forge/concerns'
import type { ConcernPack } from '../src/concerns'

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

const PACK: ConcernPack = {
  id: 'concern-authentication', name: 'Authentication', description: 'Who is calling.',
  concern: { id: 'authentication', trigger: 'LIST NODES', why: 'w', group: 'identity' },
  templateParams: [{ key: 'IDENTITY', label: 'How do people sign in?', defaultValue: 'idp', options: [{ value: 'idp', label: 'a provider' }, { value: 'none', label: 'nobody' }] }],
}

describe('buildClarifyPrompt', () => {
  it('asks for the concerns question only when there are concern packs', () => {
    const withPacks = buildClarifyPrompt('Requirements', 'desc', [PACK])
    const withoutPacks = buildClarifyPrompt('C4 model', 'desc', undefined)
    expect(withPacks).toContain(`"${CONCERNS_QUESTION_ID}"`)
    expect(withPacks).toContain('- concern-authentication | Authentication: Who is calling.')
    expect(withoutPacks).not.toContain(CONCERNS_QUESTION_ID)
  })

  it('includes prior-stage Q&A (and the do-not-repeat instruction) only when passed', () => {
    const priorQA = 'Q: Which auth mechanism?\nA: OAuth2'
    const withPrior = buildClarifyPrompt('C4 model', 'desc', undefined, priorQA)
    const withoutPrior = buildClarifyPrompt('C4 model', 'desc', undefined)
    expect(withPrior).toContain(priorQA)
    expect(withPrior).toContain('do NOT ask about these')
    expect(withoutPrior).not.toContain('do NOT ask about these')
  })

  it("in 'ask' mode tells the model to ask the user, the packs' questions included, instead of answering with JSON", () => {
    const ask = buildClarifyPrompt('Requirements', 'desc', [PACK], undefined, 'ask')
    expect(ask).toContain('Ask the user those questions')
    expect(ask).toContain('Pass the packs with the answers the user accepted or gave to')
    expect(ask).toContain('  - IDENTITY: How do people sign in? [idp = a provider; none = nobody] (default idp)')
    expect(ask).not.toContain('JSON')
    expect(ask).not.toContain(`"${CONCERNS_QUESTION_ID}"`)
  })

  it('tells a reply without questions from one that is not a reply', () => {
    expect(parseClarifyReply('[]')).toEqual([])
    expect(parseClarifyReply('Sorry, I cannot help.')).toBeNull()
    expect(parseClarifyResponse('Sorry, I cannot help.')).toEqual([])
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

  it('excludes the concern packs\' questions and skips unanswered ones', () => {
    const questions = [
      { id: CONCERNS_QUESTION_ID, question: 'Which concerns?', kind: 'select' as const, options: ['A'], multiSelect: true },
      { id: 'concern:concern-authentication:IDENTITY', question: 'How?', kind: 'select' as const, options: ['a provider'] },
      { id: 'unanswered', question: 'Skipped?', kind: 'text' as const },
    ]
    const out = formatClarificationAnswers(questions, { [CONCERNS_QUESTION_ID]: ['A'], 'concern:concern-authentication:IDENTITY': 'a provider' })
    expect(out).toBe('')
  })

  it('returns "" when there are no questions or no answers', () => {
    expect(formatClarificationAnswers(undefined, {})).toBe('')
    expect(formatClarificationAnswers([], {})).toBe('')
    expect(formatClarificationAnswers([{ id: 'a', question: 'Q?', kind: 'text' }], undefined)).toBe('')
  })
})
