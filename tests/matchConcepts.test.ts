/**
 * Hub relevance search (Radical Forge's "Suggested from the Hub" stage
 * cards + AI prompt guidance) — keyword-overlap scoring against the real
 * catalogue, so a regression here would silently make Forge stop
 * surfacing/steering by relevant prior art.
 */
import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import { readCatalogue, buildIndex } from '../tools/hubCatalogue'
import { findRelevantConcepts, scoreConceptRelevance } from '../src/renderer/src/hub/matchConcepts'
import type { HubConceptSummary } from '../src/renderer/src/hub/hubFormat'

const HUB_DIR = resolve(__dirname, '../hub')
const concepts: HubConceptSummary[] = buildIndex(readCatalogue(HUB_DIR))

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
