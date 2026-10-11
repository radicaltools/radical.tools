import { describe, it, expect } from 'vitest'
import { NODE_SIZES, nodeTypeSize } from '../src/c4'
import { builtInGovernanceMetamodel } from '../src/metamodel'

describe('nodeTypeSize', () => {
  it('gives a custom type its size from the metamodel', () => {
    const mm = builtInGovernanceMetamodel()
    mm.nodeTypes['payment-gateway'] = { ...mm.nodeTypes.container, id: 'payment-gateway', label: 'Payment gateway', width: 240, height: 110 }
    expect(nodeTypeSize('payment-gateway', mm)).toEqual({ width: 240, height: 110 })
  })

  it('falls back to the built-in size without a metamodel', () => {
    expect(nodeTypeSize('container')).toEqual(NODE_SIZES.container)
  })

  it('falls back to a default for a type nobody knows', () => {
    expect(nodeTypeSize('unknown-type', builtInGovernanceMetamodel())).toEqual({ width: 160, height: 90 })
  })
})
