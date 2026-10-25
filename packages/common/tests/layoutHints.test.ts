/**
 * Layout hints: what a type is to a layout, from the metamodel, with the
 * built-in preset's hint for a built-in id that has none.
 */
import { describe, it, expect } from 'vitest'
import { builtInC4Metamodel, builtInGovernanceMetamodel, layoutRoleOf, nodeLayoutHint, relationLayoutHint } from '../src/metamodel'
import { forkPresetMetamodel } from '../src/model'

describe('layout hints', () => {
  it('the presets set them for the built-in types', () => {
    const mm = builtInGovernanceMetamodel()
    expect(nodeLayoutHint('person', mm)).toEqual({ role: 'actor', side: 'top' })
    expect(nodeLayoutHint('database', mm).role).toBe('store')
    expect(nodeLayoutHint('queue', mm).role).toBe('broker')
    expect(nodeLayoutHint('adr', mm)).toEqual({ role: 'note', side: 'left' })
    expect(nodeLayoutHint('mockup', mm).role).toBe('screen')
    expect(relationLayoutHint('derives', mm)).toEqual({ flow: 'reverse', axis: 'vertical' })
    expect(relationLayoutHint('navigates-to', mm)).toEqual({ flow: 'forward', axis: 'horizontal' })
    expect(relationLayoutHint('constrains', mm).flow).toBe('side')
    expect(relationLayoutHint('interacts', builtInC4Metamodel())).toEqual({ flow: 'forward', axis: 'free' })
  })

  it('a role by a property value: an initial pseudostate is a start, a final state an end', () => {
    const mm = builtInGovernanceMetamodel()
    expect(layoutRoleOf({ type: 'pseudostate', kind: 'initial' }, mm)).toBe('start')
    expect(layoutRoleOf({ type: 'pseudostate', kind: 'choice' }, mm)).toBe('element')
    expect(layoutRoleOf({ type: 'state', kind: 'final' }, mm)).toBe('end')
    expect(layoutRoleOf({ type: 'state', kind: 'normal' }, mm)).toBe('element')
  })

  it('built-in hints reach a forked metamodel', () => {
    // A document's copy from before the hints existed: the types without `layout`.
    const fork = forkPresetMetamodel(builtInGovernanceMetamodel())!
    for (const t of Object.values(fork.nodeTypes)) delete t.layout
    for (const r of Object.values(fork.relationTypes)) delete r.layout
    expect(layoutRoleOf({ type: 'person' }, fork)).toBe('actor')
    expect(relationLayoutHint('verifies', fork).flow).toBe('reverse')
    // The copy's own hint wins; a custom type without one is an element read forward.
    fork.nodeTypes.person.layout = { role: 'element' }
    expect(layoutRoleOf({ type: 'person' }, fork)).toBe('element')
    fork.nodeTypes.risk = { ...fork.nodeTypes.adr, id: 'risk', label: 'Risk', layout: undefined }
    expect(layoutRoleOf({ type: 'risk' }, fork)).toBe('element')
    expect(relationLayoutHint('mitigates', fork)).toEqual({ flow: 'forward', axis: 'free' })
    expect(layoutRoleOf({ type: 'person' }, null)).toBe('actor')
  })
})
