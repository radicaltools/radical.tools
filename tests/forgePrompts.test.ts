import { describe, it, expect } from 'vitest'
import { buildForgeStagePrompt, buildPriorStagesBlock } from '../src/renderer/src/ai/forgePrompts'

describe('buildPriorStagesBlock', () => {
  it('returns "" when there are no prior stages with a summary yet', () => {
    expect(buildPriorStagesBlock([])).toBe('')
    expect(buildPriorStagesBlock([{ title: 'Requirements', summary: '' }])).toBe('')
    expect(buildPriorStagesBlock([{ title: 'Requirements', summary: '   ' }])).toBe('')
  })

  it('formats each summarised stage as a titled bullet, skipping unsummarised ones', () => {
    const block = buildPriorStagesBlock([
      { title: 'Requirements', summary: 'Extracted 6 EARS requirements covering auth and billing.' },
      { title: 'Fitness functions', summary: '' },
    ])
    expect(block).toContain('- Requirements: Extracted 6 EARS requirements covering auth and billing.')
    expect(block).not.toContain('Fitness functions:')
  })
})

describe('buildForgeStagePrompt — prior-stage summaries replace full transcript replay', () => {
  it('includes the prior-stage summary block when passed, instead of requiring a growing history transcript', () => {
    const prompt = buildForgeStagePrompt(
      'fitness',
      'A system description.',
      undefined,
      undefined,
      buildPriorStagesBlock([{ title: 'Requirements', summary: 'Extracted 6 EARS requirements.' }]),
    )
    expect(prompt).toContain('Summary of earlier stages in this run')
    expect(prompt).toContain('Requirements: Extracted 6 EARS requirements.')
  })

  it('omits the prior-stage block entirely when nothing has been summarised yet (e.g. the first stage)', () => {
    const prompt = buildForgeStagePrompt('requirements', 'A system description.', undefined, undefined, '')
    expect(prompt).not.toContain('Summary of earlier stages')
  })
})
