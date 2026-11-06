import { describe, it } from 'vitest'
describe('orders', () => {
  it('shows an order', () => {})
  it('places an order', () => { fetch('/api/never-called') })
})
