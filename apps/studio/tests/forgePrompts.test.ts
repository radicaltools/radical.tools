import { describe, it, expect } from 'vitest'
import { buildForgeStagePrompt, buildPriorStagesBlock, FORGE_STAGES, PRIMARY_TYPE_IDS_FOR_STAGE } from '../src/renderer/src/ai/forgePrompts'

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

describe('buildForgeStagePrompt — mockups stage', () => {
  it('runs before C4, as part of the spec the architecture follows from', () => {
    expect(FORGE_STAGES.map((s) => s.id)).toEqual(['requirements', 'fitness', 'scenarios', 'mockups', 'c4'])
    expect(PRIMARY_TYPE_IDS_FOR_STAGE.mockups).toEqual(['mockup'])
  })

  it('asks for mockup nodes linked via illustrates / navigates-to, without wireframes or C4 elements', () => {
    const prompt = buildForgeStagePrompt('mockups', 'A web shop.')
    expect(prompt).toContain('A web shop.')
    expect(prompt).toContain('`mockup` node')
    expect(prompt).toContain('`illustrates`')
    expect(prompt).toContain('`navigates-to`')
    expect(prompt).not.toContain('`presented-by`')
    expect(prompt).toContain('Do not draw wireframes here')
    expect(prompt).toContain('no user')
  })

  it('has the C4 stage use the mockups and link them with presented-by', () => {
    const prompt = buildForgeStagePrompt('c4', 'A web shop.')
    expect(prompt).toContain('mockups already in the model')
    expect(prompt).toContain('`presented-by` relation FROM the mockup TO that element')
  })
})
