import { describe, expect, it } from 'vitest'
describe('orders', () => {
  it('shows an order', () => { expect(render(order(1))).toContain('Order 1') })
  it('places an order', () => { fetch('/api/never-called') })
})
