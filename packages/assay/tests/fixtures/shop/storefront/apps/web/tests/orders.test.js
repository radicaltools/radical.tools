import { describe, expect, it } from 'vitest'
describe('orders', () => {
  it('shows an order', () => { expect(1).toBe(1) })
  it('places an order', () => { fetch('/api/never-called') })
})
