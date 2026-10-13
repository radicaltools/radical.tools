import { test, expect } from '../../support/fixtures'

// The wiki view on the bundled Fintech sample: its Architecture Wiki (the C4
// elements of the Core Banking Platform). A page reads as an article, the
// model is edited from one menu, and the list of pages is searched by what
// the pages say.

test.describe('wiki', () => {
  test.beforeEach(async ({ studio }) => {
    await studio.openSample('view-wiki')
  })

  test('an element page reads as an article', async ({ page, studio }) => {
    await studio.open('view-wiki/f/ctn-payments', 'viewer', studio.activeDocId())
    await expect(page.locator('.wiki-title')).toHaveText('Payments Service')
    await expect(page.locator('.wiki-doc-header .wiki-byline')).toHaveText('Container in Banking Services')
    // Relations are sentences, read from this element: outgoing, then incoming.
    const relations = page.locator('.wiki-relations')
    await expect(relations).toContainText('Uses Event Bus (Publishes payment.completed, Kafka producer)')
    await expect(relations).toContainText('Used by API Gateway')
    // Short facts sit in the infobox, children under a heading for their type.
    await expect(page.locator('.wiki-infobox')).toContainText('Go 1.22 / gRPC')
    await expect(page.getByRole('heading', { name: 'Components (2)' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'FX Engine' })).toBeVisible()
    // A reader has nothing to edit.
    await expect(page.getByRole('button', { name: /^Edit / })).toHaveCount(0)
  })

  test('Multi page writes the children as chapters, and a group by its own name', async ({ page, studio }) => {
    await studio.open('view-wiki/f/sys-core', 'designer', studio.activeDocId())
    await page.getByRole('button', { name: 'Multi page' }).click()
    await expect(page.getByRole('heading', { level: 2, name: 'Banking Services' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /^Groups/ })).toHaveCount(0)
    await expect(page.getByRole('navigation', { name: 'Contents' })).toContainText('Risk & Data')
    // The containers of a chapter are named under their type, with what the type is.
    await expect(page.getByRole('heading', { name: 'Containers (2)' }).first()).toBeVisible()
    await expect(page.locator('.wiki-hatnote:visible').first()).toContainText('deployed on its own')
    await page.getByRole('button', { name: 'Open Banking Services' }).click()
    await expect(page).toHaveURL(/\/v\/view-wiki\/f\/dom-banking$/)
    await expect(page.locator('.wiki-title')).toHaveText('Banking Services')
  })

  test('the glossary says what the types and relations of the model are', async ({ page }) => {
    await page.getByRole('button', { name: 'Glossary' }).click()
    await expect(page).toHaveURL(/\/v\/view-wiki\/f\/_glossary$/)
    await expect(page.locator('.wiki-title')).toHaveText('Glossary')
    await expect(page.locator('#wiki-g-type-container')).toContainText('Something that runs or stores data')
    await expect(page.locator('#wiki-g-relation-interacts')).toContainText('Reads “Uses”, and back “Used by”')
    // A type the view does not use is only named.
    await expect(page.locator('#wiki-g-type-adr')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Not used here' })).toBeVisible()
  })

  test('the element menu adds a relationship in two steps, edits one and opens the facts', async ({ page, studio }) => {
    const doc = studio.activeDocId()
    await studio.open('view-wiki/f/ctn-payments', 'designer', doc)

    // How it reads from this element, then the element it names.
    await page.getByRole('button', { name: 'Edit Payments Service' }).click()
    await page.getByRole('menuitem', { name: 'Add relationship' }).click()
    await page.getByRole('menuitem', { name: 'Uses…' }).click()
    await page.getByRole('menuitem', { name: 'Accounts Service' }).click()
    await expect(page.locator('.wiki-relations')).toContainText('Uses Accounts Service')
    await expect.poll(async () => {
      const saved = await studio.storedDoc(doc) as unknown as {
        relations: Array<{ sourceId: string; targetId: string; relationType?: string }>
      }
      return saved.relations.some((r) => r.sourceId === 'ctn-payments' && r.targetId === 'ctn-accounts' && r.relationType === 'interacts')
    }, { timeout: 15_000 }).toBe(true)

    // A right click on an element in the sentence: the menu of that relation.
    await page.getByRole('link', { name: 'Event Bus' }).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Edit relationship' }).click()
    await expect(page.locator('.wiki-rel-editor')).toContainText('Event Bus')

    // A right click in the list of pages: the menu of that page's element.
    await page.locator('.wiki-nav-row', { hasText: 'Core Banking Platform' }).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Edit facts' }).click()
    await expect(page.locator('.wiki-title')).toHaveText('Core Banking Platform')
    await expect(page.locator('.wiki-infobox')).toContainText('External')
    await page.getByRole('button', { name: 'Done editing facts' }).click()
    await expect(page.locator('.wiki-infobox')).toHaveCount(0)
  })

  test('search finds a page by what it says and opens it on Enter', async ({ page }) => {
    const search = page.getByRole('searchbox', { name: 'Search pages' })
    await search.fill('jwt')
    // "JWT" is in no name, only in the description of Auth Service.
    await expect(page.locator('.wiki-nav-item.match')).toHaveText(['Auth Service'])
    await expect(page.locator('.wiki-nav-snippet')).toContainText('Issues JWT tokens')
    await search.press('Enter')
    await expect(page.locator('.wiki-title')).toHaveText('Auth Service')
    await search.fill('nothing like this')
    await expect(page.locator('.wiki-nav-empty')).toBeVisible()
  })
})
