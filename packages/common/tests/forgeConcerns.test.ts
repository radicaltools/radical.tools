/**
 * Radical Forge and the Hub's concern packs: the Requirements stage's clarify
 * step offers them, the picked packs' questions are asked, later stages are
 * told what is decided, the C4 stage what to link, and what it leaves
 * unbound is bound where the pack's trigger points.
 */
import { describe, it, expect } from 'vitest'
import { buildClarifyPrompt, parseClarifyReply } from '../src/ai/forge/clarify'
import { buildForgeStagePrompt } from '../src/ai/forge/prompts'
import { BASELINE_PACK_IDS, CONCERNS_QUESTION_ID, SCREEN_PACK_IDS, bindUnboundConcerns, buildConcernsBlock, concernAnswersOf, concernBindTargets, decidedConcern, keptConcernPacks, openConcernsForReview, shownClarifyQuestions, withConcernQuestions } from '../src/ai/forge/concerns'
import { buildConcernInsert, openConcerns, type ConcernPack } from '../src/concerns'
import { builtInGovernanceMetamodel } from '../src/metamodel'
import type { C4Node, C4Relation } from '../src/c4'
import type { HubConcept } from '../src/hubFormat'

const PACK: ConcernPack = {
  id: 'concern-authentication', name: 'Authentication', description: 'Who is calling.',
  concern: { id: 'authentication', trigger: 'LIST RELATIONS WHERE source.type = "person"', applyTo: 'target', why: 'people reach these elements.', group: 'identity' },
  templateParams: [
    { key: 'IDENTITY', label: 'How do people sign in?', defaultValue: 'idp', options: [{ value: 'idp', label: 'a provider' }, { value: 'none', label: 'nobody signs in' }] },
    { key: 'MINUTES', label: 'Idle minutes?', defaultValue: '30' },
  ],
}
const CONCEPT: HubConcept = {
  ...PACK, category: 'concern', tags: [],
  nodes: [
    { id: 'need', type: 'need', label: 'Callers known', x: 0, y: 0 },
    { id: 'req', type: 'requirement', label: 'Calls refused', ears_type: 'ubiquitous', action: 'refuse', x: 0, y: 100 },
    { id: 'adr', type: 'adr', label: 'Nobody signs in', concern: 'authentication', status: 'accepted', context: 'c', decision: 'd', consequences: 'q', x: 0, y: 200 },
    { id: 'ff', type: 'fitness-fn', label: 'Nothing to sign in to', threshold: 't', x: 0, y: 300 },
  ],
  relations: [
    { id: 'r1', relationType: 'derives', sourceId: 'req', targetId: 'need' },
    { id: 'r2', relationType: 'implements', sourceId: 'ff', targetId: 'adr' },
  ],
}
const box = { x: 0, y: 0, width: 200, height: 100, collapsed: false }

describe('concern packs in Forge', () => {
  it('the clarify prompt lists the packs and the picked pack\'s questions come back with their options', () => {
    const prompt = buildClarifyPrompt('Requirements', 'Ludzie logują się do sklepu.', [PACK])
    expect(prompt).toContain('- concern-authentication | Authentication: Who is calling.')
    expect(prompt).toContain(`id "${CONCERNS_QUESTION_ID}"`)
    const reply = parseClarifyReply(`[{"id":"scale","question":"How many users?","kind":"text"},{"id":"${CONCERNS_QUESTION_ID}","question":"Settle?","kind":"select","multiSelect":true,"options":["Authentication","Invented"]}]`)!
    const { questions, picked } = withConcernQuestions(reply, [PACK])
    expect(picked).toEqual([PACK])
    // Only the questions with options: the details take their defaults.
    expect(questions).toEqual([
      { id: 'scale', question: 'How many users?', kind: 'text' },
      { id: CONCERNS_QUESTION_ID, question: expect.stringContaining('uncheck any that does not apply'), kind: 'select', multiSelect: true, options: ['Authentication'] },
      { id: 'concern:concern-authentication:IDENTITY', question: 'Authentication — How do people sign in?', kind: 'select', options: ['a provider', 'nobody signs in'], defaultOption: 'a provider' },
    ])
    expect(concernAnswersOf(PACK, { 'concern:concern-authentication:IDENTITY': 'nobody signs in' })).toEqual({ IDENTITY: 'none' })
    expect(concernAnswersOf(PACK, {})).toEqual({})
  })

  it('the clarify prompt lists the packs\' questions and asks for answers the description settles', () => {
    const prompt = buildClarifyPrompt('Requirements', 'Customers sign in with Google.', [PACK])
    expect(prompt).toContain('  - IDENTITY: How do people sign in? [idp = a provider; none = nobody signs in] (default idp)')
    expect(prompt).toContain('"answers" array of')
    expect(prompt).toContain('Answer only what the description says')
    const ask = buildClarifyPrompt('Requirements', 'Customers sign in with Google.', [PACK], undefined, 'ask')
    expect(ask).toContain('propose the answer, quoting the words of the description it rests on')
    expect(ask).toContain('  - IDENTITY: How do people sign in?')
  })

  it('answers the description settles come back proposed, with their words, and an answer that is no option is dropped', () => {
    const PAIR: ConcernPack = { ...PACK, templateParams: [...PACK.templateParams!, { key: 'MFA', label: 'Second factor?', defaultValue: 'off', options: [{ value: 'off', label: 'none' }, { value: 'totp', label: 'an authenticator app' }] }] }
    const reply = parseClarifyReply(JSON.stringify([{
      id: CONCERNS_QUESTION_ID, question: 'Settle?', kind: 'select', multiSelect: true, options: ['Authentication'],
      answers: [
        { pack: 'concern-authentication', key: 'IDENTITY', answer: 'idp', because: 'sign in with Google' },
        { pack: 'concern-authentication', key: 'MFA', answer: 'sms' },
        { pack: 'concern-authentication', key: 'MINUTES' },
      ],
    }]))!
    const { questions } = withConcernQuestions(reply, [PAIR])
    expect(questions).toEqual([
      expect.objectContaining({ id: CONCERNS_QUESTION_ID, options: ['Authentication'] }),
      { id: 'concern:concern-authentication:IDENTITY', question: 'Authentication — How do people sign in?', kind: 'select', options: ['a provider', 'nobody signs in'], defaultOption: 'a provider', fromDescription: 'sign in with Google' },
      { id: 'concern:concern-authentication:MFA', question: 'Authentication — Second factor?', kind: 'select', options: ['none', 'an authenticator app'], defaultOption: 'none' },
    ])
  })

  it('later stages are told the concern is decided and C4 is told what to link', () => {
    let n = 0
    const insert = buildConcernInsert(CONCEPT, { answers: { IDENTITY: 'none' }, elements: [], metamodel: builtInGovernanceMetamodel(), today: '2026-10-22', newId: () => `id${++n}`, place: () => ({ x: 0, y: 0 }) })
    const decided = decidedConcern(PACK, insert)
    const nodes = insert.nodes
    const adr = decided.adrIds[0]
    const domain = buildConcernsBlock('domain', [decided], nodes)
    expect(domain).toContain(`- Authentication: ${adr} "Nobody signs in"`)
    expect(domain).toContain('Do not write a')
    expect(domain).not.toContain('add_relation constrains')
    const c4 = buildForgeStagePrompt('c4', 'desc', buildConcernsBlock('c4', [decided], nodes))
    expect(c4).toContain('add_relation constrains')
    expect(c4).toContain(`- Authentication: decision ${adr}; fitness functions ${decided.fitnessIds[0]}; requirements ${decided.requirementIds[0]}`)
    expect(buildConcernsBlock('domain', [decided], {})).toBe('')
  })

  it('binds what the C4 stage left unbound where the pack\'s trigger points, and nothing it linked', () => {
    let n = 0
    const insert = buildConcernInsert(CONCEPT, { answers: {}, elements: [], metamodel: builtInGovernanceMetamodel(), today: '2026-10-22', newId: () => `id${++n}`, place: () => ({ x: 0, y: 0 }) })
    const decided = decidedConcern(PACK, insert)
    const nodes: Record<string, C4Node> = {
      ...insert.nodes,
      user: { id: 'user', type: 'person', label: 'Customer', ...box } as C4Node,
      web: { id: 'web', type: 'webapp', label: 'Storefront', ...box } as C4Node,
    }
    const relations: Record<string, C4Relation> = { ...insert.relations, u: { id: 'u', sourceId: 'user', targetId: 'web', relationType: 'interacts' } }
    const mm = builtInGovernanceMetamodel()
    const { relations: bound, lines } = bindUnboundConcerns([decided], [PACK], nodes, relations, mm)
    expect(bound).toEqual(expect.arrayContaining([
      { sourceId: decided.adrIds[0], targetId: 'web', relationType: 'constrains' },
      { sourceId: decided.fitnessIds[0], targetId: 'web', relationType: 'constrains' },
      { sourceId: 'web', targetId: decided.requirementIds[0], relationType: 'satisfies' },
    ]))
    expect(lines).toEqual(['Authentication: the stage linked it to nothing, so it was bound to "Storefront", where its concern applies.'])
    const linked = { ...relations, c: { id: 'c', sourceId: decided.adrIds[0], targetId: 'web', relationType: 'constrains' } }
    expect(bindUnboundConcerns([decided], [PACK], nodes, linked, mm).relations).toEqual([])
    // Nothing the concern applies to: left unbound, and said.
    expect(bindUnboundConcerns([decided], [PACK], insert.nodes, insert.relations, mm).lines[0]).toMatch(/left unbound/)
  })
})

/** A pack with one question, by id and name, its concern applying to the web apps people use. */
const pack = (id: string, name: string): ConcernPack => ({
  id, name, description: `${name}.`,
  concern: { id: id.replace(/^concern-/, ''), trigger: 'LIST RELATIONS WHERE source.type = "person" AND target.type = "webapp"', applyTo: 'target', why: 'people use it.', group: 'sdlc' },
  templateParams: [{ key: 'LEVEL', label: 'How far?', defaultValue: 'some', options: [{ value: 'some', label: 'some' }, { value: 'all', label: 'all' }] }],
})
const BASELINE = BASELINE_PACK_IDS.map((id) => pack(id, id.replace(/^concern-/, '')))
const SCREENS = SCREEN_PACK_IDS.map((id) => pack(id, id.replace(/^concern-/, '')))
const concernsQuestion = (questions: Array<{ id: string; options?: string[] }>) => questions.find((q) => q.id === CONCERNS_QUESTION_ID)

describe('Baseline packs proposed', () => {
  it('BASELINE_PACK_IDS are picked in withConcernQuestions even when the model left them out, checked in the concerns question', () => {
    const packs = [PACK, ...BASELINE, ...SCREENS]
    const reply = parseClarifyReply(`[{"id":"${CONCERNS_QUESTION_ID}","question":"Settle?","kind":"select","multiSelect":true,"options":["Authentication"]}]`)!
    const { questions, picked } = withConcernQuestions(reply, packs)
    expect(picked.map((p) => p.id)).toEqual(['concern-authentication', ...BASELINE_PACK_IDS])
    expect(concernsQuestion(questions)).toMatchObject({ kind: 'select', multiSelect: true, options: ['Authentication', ...BASELINE.map((p) => p.name)] })
    // Their questions are asked as a picked pack's are.
    expect(questions.map((q) => q.id)).toContain('concern:concern-test-strategy:LEVEL')
    // A reply with no concerns question, or none at all, still proposes them.
    expect(withConcernQuestions([], packs).picked.map((p) => p.id)).toEqual([...BASELINE_PACK_IDS])
  })

  it('only the baseline packs the catalogue has are proposed (filtered by id)', () => {
    const some = BASELINE.filter((p) => p.id !== 'concern-ci-cd-pipeline')
    expect(withConcernQuestions([], [PACK, ...some]).picked.map((p) => p.id)).toEqual(some.map((p) => p.id))
    expect(withConcernQuestions([], [PACK]).picked).toEqual([])
    expect(withConcernQuestions([], [PACK]).questions).toEqual([])
  })

  it('SCREEN_PACK_IDS come only when the model picks one of them, and then all those the catalogue has', () => {
    const packs = [...BASELINE, ...SCREENS.filter((p) => p.id !== 'concern-accessibility')]
    expect(withConcernQuestions([], packs).picked.some((p) => SCREEN_PACK_IDS.includes(p.id))).toBe(false)
    const reply = [{ id: CONCERNS_QUESTION_ID, question: 'Settle?', kind: 'select' as const, multiSelect: true, options: ['usability'] }]
    expect(withConcernQuestions(reply, packs).picked.map((p) => p.id)).toEqual(['concern-usability', ...BASELINE_PACK_IDS, 'concern-mobile-performance'])
  })

  it('the clarify prompt tells the model to always include the baseline packs, and the screen packs for a system used through screens', () => {
    const packs = [PACK, ...BASELINE, ...SCREENS]
    const json = buildClarifyPrompt('Requirements', 'A shop.', packs)
    expect(json).toContain('Always include the baseline packs: ci-cd-pipeline, test-strategy, release-versioning, code-quality-gate.')
    expect(json).toContain('the user unchecks what does not apply')
    expect(json).toContain('When people use the system through screens (a web, mobile or desktop app), also include usability, accessibility, mobile-performance')
    const ask = buildClarifyPrompt('Requirements', 'A shop.', packs, undefined, 'ask')
    expect(ask).toContain('Present your picks to the user as proposed, each checked, the baseline packs among them')
    expect(ask).toContain('a pack the user dropped is left out')
    // Without baseline packs in the catalogue, nothing is said about them.
    expect(buildClarifyPrompt('Requirements', 'A shop.', [PACK])).not.toContain('baseline')
  })

  it('an unchecked pack is not kept and its questions are not shown; unanswered, every pick is kept', () => {
    const packs = [PACK, ...BASELINE]
    const { questions, picked } = withConcernQuestions([], packs)
    expect(keptConcernPacks(picked, undefined)).toEqual(picked)
    expect(keptConcernPacks(picked, {})).toEqual(picked)
    const answers = { [CONCERNS_QUESTION_ID]: BASELINE.filter((p) => p.id !== 'concern-test-strategy').map((p) => p.name) }
    expect(keptConcernPacks(picked, answers).map((p) => p.id)).toEqual(BASELINE_PACK_IDS.filter((id) => id !== 'concern-test-strategy'))
    const shown = shownClarifyQuestions(questions, picked, answers).map((q) => q.id)
    expect(shown).not.toContain('concern:concern-test-strategy:LEVEL')
    expect(shown).toContain('concern:concern-ci-cd-pipeline:LEVEL')
    expect(shown).toContain(CONCERNS_QUESTION_ID)
    expect(keptConcernPacks(picked, { [CONCERNS_QUESTION_ID]: [] })).toEqual([])
  })
})

describe('Open concerns settled in Review', () => {
  const mm = builtInGovernanceMetamodel()
  const nodes: Record<string, C4Node> = {
    user: { id: 'user', type: 'person', label: 'Customer', ...box } as C4Node,
    shop: { id: 'shop', type: 'system', label: 'Shop', ...box } as C4Node,
    web: { id: 'web', type: 'webapp', label: 'Storefront', parentId: 'shop', ...box } as C4Node,
  }
  const relations: Record<string, C4Relation> = { u: { id: 'u', sourceId: 'user', targetId: 'web', relationType: 'interacts' } }
  const usability = pack('concern-usability', 'Usability')

  it('openConcernsForReview lists the packs the model raises and nothing settles, with what each is open for, as concern-unaddressed does', () => {
    const quiet = { ...PACK, concern: { ...PACK.concern, trigger: 'LIST NODES WHERE type = "queue"' } }
    expect(openConcerns([usability, quiet], nodes, relations, mm).map((s) => s.pack.id)).toEqual(['concern-usability'])
    expect(openConcernsForReview([usability, quiet], nodes, relations, mm)).toEqual({ packs: [usability], appliesTo: { 'concern-usability': ['Storefront'] } })
    // A metamodel with no concern on an ADR raises none.
    expect(openConcernsForReview([usability], nodes, relations, undefined).packs).toEqual([])
    // Settled by an accepted ADR marked with the concern that constrains the web app: no longer open.
    const settled = {
      nodes: { ...nodes, adr: { id: 'adr', type: 'adr', label: 'Usable', concern: 'usability', status: 'accepted', ...box } as unknown as C4Node },
      relations: { ...relations, c: { id: 'c', sourceId: 'adr', targetId: 'web', relationType: 'constrains' } },
    }
    expect(openConcernsForReview([usability], settled.nodes, settled.relations, mm).packs).toEqual([])
  })

  it('in Review every open concern is proposed whatever the model picks, and binds where its trigger points', () => {
    const { picked, questions } = withConcernQuestions([], [usability], 'review')
    expect(picked).toEqual([usability])
    expect(concernsQuestion(questions)).toMatchObject({ options: ['Usability'], question: expect.stringContaining('still open') })
    expect(concernBindTargets(usability, nodes, relations, mm)).toEqual(['web'])
    const prompt = buildClarifyPrompt('Review', 'A shop.', [usability], undefined, 'json', { stage: 'review', appliesTo: { 'concern-usability': ['Storefront'] } })
    expect(prompt).toContain('These concerns the model raises are still open')
    expect(prompt).toContain('Settle them')
    expect(prompt).toContain('- concern-usability | Usability: Usability. Open for: "Storefront".')
    expect(prompt).not.toContain('baseline')
  })
})
