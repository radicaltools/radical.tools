import { describe, expect, it } from 'vitest'
import { pageOf, pathTest, pathTestFile, pathTestId, stepLabel, type PathFact, type ScreenFact } from '../src/index'

const screen = (n: number, route: string, headings: string[]): ScreenFact => ({ id: `explore:screen:${n}`, url: `http://localhost:3000${route}`, route, title: '', headings, controls: [], evidence: { file: `screens/00${n}.png`, line: 1 } })

const PATH: PathFact = {
  id: 'explore:path:place-an-order', name: 'Place an order', origin: 'http://localhost:3000', repository: 'shop',
  steps: [
    { action: 'goto', to: 'explore:screen:1' },
    { action: 'fill', control: { role: 'textbox', name: 'Password', locator: 'getByRole("textbox", { name: "Password", exact: true })' }, secret: true, from: 'explore:screen:1', to: 'explore:screen:2' },
    { action: 'select', control: { role: 'combobox', name: 'Size', locator: 'getByTestId("size")' }, value: 'L', from: 'explore:screen:2', to: 'explore:screen:3' },
    { action: 'click', control: { role: 'button', name: 'Order', locator: 'getByRole("button", { name: "Order", exact: true })' }, from: 'explore:screen:3', to: 'explore:screen:4' },
  ],
  evidence: { file: 'screens/001.png', line: 1 },
}
const SCREENS = new Map([screen(1, '/shop/`x`', ['Shop']), screen(2, '/shop/`x`', ['Shop']), screen(3, '/shop/`x`', ['Shop']), screen(4, '/orders/42?new=1', [])].map((s) => [s.id, s]))

describe('radical assay: a path as a test', () => {
  it('replays the path with the locators recorded, checks each screen it reaches, and keeps no password', () => {
    const test = pathTest(PATH, SCREENS, '2026-11-07')
    expect(test).toContain("// Written by Radical Assay from the path \"Place an order\", explored on 2026-11-07 at http://localhost:3000.")
    expect(test).toContain('const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000"')
    expect(test).toContain('await page.goto(`${BASE}/shop/\\`x\\``)')
    expect(test).toContain("await expect(page.getByRole('heading', { name: \"Shop\", exact: true }).first()).toBeVisible()")
    expect(test).toContain("const PASSWORD = process.env.E2E_PASSWORD ?? ''")
    expect(test).toContain('.fill(PASSWORD)')
    expect(test).toContain('await page.getByTestId("size").selectOption("L")')
    expect(test).toContain('await page.getByRole("button", { name: "Order", exact: true }).click()')
    // A screen with no heading is checked by its address, the query aside.
    expect(test).toContain('await expect(page).toHaveURL(new RegExp("/orders/42(\\\\?|#|$)"))')
    expect(pathTestFile(PATH)).toBe('e2e/assay/place-an-order.spec.ts')
    expect(pathTestId(PATH)).toBe('e2e/assay/place-an-order.spec.ts › Place an order')
    expect(stepLabel(PATH.steps[3])).toBe('clicks button "Order"')
    expect(pathTestFile({ ...PATH, name: '../../etc' })).toBe('e2e/assay/etc.spec.ts')
  })

  it('checks a heading with a number by any number, and once for a screen that did not change', () => {
    const created = new Map([screen(1, '/orders/new', ['New order']), screen(2, '/orders/3', ['Order 3'])].map((x) => [x.id, x]))
    const path: PathFact = { ...PATH, steps: [
      { action: 'goto', to: 'explore:screen:1' },
      { action: 'fill', control: { role: 'spinbutton', name: 'Quantity', locator: 'getByRole("spinbutton", { name: "Quantity", exact: true })' }, value: '2', from: 'explore:screen:1', to: 'explore:screen:1' },
      { action: 'click', control: { role: 'button', name: 'Place order', locator: 'getByRole("button", { name: "Place order", exact: true })' }, from: 'explore:screen:1', to: 'explore:screen:2' },
    ] }
    const test = pathTest(path, created, '2026-11-07')
    expect(test.match(/New order/g)).toHaveLength(1)
    expect(test).toContain("await expect(page.getByRole('heading', { name: /^Order \\d+$/ }).first()).toBeVisible()")
  })

  it('takes the routes of one page as one, whatever their data', () => {
    expect(pageOf('/orders/42?tab=items#top')).toBe('/orders/{id}')
    expect(pageOf('/users/5f2b3c1d9e8a7b6c5d4e3f2a/edit')).toBe('/users/{id}/edit')
    expect(pageOf('/a/123e4567-e89b-12d3-a456-426614174000')).toBe('/a/{id}')
    expect(pageOf('/')).toBe('/')
    expect(pageOf('/orders/')).toBe('/orders')
  })
})
