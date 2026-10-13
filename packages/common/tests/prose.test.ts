import { describe, it, expect } from 'vitest'
import {
  availableMetamodels,
  builtInGovernanceMetamodel,
  countedNoun,
  firstParagraph,
  relationDetails,
  relationPhrase,
  relationSentences,
  typeNoun,
} from '../src/metamodel/index'
import type { C4Node, C4Relation } from '../src/c4'

const mm = builtInGovernanceMetamodel()

const node = (id: string, type: string, label: string): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 10, height: 10 }) as unknown as C4Node

describe('relationPhrase', () => {
  it('reads a relation from its source by the label, from its target by the inverse label', () => {
    expect(relationPhrase(mm.relationTypes.constrains, 'out')).toEqual({ text: 'Constrains', reads: true })
    expect(relationPhrase(mm.relationTypes.constrains, 'in')).toEqual({ text: 'Constrained by', reads: true })
  })

  it('uses the forward label where the label is a name, not a verb', () => {
    expect(relationPhrase(mm.relationTypes.interacts, 'out').text).toBe('Uses')
    expect(relationPhrase(mm.relationTypes.interacts, 'in').text).toBe('Used by')
    expect(relationPhrase(mm.relationTypes.transition, 'out').text).toBe('Transitions to')
  })

  it('says that a type without an inverse label does not read from its target', () => {
    const custom = { id: 'owns', label: 'Owns', allowedPairs: [] }
    expect(relationPhrase(custom, 'out')).toEqual({ text: 'Owns', reads: true })
    expect(relationPhrase(custom, 'in')).toEqual({ text: 'Owns', reads: false })
  })

  it('has words for a relation without a type', () => {
    expect(relationPhrase(undefined, 'out').text).toBe('Relates to')
    expect(relationPhrase(undefined, 'in')).toEqual({ text: 'Linked from', reads: true })
  })

  it('every built-in relation type reads from both ends', () => {
    for (const preset of availableMetamodels()) {
      for (const def of Object.values(preset.build().relationTypes)) {
        expect(relationPhrase(def, 'in').reads, `${preset.id}: ${def.id}`).toBe(true)
      }
    }
  })
})

describe('type descriptions', () => {
  it('every built-in element and relation type says what it is', () => {
    for (const preset of availableMetamodels()) {
      const built = preset.build()
      for (const def of [...Object.values(built.nodeTypes), ...Object.values(built.relationTypes)]) {
        expect(def.description?.trim(), `${preset.id}: ${def.id}`).toBeTruthy()
      }
    }
  })
})

describe('relationSentences', () => {
  const nodes: Record<string, C4Node> = {
    pay: node('pay', 'container', 'Payments Service'),
    bus: node('bus', 'queue', 'Event Bus'),
    acc: node('acc', 'container', 'Accounts Service'),
    gw: node('gw', 'container', 'API Gateway'),
    adr: node('adr', 'adr', 'ADR-001'),
    req: node('req', 'requirement', 'Instant confirmation'),
  }
  const relations: C4Relation[] = [
    { id: 'r1', sourceId: 'pay', targetId: 'bus', relationType: 'interacts', label: 'Publishes events' },
    { id: 'r2', sourceId: 'pay', targetId: 'acc', relationType: 'interacts' },
    { id: 'r3', sourceId: 'gw', targetId: 'pay', relationType: 'interacts' },
    { id: 'r4', sourceId: 'adr', targetId: 'pay', relationType: 'constrains' },
    { id: 'r5', sourceId: 'pay', targetId: 'req', relationType: 'satisfies' },
    { id: 'r6', sourceId: 'gw', targetId: 'acc', relationType: 'interacts' },
  ]

  it('groups by direction and type, outgoing first, in the order of the metamodel', () => {
    const sentences = relationSentences('pay', relations, nodes, mm)
    expect(sentences.map((s) => `${s.phrase.text}: ${s.relations.map((r) => r.id).join(',')}`)).toEqual([
      'Uses: r2,r1', // Accounts Service before Event Bus
      'Satisfies: r5',
      'Used by: r3',
      'Constrained by: r4',
    ])
  })

  it('reads a relation without a type as the one type its ends allow', () => {
    const [sentence] = relationSentences('pay', [{ id: 'x', sourceId: 'pay', targetId: 'bus' }], nodes, mm)
    expect(sentence).toMatchObject({ typeId: 'interacts', phrase: { text: 'Uses' } })
  })

  it('reads a relation as untyped when its type is gone and its ends allow none', () => {
    const [sentence] = relationSentences('bus', [{ id: 'x', sourceId: 'bus', targetId: 'adr', relationType: 'gone' }], nodes, mm)
    expect(sentence).toMatchObject({ typeId: undefined, phrase: { text: 'Relates to' } })
  })
})

describe('relationDetails', () => {
  const nodes: Record<string, C4Node> = { paid: node('paid', 'event', 'Payment received') }

  it('lists the label and the properties that are set', () => {
    const rel = { id: 'r', sourceId: 'a', targetId: 'b', relationType: 'interacts', label: 'API calls', technology: 'HTTPS / REST' }
    expect(relationDetails(rel, mm.relationTypes.interacts, nodes)).toEqual(['API calls', 'HTTPS / REST'])
  })

  it('names referenced nodes and leaves out an enum at its default', () => {
    const rel = { id: 'r', sourceId: 'a', targetId: 'b', relationType: 'transition', event: 'paid', kind: 'external', guard: 'amount > 0' } as unknown as C4Relation
    expect(relationDetails(rel, mm.relationTypes.transition, nodes)).toEqual(['Payment received', 'amount > 0'])
  })

  it('keeps the technology of a relation without a type', () => {
    expect(relationDetails({ id: 'r', sourceId: 'a', targetId: 'b', technology: 'gRPC' }, undefined, nodes)).toEqual(['gRPC'])
  })
})

describe('counted nouns', () => {
  it('writes type labels in lower case, keeping acronyms', () => {
    expect(typeNoun('Software System')).toBe('software system')
    expect(typeNoun('ADR', true)).toBe('ADRs')
    expect(typeNoun('Entity', true)).toBe('entities')
    expect(typeNoun('Person', true)).toBe('people')
  })

  it('counts in words and falls back to "elements" for mixed types', () => {
    expect(countedNoun(3, ['Domain', 'Domain', 'Domain'])).toBe('three domains')
    expect(countedNoun(1, ['Fitness Function'])).toBe('one fitness function')
    expect(countedNoun(2, ['Container', 'Database'])).toBe('two elements')
    expect(countedNoun(14, Array(14).fill('Requirement'))).toBe('14 requirements')
  })
})

describe('firstParagraph', () => {
  it('stops at the first blank line', () => {
    expect(firstParagraph('  One line\nstill one.\n\nSecond.')).toBe('One line\nstill one.')
    expect(firstParagraph(undefined)).toBe('')
  })
})
