import { describe, it, expect } from 'vitest'
import { buildForgeStagePrompt, buildPriorStagesBlock, needLabelFromDescription, FORGE_STAGES, PRIMARY_TYPE_IDS_FOR_STAGE, REFINE_RULES } from '../src/ai/forge/prompts'

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
    expect(FORGE_STAGES.map((s) => s.id)).toEqual(['requirements', 'domain', 'fitness', 'scenarios', 'states', 'processes', 'mockups', 'c4', 'review'])
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

  it('has the C4 stage link what implements each machine, owns each entity and publishes each event', () => {
    const prompt = buildForgeStagePrompt('c4', 'A web shop.')
    expect(prompt).toContain('to it with `implements`')
    expect(prompt).toContain('(element → machine)')
    expect(prompt).toContain('`realises` (element → entity)')
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

describe('buildForgeStagePrompt — domain model stage', () => {
  it('runs right after the requirements, creating domains and entities', () => {
    const ids = FORGE_STAGES.map((s) => s.id)
    expect(ids.indexOf('domain')).toBe(1)
    expect(PRIMARY_TYPE_IDS_FOR_STAGE.domain).toEqual(['domain', 'entity'])
  })

  it('asks for bounded contexts, aggregates, references and a context map in the requirements\' words', () => {
    const prompt = buildForgeStagePrompt('domain', 'A library.')
    expect(prompt).toContain('ubiquitous language')
    expect(prompt).toContain('`domain` node for each bounded context')
    expect(prompt).toContain('link the part to its root with `part-of`')
    expect(prompt).toContain('`references` (entity → entity), with `cardinality` one or\n   many')
    expect(prompt).toContain('`depends-on`')
    expect(prompt).toContain('`satisfies` (entity → requirement)')
    expect(prompt).toContain('No systems,\ncontainers, state machines or scenarios yet.')
  })

  it('makes the later stages use it', () => {
    expect(buildForgeStagePrompt('scenarios', 'A library.')).toContain('names\nof its `entity` nodes')
    expect(buildForgeStagePrompt('c4', 'A library.')).toContain('`realises` (element → domain)')
  })
})

describe('buildForgeStagePrompt — fitness functions stage', () => {
  it('asks for the characteristic, scope, cadence, invocation and measure of each fitness function', () => {
    const prompt = buildForgeStagePrompt('fitness', 'A web shop.')
    for (const key of ['characteristic', 'scope', 'cadence', 'trigger', 'every', 'invocation', 'measure', 'metrics']) {
      expect(prompt).toContain(`\`${key}\``)
    }
    expect(prompt).toContain('ISO/IEC 25010')
    expect(prompt).toContain('performance-efficiency')
    expect(prompt).toContain('`atomic`')
    expect(prompt).toContain('`holistic`')
    expect(prompt).toContain('`triggered`')
    expect(prompt).toContain('`continual`')
    expect(prompt).toContain('`temporal`')
    expect(prompt).toContain('nightly')
    expect(prompt).toContain('`manual`')
    expect(prompt).toContain('review(<name>) passed')
    // A measure only with a sensor radical sense has.
    expect(prompt).toContain('`playwright`')
    expect(prompt).toContain('`command`')
    expect(prompt).toContain('otherwise\nleave it empty')
    expect(prompt).not.toContain('category')
  })
})

describe('buildForgeStagePrompt — state machines stage', () => {
  it('runs between the scenarios and the mockups, creating the statechart types', () => {
    const ids = FORGE_STAGES.map((s) => s.id)
    expect(ids.indexOf('states')).toBe(ids.indexOf('scenarios') + 1)
    expect(ids.indexOf('processes')).toBe(ids.indexOf('states') + 1)
    expect(PRIMARY_TYPE_IDS_FOR_STAGE.states).toEqual(['entity', 'state-machine', 'state', 'pseudostate', 'event'])
  })

  it('models only entities with a lifecycle, from the scenarios, by event reference, without C4 elements', () => {
    const prompt = buildForgeStagePrompt('states', 'A web shop.')
    expect(prompt).toContain('real lifecycle')
    expect(prompt).toContain('If none has, create nothing')
    expect(prompt).toContain('Given is the source state, When\n   is the event, Then is the target state')
    expect(prompt).toContain('`event` (the id or\n   tempId of the event node)')
    expect(prompt).toContain('`pseudostate` of kind "initial"')
    expect(prompt).toContain('(scenario → state-machine)')
    expect(prompt).toContain('Take its entity from the domain model')
    expect(prompt).toContain('link it to the entity with `lifecycle-of` (machine → entity; one machine\n   per entity)')
    expect(prompt).toContain('do not create any here')
  })
})

describe('processes', () => {
  it('runs after the state machines and before the mockups, creating processes and steps', () => {
    const ids = FORGE_STAGES.map((s) => s.id)
    expect(ids.indexOf('processes')).toBe(ids.indexOf('states') + 1)
    expect(ids.indexOf('mockups')).toBe(ids.indexOf('processes') + 1)
    expect(FORGE_STAGES.find((s) => s.id === 'processes')?.title).toBe('Processes')
    expect(PRIMARY_TYPE_IDS_FOR_STAGE.processes).toEqual(['process', 'step'])
  })

  it('asks for ordered steps with repetition, choice and concurrency, verified and satisfied, without C4 elements', () => {
    const prompt = buildForgeStagePrompt('processes', 'A web shop.')
    expect(prompt).toContain('A web shop.')
    expect(prompt).toContain('If none is described, create\nnothing')
    expect(prompt).toContain('Give every step its `order`')
    expect(prompt).toContain('"1..n" or "0..n" for a repetition')
    expect(prompt).toContain('`children` "choice"')
    expect(prompt).toContain('"concurrent"')
    expect(prompt).toContain('(scenario → process)')
    expect(prompt).toContain('(process → requirement)')
    expect(prompt).toContain('do not create any here')
  })

  it('has the C4 stage link each step to who performs it', () => {
    expect(buildForgeStagePrompt('c4', 'A web shop.')).toContain('`performed-by` (step → person, system,')
  })
})

describe('review', () => {
  it('comes last, after the C4 model, and makes nothing of its own', () => {
    const ids = FORGE_STAGES.map((s) => s.id)
    expect(ids.at(-1)).toBe('review')
    expect(ids.indexOf('review')).toBe(ids.indexOf('c4') + 1)
    expect(FORGE_STAGES.at(-1)?.title).toBe('Review')
    expect(PRIMARY_TYPE_IDS_FOR_STAGE.review).toEqual([])
  })

  it('checks the whole model against the description, carries the open gaps and proposes its changes to the user', () => {
    const prompt = buildForgeStagePrompt('review', 'A web shop.', undefined, undefined, '', undefined, ['- No scenario verifies requirement "Pay".'])
    expect(prompt).toContain('A web shop.')
    expect(prompt).toContain('Read it as a whole against the\ndescription')
    expect(prompt).toContain('one thing under two names')
    expect(prompt).toContain('contradicts a transition or the order of a process')
    expect(prompt).toContain('Gaps the model has now')
    expect(prompt).toContain('- No scenario verifies requirement "Pay".')
    expect(prompt).toContain('Everything you change goes to the user first.')
    expect(prompt).toContain('propose it with propose_refinement')
    expect(prompt).toContain('change nothing and\nsay so')
  })
})

describe('every stage after the requirements may close gaps in earlier stages', () => {
  const later = FORGE_STAGES.map((s) => s.id).filter((id) => id !== 'requirements')

  it('every stage after the requirements may close gaps in earlier stages', () => {
    for (const id of later) {
      const prompt = buildForgeStagePrompt(id, 'A web shop.')
      expect(prompt, id).toContain(REFINE_RULES[0])
      expect(prompt, id).toContain('Never delete an element of an earlier stage.')
      expect(prompt, id).toContain('name it as an open')
      expect(prompt, id).toContain('propose it with propose_refinement')
      expect(prompt, id).toContain('linking two such elements is\nrefused')
    }
    expect(buildForgeStagePrompt('requirements', 'A web shop.')).not.toContain(REFINE_RULES[0])
  })

  it('names the proposal tool it is given', () => {
    const prompt = buildForgeStagePrompt('processes', 'A web shop.', undefined, undefined, '', undefined, [], 'forge_propose_refinement')
    expect(prompt).toContain('propose it with forge_propose_refinement')
    expect(prompt).not.toContain('propose it with propose_refinement')
  })

  it('lists the gaps it is given, and none when there are none', () => {
    expect(buildForgeStagePrompt('processes', 'A web shop.', undefined, undefined, '', undefined, ['- Nobody performs step "Pack".'])).toContain('- Nobody performs step "Pack".')
    expect(buildForgeStagePrompt('processes', 'A web shop.', undefined, undefined, '', undefined, [])).not.toContain('Gaps the model has now')
  })

  it('no longer has the C4 stage leave a needed requirement out', () => {
    const prompt = buildForgeStagePrompt('c4', 'A web shop.')
    expect(prompt).not.toContain('Do not invent')
    expect(prompt).toContain('propose the\nrequirement with its scenario when the description implies it')
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
