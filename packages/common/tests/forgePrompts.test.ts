import { describe, it, expect } from 'vitest'
import { buildForgeStagePrompt, buildPriorStagesBlock, needLabelFromDescription, FORGE_STAGES, PRIMARY_TYPE_IDS_FOR_STAGE } from '../src/ai/forge/prompts'

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
    expect(FORGE_STAGES.map((s) => s.id)).toEqual(['requirements', 'fitness', 'scenarios', 'states', 'mockups', 'c4'])
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

  it('has the C4 stage link each state machine to its owner and each publisher to its events', () => {
    const prompt = buildForgeStagePrompt('c4', 'A web shop.')
    expect(prompt).toContain('`lifecycle-of` relation FROM the machine')
    expect(prompt).toContain('`emits`')
  })

  it('has mockups illustrate the states they show', () => {
    expect(buildForgeStagePrompt('mockups', 'A web shop.')).toContain('link the\nmockup to that `state` with `illustrates`')
  })

  it('has the C4 stage use the mockups and link them with presented-by', () => {
    const prompt = buildForgeStagePrompt('c4', 'A web shop.')
    expect(prompt).toContain('mockups already in the model')
    expect(prompt).toContain('`presented-by` relation FROM the mockup TO that element')
  })
})

describe('buildForgeStagePrompt — state machines stage', () => {
  it('runs between the scenarios and the mockups, creating the statechart types', () => {
    const ids = FORGE_STAGES.map((s) => s.id)
    expect(ids.indexOf('states')).toBe(ids.indexOf('scenarios') + 1)
    expect(ids.indexOf('mockups')).toBe(ids.indexOf('states') + 1)
    expect(PRIMARY_TYPE_IDS_FOR_STAGE.states).toEqual(['state-machine', 'state', 'pseudostate', 'event'])
  })

  it('models only entities with a lifecycle, from the scenarios, by event reference, without C4 elements', () => {
    const prompt = buildForgeStagePrompt('states', 'A web shop.')
    expect(prompt).toContain('real lifecycle')
    expect(prompt).toContain('If none has, create nothing')
    expect(prompt).toContain('Given is the source state, When\n   is the event, Then is the target state')
    expect(prompt).toContain('`event` (the id or\n   tempId of the event node)')
    expect(prompt).toContain('`pseudostate` of kind "initial"')
    expect(prompt).toContain('(scenario → state-machine)')
    expect(prompt).toContain('do not create any here')
  })
})

describe('buildForgeStagePrompt — need', () => {
  const need = { id: 'n-42', label: 'Checkout brief' }

  it('has the requirements stage link top-level requirements to the need with derives', () => {
    const prompt = buildForgeStagePrompt('requirements', 'A web shop.', undefined, undefined, '', need)
    expect(prompt).toContain('`need` node "Checkout brief"')
    expect(prompt).toContain('(id n-42)')
    expect(prompt).toContain('`derives` relation FROM the requirement TO that need')
    expect(prompt).toContain('Do not edit the need node itself.')
  })

  it('says nothing about a need without one, or in other stages', () => {
    expect(buildForgeStagePrompt('requirements', 'A web shop.')).not.toContain('`need` node')
    expect(buildForgeStagePrompt('scenarios', 'A web shop.', undefined, undefined, '', need)).not.toContain('n-42')
  })
})

describe('needLabelFromDescription', () => {
  it('uses the first non-empty line without Markdown markers', () => {
    expect(needLabelFromDescription('\n\n# Checkout brief\nmore')).toBe('Checkout brief')
    expect(needLabelFromDescription('- Customers pay by card.\n- more')).toBe('Customers pay by card')
  })

  it('cuts long lines at a word boundary', () => {
    const label = needLabelFromDescription('A marketplace where independent sellers list handmade goods and buyers pay with cards')
    expect(label.endsWith('…')).toBe(true)
    expect(label.length).toBeLessThanOrEqual(61)
    expect(label).toBe('A marketplace where independent sellers list handmade goods…')
  })

  it('falls back when there is no text', () => {
    expect(needLabelFromDescription('   \n ')).toBe('Forge brief')
  })
})
