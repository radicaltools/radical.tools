import { test, expect, fixture } from '../../support/fixtures'

// An element's long fields are Markdown (packages/common/src/markdown.ts):
// the table renders its summary, the wiki its description, and a card on
// the canvas shows the text without its marks.

const DESCRIPTION = 'Card payments via **Stripe**. More later.\n\n- refunds\n- [status page](https://status.example.com)'

test.describe('Markdown in an element\'s fields', () => {
  test.beforeEach(async ({ studio }) => {
    const doc = JSON.parse(fixture('bookstore'))
    doc.nodes = doc.nodes.map((n: { id: string }) => (n.id === 'payments' ? { ...n, description: DESCRIPTION } : n))
    doc.metamodel = { id: 'c4-ddd-governance-builtin', name: 'Radical', nodeTypes: {}, relationTypes: {} }
    doc.nodes.push({ id: 'req-keep', type: 'requirement', label: 'Keep payments', ears_type: 'ubiquitous', action: 'keep **every** payment', x: 0, y: 900, width: 200, height: 80, collapsed: false })
    doc.views.push({ id: 'v-wiki', kind: 'wiki', name: 'Wiki', nodeIds: [], positions: {} })
    await studio.seedDocument(JSON.stringify(doc))
  })

  test('the table renders the summary as Markdown, a requirement\'s too, its tooltip as plain text', async ({ page, studio }) => {
    await studio.open('v-table')
    const summary = page.locator('tr[data-node-id="payments"] .tv-cell-summary')
    await expect(summary.locator('strong')).toHaveText('Stripe')
    await expect(summary).toHaveText('Card payments via Stripe.')
    await expect(summary).toHaveAttribute('title', 'Card payments via Stripe.')
    // A requirement: who shall do what, in bold as a whole (its action's own bold folded in).
    const requirement = page.locator('tr[data-node-id="req-keep"] .tv-cell-summary')
    await expect(requirement.locator('strong')).toHaveText('The system shall keep every payment')
    await expect(requirement).toHaveText('The system shall keep every payment')
    await expect(requirement).toHaveAttribute('title', 'The system shall keep every payment.')
  })

  test('the wiki renders the description, and edits it as written', async ({ page, studio }) => {
    await studio.open('v-wiki/f/payments')
    const lead = page.locator('.wiki-lead')
    await expect(lead.locator('strong')).toHaveText('Stripe')
    await expect(lead.locator('li')).toHaveText(['refunds', 'status page'])
    // A link opens outside the app.
    await expect(lead.getByRole('link', { name: 'status page' })).toHaveAttribute('target', '_blank')
    await lead.getByText('refunds').click()
    await expect(page.locator('textarea.wiki-lead')).toHaveValue(DESCRIPTION)
  })

  // D13 and the open points of runs 45 to 64: a remote image was fetched
  // (a request that left the machine), links the sanitizer emptied were
  // drawn as links that did nothing, and a link to a wiki page opened a tab.
  test('a remote image is a link with its address, an emptied link is text, a link into the app opens here', async ({ page, studio }) => {
    const requests: string[] = []
    page.on('request', (r) => { if (!r.url().startsWith('http://localhost') && !r.url().startsWith('data:')) requests.push(r.url()) })
    await studio.open('v-wiki/f/payments')
    await page.locator('.wiki-lead').getByText('refunds').click()
    const text = 'Logo: ![the logo](https://images.example.com/logo.png)\n\n[bad](javascript:alert(1)) and [see API](#/d/ls%3Ae2e-doc/m/designer/v/v-wiki/f/api)'
    await page.locator('textarea.wiki-lead').fill(text)
    await page.locator('.wiki-title').click()
    const lead = page.locator('.wiki-lead')
    const image = lead.getByRole('link', { name: 'the logo (https://images.example.com/logo.png)' })
    await expect(image).toHaveAttribute('href', 'https://images.example.com/logo.png')
    await expect(lead.locator('img')).toHaveCount(0)
    await expect(lead.getByText('bad', { exact: true })).toBeVisible()
    await expect(lead.getByRole('link', { name: 'bad' })).toHaveCount(0)
    const inApp = lead.getByRole('link', { name: 'see API' })
    await expect(inApp).not.toHaveAttribute('target', '_blank')
    await inApp.click()
    await expect(page.locator('.wiki-title')).toHaveText('API')
    expect(page.context().pages()).toHaveLength(1)
    expect(requests).toEqual([])
  })

  // Item 244: four more forms the browser resolves to another host were
  // drawn as images and fetched.
  test('an image the browser would fetch from another host is a link, whatever form its address has', async ({ page, studio }) => {
    const requests: string[] = []
    page.on('request', (r) => { if (!r.url().startsWith('http://localhost') && !r.url().startsWith('data:')) requests.push(r.url()) })
    await studio.open('v-wiki/f/payments')
    await page.locator('.wiki-lead').getByText('refunds').click()
    const text = ['![b](https:evil.example/b.png)', '![c](\\\\\\\\evil.example/c.png)', '![d](/\\\\evil.example/d.png)', '![h](https:/evil.example/h.png)'].join('\n\n')
    await page.locator('textarea.wiki-lead').fill(text)
    await page.locator('.wiki-title').click()
    const lead = page.locator('.wiki-lead')
    await expect(lead.locator('.md-remote-image')).toHaveCount(4)
    await expect(lead.locator('img')).toHaveCount(0)
    expect(requests).toEqual([])
  })

  test('a card on the canvas shows the description without its marks', async ({ page, studio }) => {
    await studio.open('v-context')
    const desc = studio.node('payments').locator('.c4-node-desc')
    await expect(desc).toContainText('Card payments via Stripe. More later.')
    await expect(desc).not.toContainText('**')
  })
})
