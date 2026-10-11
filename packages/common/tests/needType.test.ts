import { describe, it, expect } from 'vitest'
import { builtInGovernanceMetamodel } from '../src/metamodel'

describe('need node type (governance preset)', () => {
  const mm = builtInGovernanceMetamodel()
  const pairsOf = (rel: string) => mm.relationTypes[rel].allowedPairs.map((p) => `${p.from}->${p.to}`)

  it('keeps the free text in description, so it is the Markdown body of its file', () => {
    const need = mm.nodeTypes.need
    expect(need).toBeDefined()
    expect(need.properties?.find((p) => p.key === 'description')?.type).toBe('textarea')
    expect(need.tableTab).toBe(true)
    // Being in the model means it is accepted — no workflow status.
    expect(need.properties?.some((p) => p.key === 'status')).toBe(false)
  })

  it('is what requirements derive from, nests under a broader need, and lists both as its children', () => {
    expect(pairsOf('derives')).toEqual(['requirement->requirement', 'requirement->need', 'need->need'])
    expect(mm.nodeTypes.need.hierarchyRelation).toBe('derives')
  })

  it('is not a requirement: nothing satisfies, verifies or illustrates it', () => {
    for (const rel of ['satisfies', 'verifies', 'illustrates', 'constrains', 'traces-to']) {
      expect(pairsOf(rel).some((p) => p.endsWith('->need') || p.startsWith('need->'))).toBe(false)
    }
  })
})
