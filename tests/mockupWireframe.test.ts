/**
 * Mockup node type: metamodel wiring, the AI wireframe prompt built from the
 * surrounding model, SVG extraction/sanitising of raw model output, and the
 * wireframe surviving an md-folder round-trip as multi-line frontmatter.
 */
import { describe, it, expect } from 'vitest'
import {
  buildWireframePrompt,
  sanitizeWireframeSvg,
  MAX_WIREFRAME_CHARS,
} from '../src/renderer/src/ai/mockupWireframe'
import { builtInGovernanceMetamodel, inferRelationType, isRelationAllowed } from '../src/renderer/src/types/metamodel'
import { serializeToMdFolder, deserializeFromMdFolder } from '../src/renderer/src/persist/mdFolder'
import type { C4Node, C4Relation } from '../src/renderer/src/types/c4'

function node(partial: Partial<C4Node> & Pick<C4Node, 'id' | 'type' | 'label'> & Record<string, unknown>): C4Node {
  return { collapsed: false, x: 0, y: 0, width: 220, height: 190, ...partial } as C4Node
}

describe('mockup metamodel', () => {
  const mm = builtInGovernanceMetamodel()

  it('defines the mockup node type without a status property', () => {
    const def = mm.nodeTypes.mockup
    expect(def).toBeDefined()
    expect(def.properties?.map((p) => p.key)).toEqual(['description', 'screen', 'link'])
  })

  it('infers the specific relation type for each mockup pair', () => {
    expect(inferRelationType(mm, 'mockup', 'requirement')).toBe('illustrates')
    expect(inferRelationType(mm, 'mockup', 'scenario')).toBe('illustrates')
    expect(inferRelationType(mm, 'mockup', 'webapp')).toBe('presented-by')
    expect(inferRelationType(mm, 'mockup', 'mockup')).toBe('navigates-to')
    expect(isRelationAllowed(mm, 'requirement', 'mockup')).toBe(false)
  })
})

describe('buildWireframePrompt', () => {
  const nodes: Record<string, C4Node> = {
    m1: node({ id: 'm1', type: 'mockup', label: 'Checkout', screen: '/checkout', description: 'Pay for the basket' }),
    m2: node({ id: 'm2', type: 'mockup', label: 'Order confirmation' }),
    r1: node({ id: 'r1', type: 'requirement', label: 'REQ-1', action: 'accept card payments' }),
    s1: node({ id: 's1', type: 'scenario', label: 'Declined card', given: 'a basket', when: 'the card is declined', then: 'an error is shown' }),
    w1: node({ id: 'w1', type: 'webapp', label: 'Storefront', technology: 'React' }),
    other: node({ id: 'other', type: 'requirement', label: 'UNRELATED' }),
  }
  const relations: Record<string, C4Relation> = {
    a: { id: 'a', sourceId: 'm1', targetId: 'r1', relationType: 'illustrates' },
    b: { id: 'b', sourceId: 'm1', targetId: 's1', relationType: 'illustrates' },
    c: { id: 'c', sourceId: 'm1', targetId: 'w1', relationType: 'presented-by' },
    d: { id: 'd', sourceId: 'm1', targetId: 'm2', relationType: 'navigates-to', label: 'Pay' },
  }

  it('includes the linked model context', () => {
    const prompt = buildWireframePrompt('m1', nodes, relations)
    expect(prompt).toContain('"Checkout"')
    expect(prompt).toContain('/checkout')
    expect(prompt).toContain('Pay for the basket')
    expect(prompt).toContain('REQ-1: the system shall accept card payments')
    expect(prompt).toContain('When the card is declined')
    expect(prompt).toContain('Storefront — React')
    expect(prompt).toContain('Order confirmation (via Pay)')
    expect(prompt).not.toContain('UNRELATED')
  })

  it('throws for an unknown node', () => {
    expect(() => buildWireframePrompt('nope', nodes, relations)).toThrow()
  })
})

describe('sanitizeWireframeSvg', () => {
  it('extracts the svg from fenced / chatty output', () => {
    const svg = sanitizeWireframeSvg('Here you go:\n```svg\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect/></svg>\n```')
    expect(svg).toBe('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect/></svg>')
  })

  it('returns null when there is no svg', () => {
    expect(sanitizeWireframeSvg('Sorry, I cannot do that.')).toBeNull()
  })

  it('strips scripts, foreignObject, event handlers and external hrefs', () => {
    const svg = sanitizeWireframeSvg(
      '<svg viewBox="0 0 1 1"><script>alert(1)</script><foreignObject><div/></foreignObject>'
      + '<rect onclick="alert(1)" onload=\'x()\'/><image href="https://evil/x.png"/><use xlink:href="#a"/></svg>',
    )!
    expect(svg).not.toMatch(/script|foreignObject|onclick|onload|evil/)
    expect(svg).toContain('xlink:href="#a"')
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
  })

  it('rejects oversized output', () => {
    const big = `<svg xmlns="http://www.w3.org/2000/svg">${'<rect/>'.repeat(MAX_WIREFRAME_CHARS)}</svg>`
    expect(sanitizeWireframeSvg(big)).toBeNull()
  })
})

describe('mockup md-folder round-trip', () => {
  it('keeps a multi-line wireframe and link lossless', () => {
    const wireframe = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">\n  <rect x="0" y="0" width="400" height="40"/>\n\n  <text x="10" y="25">Checkout</text>\n</svg>'
    const m = node({ id: 'm1', type: 'mockup', label: 'Checkout', link: 'https://figma.com/file/abc', wireframe })
    const { data } = deserializeFromMdFolder(serializeToMdFolder({ nodes: [m], relations: [] }))
    const back = data.nodes[0] as unknown as Record<string, unknown>
    expect(back.wireframe).toBe(wireframe)
    expect(back.link).toBe('https://figma.com/file/abc')
  })
})
