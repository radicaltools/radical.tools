/**
 * Radical Forge and the Hub's concern packs: the Requirements stage's clarify
 * step offers them, the picked packs' questions are asked, later stages are
 * told what is decided, the C4 stage what to link, and what it leaves
 * unbound is bound where the pack's trigger points.
 */
import { describe, it, expect } from 'vitest'
import { buildClarifyPrompt, parseClarifyReply } from '../src/ai/forge/clarify'
import { buildForgeStagePrompt } from '../src/ai/forge/prompts'
import { CONCERNS_QUESTION_ID, bindUnboundConcerns, buildConcernsBlock, concernAnswersOf, decidedConcern, withConcernQuestions } from '../src/ai/forge/concerns'
import { buildConcernInsert, type ConcernPack } from '../src/concerns'
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
