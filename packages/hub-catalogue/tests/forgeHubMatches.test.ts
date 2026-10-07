/**
 * Hub relevance search (Radical Forge's "Suggested from the Hub" stage
 * cards + AI prompt guidance) — keyword-overlap scoring against the real
 * catalogue, so a regression here would silently make Forge stop
 * surfacing/steering by relevant prior art.
 */
import { describe, it, expect } from 'vitest'
import { readCatalogue, buildIndex } from '../src/catalogue'
import { findRelevantConcepts, forgeHubMatches, scoreConceptRelevance } from '@radical/common/ai/forge'
import type { HubConceptSummary } from '@radical/common/hubFormat'

const concepts: HubConceptSummary[] = buildIndex(readCatalogue())

describe('findRelevantConcepts', () => {
  it('ranks the Anti-Corruption Layer pattern top for a legacy-integration description', () => {
    const description = 'We are integrating with a legacy mainframe billing system and need to keep our clean domain model isolated from its quirks and technical debt.'
    const matches = findRelevantConcepts(concepts, ['pattern', 'adr'], description, 'c4-ddd-governance-builtin')
    expect(matches.length).toBeGreaterThan(0)
    expect(matches[0].id).toBe('pattern-anti-corruption-layer')
  })

  it('restricts results to the requested categories', () => {
    const description = 'legacy integration anti-corruption domain model'
    const matches = findRelevantConcepts(concepts, 'pattern', description, 'c4-ddd-governance-builtin')
    expect(matches.every((m) => m.category === 'pattern')).toBe(true)
  })

  it('excludes concepts authored for a different metamodel', () => {
    const withForeignMetamodel: HubConceptSummary = {
      ...concepts[0],
      id: 'foreign-metamodel-concept',
      requiredMetamodel: 'some-other-metamodel',
      name: 'Legacy integration widget',
      description: 'legacy integration anti-corruption domain model',
    }
    const matches = findRelevantConcepts(
      [withForeignMetamodel],
      withForeignMetamodel.category,
      'legacy integration anti-corruption domain model',
      'c4-ddd-governance-builtin',
    )
    expect(matches).toEqual([])
  })

  it('returns nothing for an unrelated query', () => {
    const matches = findRelevantConcepts(concepts, 'pattern', 'xyzzy plugh quux', 'c4-ddd-governance-builtin')
    expect(matches).toEqual([])
  })

  it('weighs a tag match higher than a single prose-word match', () => {
    const queryTokens = new Set(['integration'])
    const tagMatch: HubConceptSummary = { ...concepts[0], name: 'Something', description: 'unrelated', tags: ['integration'] }
    const proseMatch: HubConceptSummary = { ...concepts[0], name: 'Something', description: 'about integration', tags: [] }
    expect(scoreConceptRelevance(queryTokens, tagMatch)).toBeGreaterThan(scoreConceptRelevance(queryTokens, proseMatch))
  })
})

describe('forgeHubMatches', () => {
  const description = 'We are integrating with a legacy mainframe billing system and need to keep our clean domain model isolated from its quirks and technical debt.'

  it('suggests patterns and ADRs for the C4 stage and nothing for scenarios or mockups', () => {
    const byStage = forgeHubMatches(concepts, description, 'c4-ddd-governance-builtin')
    expect(byStage.c4?.[0].id).toBe('pattern-anti-corruption-layer')
    expect(byStage.c4?.every((c) => ['pattern', 'adr', 'requirement'].includes(c.category))).toBe(true)
    expect(byStage.fitness?.every((c) => c.category === 'fitness-function')).toBe(true)
    expect(byStage.scenarios).toBeUndefined()
    expect(byStage.mockups).toBeUndefined()
  })

  it('suggests nothing without a description', () => {
    expect(forgeHubMatches(concepts, '  ', undefined)).toEqual({})
  })
})
