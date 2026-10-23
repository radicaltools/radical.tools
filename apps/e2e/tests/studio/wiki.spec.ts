import { test, expect, fixture } from '../../support/fixtures'
import { addPicker } from '../../support/addPicker'
import { ModelFolder, test as folderTest } from '../../support/folder'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'

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

  test('the Depth in the view properties sets how many levels Multi page writes out', async ({ page, studio }) => {
    await studio.open('view-wiki/f/sys-core', 'designer', studio.activeDocId())
    await page.getByRole('button', { name: 'Multi page' }).click()
    // One level: the domains are chapters, their containers only named.
    await expect(page.getByRole('heading', { level: 2, name: 'Banking Services' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Payments Service' })).toHaveCount(0)
    const card = page.locator('.lp-view-card', { hasText: 'Architecture Wiki' })
    await card.hover()
    await card.getByTitle('View properties').click()
    const depth = page.locator('.props-content').getByLabel('Depth')
    await expect(depth).toHaveValue('1')
    // A wiki has no layout to choose.
    await expect(page.locator('.props-content')).not.toContainText('Auto-layout')
    await depth.selectOption('2')
    await expect(page.getByRole('heading', { name: 'Payments Service' })).toBeVisible()
    // The menu at the top no longer has it.
    await expect(page.getByText('Wiki multi-page depth')).toHaveCount(0)
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

  test('the element menu adds a relationship in the picker, edits one and opens the facts', async ({ page, studio }) => {
    const doc = studio.activeDocId()
    await studio.open('view-wiki/f/ctn-payments', 'designer', doc)

    // How it reads from this element, then the element it names.
    await page.getByRole('button', { name: 'Edit Payments Service' }).click()
    await page.getByRole('menuitem', { name: 'Add or link…' }).click()
    const picker = addPicker(page, 'Payments Service')
    await picker.choose('uses…')
    await picker.field().fill('accounts')
    await picker.option(/Accounts Service/).click()
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

  test('Back from the first page read goes to the Overview', async ({ page }) => {
    await expect(page).toHaveURL(/\/v\/view-wiki$/)
    const overview = await page.locator('.wiki-title').innerText()
    // The opened view's address is written first: changes within 150 ms are one step.
    await page.waitForTimeout(400)
    await page.locator('.wiki-page').getByText('Core Banking Platform', { exact: true }).first().click()
    await expect(page).toHaveURL(/\/v\/view-wiki\/f\/sys-core$/)
    await expect(page.locator('.wiki-title')).toHaveText('Core Banking Platform')
    const back = page.getByRole('button', { name: 'Back', exact: true })
    await expect(back).toBeEnabled()
    await back.click()
    await expect(page).toHaveURL(/\/v\/view-wiki$/)
    await expect(page.locator('.wiki-title')).toHaveText(overview)
    // The Overview's entry is still there, and the page after it.
    await page.getByRole('button', { name: 'Forward', exact: true }).click()
    await expect(page.locator('.wiki-title')).toHaveText('Core Banking Platform')
  })

  test("a requirement's sentence sits beside the facts box, not over it", async ({ page, studio }) => {
    await studio.open('view-product-wiki/f/req-sca', 'designer', studio.activeDocId())
    const facts = page.locator('.wiki-infobox')
    const sentence = page.locator('.wiki-ears-sentence .ears-sentence')
    await expect(sentence).toBeVisible()
    // What is drawn at the top of the facts box is the box.
    const top = await facts.evaluate((box) => {
      const r = box.getBoundingClientRect()
      return [8, 30].map((dy) => box.contains(document.elementFromPoint(r.x + r.width / 2, r.y + dy)))
    })
    expect(top).toEqual([true, true])
    const f = (await facts.boundingBox())!
    const s = (await sentence.boundingBox())!
    if (s.y < f.y + f.height) expect(s.x + s.width).toBeLessThanOrEqual(f.x)
  })
})

// Writing in the wiki: a new model is written down from its Overview, with
// no wizard and no change of page.
test.describe('writing in the wiki', () => {
  const EMPTY = JSON.stringify({
    nodes: [],
    relations: [],
    sequences: [],
    views: [{ id: 'v-wiki', kind: 'wiki', name: 'Wiki', nodeIds: [], positions: {}, viewport: { x: 0, y: 0, zoom: 1 } }],
    snapshots: [],
    presentations: [],
    metamodel: { id: 'c4-ddd-governance-builtin', name: 'Radical', nodeTypes: {}, relationTypes: {} },
  })

  test.beforeEach(async ({ page, studio }) => {
    await studio.seedDocument(EMPTY)
    await studio.open('v-wiki')
    await expect(page.locator('.wiki-view')).toBeVisible()
  })

  test('requirements are written line by line and a pasted list is one for each line', async ({ page, studio }) => {
    // An empty page says where to start, by the categories of the palette.
    const start = page.locator('.wiki-write-start')
    await expect(start).toContainText('Nothing is written yet. Start with:')
    await start.getByRole('button', { name: 'Requirements', exact: true }).click()

    // The line has the focus, and keeps it after each requirement.
    const line = page.getByRole('textbox', { name: 'Write a requirement' })
    await expect(line).toBeFocused()
    await page.keyboard.type('When a payment fails, the system shall tell the customer why')
    await page.keyboard.press('Enter')
    await page.keyboard.type('The Payments Service must reject a transfer above the daily limit')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Users can export their statements')
    await page.keyboard.press('Enter')
    await expect(line).toBeFocused()
    await expect(line).toHaveValue('')
    await expect(page.getByRole('heading', { name: 'Requirements (3)' })).toBeVisible()

    // In the order written, each with its sentence; a line that is no EARS
    // sentence is only named.
    const parts = page.locator('.wiki-part')
    await expect(parts).toHaveCount(3)
    await expect(parts.nth(0).getByRole('link')).toHaveText('Tell the customer why when a payment fails')
    await expect(parts.nth(0)).toContainText('— When a payment fails, the system shall tell the customer why.')
    await expect(parts.nth(1).getByRole('link')).toHaveText('Reject a transfer above the daily limit')
    await expect(parts.nth(1)).toContainText('— The Payments Service shall reject a transfer above the daily limit.')
    await expect(parts.nth(2).getByRole('link')).toHaveText('Users can export their statements')
    await expect(parts.nth(2)).not.toContainText('shall')

    // A pasted list is shown before it is added.
    await line.evaluate((el, text) => {
      const data = new DataTransfer()
      data.setData('text/plain', text)
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
    }, '- The system shall keep an audit trail of every transfer\n- [ ] If the daily limit is exceeded, the system shall refuse the transfer\n\n3. The system shall encrypt data at rest')
    const pasted = page.getByRole('group', { name: 'Pasted lines' })
    await expect(pasted.locator('li')).toHaveText([
      'Keep an audit trail of every transfer',
      'Refuse the transfer if the daily limit is exceeded',
      'Encrypt data at rest',
    ])
    await pasted.getByRole('button', { name: 'Add three requirements' }).click()
    await expect(page.getByRole('heading', { name: 'Requirements (6)' })).toBeVisible()

    await expect.poll(async () => {
      const saved = await studio.storedDoc() as unknown as { nodes: Array<Record<string, unknown>> }
      const refuse = saved.nodes.find((n) => n.label === 'Refuse the transfer if the daily limit is exceeded')
      return refuse && [refuse.type, refuse.ears_type, refuse.unwanted_condition, refuse.action]
    }, { timeout: 15_000 }).toEqual(['requirement', 'unwanted-behaviour', 'the daily limit is exceeded', 'refuse the transfer'])

    // The pasted list is one step to undo.
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(page.getByRole('heading', { name: 'Requirements (3)' })).toBeVisible()
  })

  test('a sentence is rewritten whole, and a group at the top is not offered parts of a system', async ({ page }) => {
    await page.locator('.wiki-write-start').getByRole('button', { name: 'Requirements', exact: true }).click()
    await page.keyboard.type('When a payment fails, the system shall tell the customer why')
    await page.keyboard.press('Enter')
    await page.getByRole('link', { name: 'Tell the customer why when a payment fails' }).click()
    await expect(page.locator('.ears-sentence')).toContainText('When a payment fails, the system shall tell the customer why.')

    // Rewritten with another pattern: its parts are read again.
    await page.locator('.ears-sentence').hover()
    await page.getByRole('button', { name: 'Rewrite the sentence' }).click()
    const sentence = page.getByRole('textbox', { name: 'The requirement as one sentence' })
    await expect(sentence).toHaveValue('When a payment fails, the system shall tell the customer why.')
    await sentence.fill('While a payment is pending, if the bank does not answer, the system shall tell the customer why')
    await sentence.press('Enter')
    await expect(page.locator('.ears-sentence')).toContainText(
      'While a payment is pending, if the bank does not answer, the system shall tell the customer why.',
    )
    await expect(page.locator('.wiki-infobox')).toContainText('complex')

    // A group holds what its place allows: at the top of the model, no
    // containers or components.
    await page.getByRole('button', { name: 'Overview', exact: true }).click()
    await page.getByRole('button', { name: 'Add element' }).click()
    await page.locator('.wiki-add-item', { hasText: /^Group$/ }).click()
    await expect(page.locator('.wiki-title')).toHaveText('New Group')
    const offer = page.locator('.wiki-write-start')
    await expect(offer.getByRole('button', { name: 'Requirements', exact: true })).toBeVisible()
    await expect(offer.getByRole('button', { name: 'Software systems', exact: true })).toBeVisible()
    await expect(offer.getByRole('button', { name: 'Components', exact: true })).toHaveCount(0)
    await expect(offer.getByRole('button', { name: 'Containers', exact: true })).toHaveCount(0)
  })
})

test('a wiki with a filter offers only the types its chain shows, at the top only its first level\'s', async ({ page, studio }) => {
  // The chain of the viewpoint Specification: needs, the requirements
  // derived from them, their scenarios and mockups.
  await studio.seedDocument(JSON.stringify({
    nodes: [],
    relations: [],
    views: [{
      id: 'v-spec', kind: 'wiki', name: 'Specification', nodeIds: [], positions: {},
      pipeline: { levels: [
        { ways: [{ types: ['need'] }] },
        { ways: [{ via: { relationType: 'derives', direction: 'in' }, types: ['requirement'] }] },
        { ways: [{ via: { relationType: 'verifies', direction: 'in' }, types: ['scenario'] }, { via: { relationType: 'illustrates', direction: 'in' }, types: ['mockup'] }] },
      ] },
    }],
    metamodel: { id: 'c4-ddd-governance-builtin', name: 'Radical', nodeTypes: {}, relationTypes: {} },
  }))
  await studio.open('v-spec')
  const start = page.locator('.wiki-write-start')
  await expect(start.getByRole('button', { name: 'Needs', exact: true })).toBeVisible()
  await expect(start.getByRole('button', { name: 'Software systems', exact: true })).toHaveCount(0)
  // A requirement goes under the need it is derived from, a scenario under
  // its requirement: not at the top.
  await expect(start.getByRole('button', { name: 'Requirements', exact: true })).toHaveCount(0)
  await expect(start.getByRole('button', { name: 'Scenarios', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Add element' }).click()
  await expect(page.locator('.wiki-add-item', { hasText: /^Need$/ })).toBeVisible()
  await expect(page.locator('.wiki-add-item')).toHaveCount(1)
  await page.locator('.wiki-add-item', { hasText: /^Need$/ }).click()
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.locator('.wiki-title')).toHaveText('New Need')
})

// Needs, and a requirement derived from Audit, in a view of the chain
// needs → requirements.
const linkingModel = (view: Record<string, unknown>) => JSON.stringify({
  nodes: [
    { id: 'n-pay', type: 'need', label: 'Pay by card', kind: 'brief', x: 0, y: 0, width: 200, height: 80, collapsed: false },
    { id: 'n-audit', type: 'need', label: 'Audit', kind: 'brief', x: 300, y: 0, width: 200, height: 80, collapsed: false },
    { id: 'n-refunds', type: 'need', label: 'Refunds', kind: 'brief', x: 600, y: 0, width: 200, height: 80, collapsed: false },
    { id: 'r-trail', type: 'requirement', label: 'Keep an audit trail', ears_type: 'ubiquitous', action: 'keep an audit trail', x: 300, y: 200, width: 200, height: 80, collapsed: false },
  ],
  relations: [{ id: 'd1', sourceId: 'r-trail', targetId: 'n-audit', relationType: 'derives' }],
  views: [{ id: 'v-spec', name: 'Specification', nodeIds: [], positions: {}, ...view, pipeline: { levels: [
    { ways: [{ types: ['need'] }] },
    { ways: [{ via: { relationType: 'derives', direction: 'in' }, types: ['requirement'] }] },
  ] } }],
  metamodel: { id: 'c4-ddd-governance-builtin', name: 'Radical', nodeTypes: {}, relationTypes: {} },
})

test('Add or link… links an existing element, and the writing line suggests one', async ({ page, studio }) => {
  await studio.seedDocument(linkingModel({ kind: 'wiki' }))
  await studio.open('v-spec/f/n-pay')
  const derivesFrom = async (need: string) => {
    const doc = await studio.storedDoc() as unknown as { nodes: Array<{ id: string }>; relations: Array<{ sourceId: string; targetId: string; relationType?: string }> }
    return doc.relations.some((r) => r.sourceId === 'r-trail' && r.targetId === need && r.relationType === 'derives') && doc.nodes.length
  }
  // Add or link… offers a requirement new, or one the model has, linked.
  await page.getByRole('button', { name: 'Edit Pay by card' }).click()
  await page.getByRole('menuitem', { name: 'Add or link…' }).click()
  const picker = addPicker(page, 'Pay by card')
  await expect(picker.dialog).toContainText('Pay by card is refined into a requirement')
  await expect(picker.option(/^New requirement/)).toBeVisible()
  await picker.option(/Keep an audit trail/).click()
  await expect(picker.dialog).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Keep an audit trail' })).toBeVisible()
  await expect.poll(() => derivesFrom('n-pay')).toBe(4)

  // The writing line under another need suggests it by name; Enter still adds a new one.
  await studio.open('v-spec/f/n-refunds')
  await page.locator('.wiki-write-start').getByRole('button', { name: 'Requirements', exact: true }).click()
  await page.keyboard.type('audit')
  const suggest = page.getByRole('group', { name: 'Link an existing requirement' })
  await suggest.getByRole('button', { name: /Keep an audit trail/ }).click()
  await expect.poll(() => derivesFrom('n-refunds')).toBe(4)
  const line = page.getByRole('textbox', { name: 'Write a requirement' })
  await expect(line).toHaveValue('')
  await line.fill('Refund within a week')
  await expect(suggest).toHaveCount(0)
  await line.press('Enter')
  await expect.poll(() => derivesFrom('n-refunds')).toBe(5)
})

// Open points and items of runs 35 to 64 on a wiki of the bookstore.
test.describe('a wiki of the bookstore', () => {
  const T = ['container', 'webapp', 'database']
  const seedWiki = async (studio: { seedDocument(json: string): Promise<void> }, view: Record<string, unknown>) => {
    const doc = JSON.parse(fixture('bookstore'))
    doc.views.push({ id: 'v-wiki', name: 'Wiki', kind: 'wiki', nodeIds: [], positions: {}, ...view })
    await studio.seedDocument(JSON.stringify(doc))
  }

  // Item 187: a chain whose relations loop (web → API → DB, back by "any
  // relation") crashed Studio at the first letter of Search pages, and Multi
  // page wrote API › Orders DB › API…
  test('a chain that loops is searched and written once along each path', async ({ page, studio }) => {
    await seedWiki(studio, { wikiPageMode: 'multi', wikiDepth: 5, pipeline: { levels: [{ ways: [{ types: T }] }, { ways: [{ types: T, via: { anyRelation: true } }] }] } })
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await studio.open('v-wiki/f/api')
    await page.getByLabel('Search pages').fill('a')
    await expect(page.locator('.wiki-nav-item', { hasText: 'API' }).first()).toBeVisible()
    await expect(page.getByText('Something went wrong')).toHaveCount(0)
    // API's page: Orders DB and Web App are chapters; API is not written again under them.
    await expect(page.getByRole('heading', { name: 'Orders DB' })).toHaveCount(1)
    await expect(page.locator('.wiki-page').getByRole('heading', { name: 'API', exact: true })).toHaveCount(1)
    expect(errors).toEqual([])
  })

  // F-0033: Add or link… under the API offered "uses……" the Bookstore that
  // holds it (the ellipsis doubled), and picking it was refused.
  test('Add or link… offers no relation to what holds the element, and reads each way with one ellipsis', async ({ page, studio }) => {
    await seedWiki(studio, {})
    await studio.open('v-wiki/f/api')
    await page.getByRole('button', { name: 'Edit API' }).click()
    await page.getByRole('menuitem', { name: 'Add or link…' }).click()
    const picker = addPicker(page, 'API')
    const ways = picker.dialog.locator('optgroup[label="Other relationships"] option')
    await expect(ways.first()).toBeAttached()
    const texts = await ways.allTextContents()
    expect(texts.filter((t) => t.includes('……'))).toEqual([])
    expect(texts.every((t) => t.endsWith('…'))).toBe(true)
    for (const text of texts) {
      await picker.choose(text)
      await expect(picker.option('Bookstore')).toHaveCount(0)
    }
  })

  // Open point (35–44): the Pages list stayed A–Z under a descending sort.
  test('the pages list in the view\'s order', async ({ page, studio }) => {
    await seedWiki(studio, { pipeline: { levels: [{ ways: [{ types: ['person', 'system'] }] }], sort: { by: 'label', desc: true } } })
    await studio.open('v-wiki')
    await expect(page.locator('.wiki-nav-item')).toHaveText(['Overview', 'Customer', 'Payment Provider', 'Bookstore', 'Glossary'])
  })

  // Open point (35–44): after Undo of Add child the wiki showed the
  // Overview while the address kept /f/<gone>.
  test('Undo of Add child goes back to the Overview, and so does the address', async ({ page, studio }) => {
    await seedWiki(studio, {})
    await studio.open('v-wiki/f/bookstore')
    await page.getByRole('button', { name: 'Edit Bookstore' }).click()
    await page.getByRole('menuitem', { name: 'Add or link…' }).click()
    const picker = addPicker(page, 'Bookstore')
    await picker.choose('holds a container')
    await picker.option(/^New container/).click()
    await expect(page).not.toHaveURL(/\/f\/bookstore$/)
    await expect(page).toHaveURL(/\/v\/v-wiki\/f\/[^/]+$/)
    await page.keyboard.press('Escape')
    await page.keyboard.press('ControlOrMeta+z')
    await expect(page).toHaveURL(/\/v\/v-wiki$/)
    await expect(page.locator('.wiki-title')).toHaveText('Overview')
  })
})

// Item 186: the Overview counted the whole model's relations (125 for 8).
test('the wiki Overview counts the relations between its pages', async ({ page, studio }) => {
  await studio.openSample('view-wiki')
  await expect(page.locator('.wiki-page')).toContainText('14 elements · 8 relations')
})

// Item 185: text clicked into before an agent's edit wrote the old text
// back when left.
folderTest('wiki text opened before an agent\'s edit takes the edit, and leaving it writes nothing', async ({ page, studio }) => {
  const doc = JSON.parse(fixture('bookstore'))
  doc.views.push({ id: 'v-wiki', name: 'Wiki', kind: 'wiki', nodeIds: [], positions: {} })
  const folder = new ModelFolder(page)
  await folder.install()
  await page.goto('/')
  for (const [path, content] of Object.entries(serializeToMdFolder(doc, 'Shop'))) await folder.write(path, content)
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await page.getByRole('button', { name: 'Folder…' }).click()
  await expect(page.locator('.welcome-overlay')).toBeHidden()
  await studio.ready()
  await studio.designer()
  await page.locator('.lp-view-card', { hasText: 'Wiki' }).click()
  await page.getByLabel('Search pages').fill('Web App')
  await page.locator('.wiki-nav-item', { hasText: 'Web App' }).click()
  await expect(page.locator('.wiki-title')).toHaveText('Web App')
  await page.locator('.wiki-title .wiki-heading-text').click()
  const title = page.locator('.wiki-title input')
  await expect(title).toBeFocused()
  const path = Object.keys(await folder.files()).find((p) => p.includes('web-app'))!
  const file = (await folder.files())[path]
  await folder.write(path, file.replace('label: "Web App"', 'label: "Storefront"'))
  await expect(title).toHaveValue('Storefront', { timeout: 10_000 })
  await page.locator('.wiki-page').click({ position: { x: 5, y: 650 } })
  await expect(page.locator('.wiki-title')).toHaveText('Storefront')
  await page.waitForTimeout(3000)
  const files = await folder.files()
  expect(Object.values(files).some((c) => c.includes('label: "Web App"'))).toBe(false)
  expect(Object.values(files).some((c) => c.includes('label: "Storefront"'))).toBe(true)
})

// Open points of runs 35 to 44 on rewriting a requirement's sentence: Enter
// on it unchanged wrote the state's phrase over a precondition's own text,
// and a sentence rewritten to a state's phrase did not point at the state.
test('a requirement\'s sentence rewritten: unchanged it writes nothing, to a state\'s phrase it points at the state', async ({ page, studio }) => {
  const doc = JSON.parse(fixture('order-machine'))
  const req = (id: string, props: Record<string, unknown>) => ({ id, type: 'requirement', label: id, x: 0, y: 900, width: 240, height: 100, collapsed: false, ...props })
  doc.nodes.push(
    req('hold', { ears_type: 'state-driven', action: 'hold the stock', precondition: 'it is paid', precondition_state: 'confirmed' }),
    req('ship', { ears_type: 'ubiquitous', action: 'ship the order' }),
  )
  doc.views.push({ id: 'v-wiki', name: 'Wiki', kind: 'wiki', nodeIds: [], positions: {} })
  await studio.seedDocument(JSON.stringify(doc))
  const stored = async (id: string) => (await studio.storedDoc()).nodes.find((n) => n.id === id) as unknown as Record<string, unknown>

  await studio.open('v-wiki/f/hold')
  await expect(page.locator('.ears-sentence')).toContainText('While the Order is Confirmed, the system shall hold the stock.')
  await page.locator('.ears-sentence').hover()
  await page.getByRole('button', { name: 'Rewrite the sentence' }).click()
  await page.getByRole('textbox', { name: 'The requirement as one sentence' }).press('Enter')
  await page.waitForTimeout(800)
  expect(await stored('hold')).toMatchObject({ precondition: 'it is paid', precondition_state: 'confirmed' })

  await studio.open('v-wiki/f/ship')
  await page.locator('.ears-sentence').hover()
  await page.getByRole('button', { name: 'Rewrite the sentence' }).click()
  const sentence = page.getByRole('textbox', { name: 'The requirement as one sentence' })
  await sentence.fill('While the Order is Confirmed, the system shall ship the order')
  await sentence.press('Enter')
  await expect.poll(async () => (await stored('ship')).precondition_state).toBe('confirmed')
  await expect(page.locator('.ears-sentence [title="The state it points at (While in state)"]')).toHaveText('the Order is Confirmed')
})

// A governance model with domains, aggregates and a sequence (run 68).
const DOMAINS = (() => {
  const n = (id: string, type: string, label: string, parentId: string | null, x: number, y: number, extra: Record<string, unknown> = {}) =>
    ({ id, type, label, description: '', technology: '', ...(parentId ? { parentId } : {}), x, y, width: 220, height: 120, collapsed: false, external: false, ...extra })
  return JSON.stringify({
    metamodel: { id: 'c4-ddd-governance-builtin', name: 'Radical', nodeTypes: {}, relationTypes: {} },
    nodes: [
      n('p1', 'person', 'Customer', null, 0, 0, { width: 160, height: 160 }),
      n('s1', 'system', 'Shop', null, 300, 0, { width: 600, height: 300 }),
      n('c1', 'container', 'API', 's1', 40, 60),
      n('c2', 'database', 'DB', 's1', 320, 60),
      n('d1', 'domain', 'Ordering', null, 0, 500, { width: 560, height: 300 }),
      n('e1', 'entity', 'Order', 'd1', 40, 60, { kind: 'aggregate-root' }),
      n('e3', 'entity', 'Line', 'd1', 300, 60, { kind: 'entity' }),
      n('d2', 'domain', 'Billing', null, 700, 500, { width: 320, height: 300 }),
      n('e2', 'entity', 'Invoice', 'd2', 40, 60, { kind: 'aggregate-root' }),
    ],
    relations: [
      { id: 'r1', sourceId: 'p1', targetId: 'c1', relationType: 'interacts', label: 'orders' },
      { id: 'r2', sourceId: 'c1', targetId: 'c2', relationType: 'interacts', label: 'stores' },
      { id: 'r3', sourceId: 'd1', targetId: 'd2', relationType: 'depends-on', label: 'bills' },
      { id: 'r4', sourceId: 'e3', targetId: 'e1', relationType: 'part-of', label: '' },
    ],
    sequences: [{ id: 'seq1', name: 'Order flow', relationIds: ['r1', 'r2'], stepDescriptions: ['orders', 'stores'] }],
    views: [{ id: 'v-wiki', name: 'Wiki', kind: 'wiki', nodeIds: [], positions: {} }],
  })
})()

test.describe('the wiki keeps the metamodel', () => {
  test.beforeEach(async ({ studio }) => {
    await studio.seedDocument(DOMAINS)
  })

  // Item 241: the relation editor offered "generic" between two domains,
  // which made a relation with no type that Validation flags.
  test('a relation\'s type is changed among the types that fit, never to none', async ({ page, studio }) => {
    await studio.open('v-wiki/f/d2')
    await page.getByRole('link', { name: 'Ordering' }).last().click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Edit relationship' }).click()
    const pill = page.locator('.wiki-rel-editor .wiki-rel-pill')
    await pill.locator('.wiki-inline-view').click()
    // Named as they read from the source, as everywhere a relation is.
    await expect(pill.locator('select option')).toHaveText(['Depends on', 'Partners with'])
  })

  // Item 241: Add relationship offered Part of… from one aggregate root to
  // another (the canvas and the card leave it out there).
  test('Add or link… offers Part of only from a part to an aggregate root', async ({ page, studio }) => {
    await studio.open('v-wiki/f/e2')
    await page.getByRole('button', { name: 'Edit Invoice' }).click()
    await page.getByRole('menuitem', { name: 'Add or link…' }).click()
    const relationships = addPicker(page, 'Invoice').dialog.locator('optgroup[label="Other relationships"] option')
    await expect(relationships.first()).toBeAttached()
    await expect(relationships.filter({ hasText: /part of/i })).toHaveCount(0)
  })

  // Decided 2026-10-21 (runs 65 to 69): the wiki's Delete asks as the
  // canvas does, counting the relations and sequence steps that go, and
  // Undo brings it all back.
  test('Delete asks as the canvas does, and Undo brings everything back', async ({ page, studio }) => {
    await studio.open('v-wiki/f/c1')
    const native: string[] = []
    page.on('dialog', (d) => { native.push(d.message()); void d.dismiss() })
    await page.getByRole('button', { name: 'Edit API' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    const option = page.getByRole('button', { name: /Remove from model/ })
    await expect(option).toContainText('1 element and 2 relations')
    await expect(option).toContainText('2 sequence steps along its relations go too')
    await expect(page.getByText(/cannot be undone/)).toHaveCount(0)
    await option.click()
    await expect.poll(async () => (await studio.storedDoc()).nodes.some((n) => n.id === 'c1')).toBe(false)
    await expect(page.locator('.wiki-title')).toHaveText('Shop')
    await page.locator('.wiki-title').click()
    await page.keyboard.press('ControlOrMeta+z')
    await expect.poll(async () => {
      const doc = await studio.storedDoc() as unknown as { nodes: { id: string }[]; relations: { id: string }[]; sequences: { relationIds: string[] }[] }
      return [doc.nodes.some((n) => n.id === 'c1'), doc.relations.length, doc.sequences[0].relationIds]
    }).toEqual([true, 4, ['r1', 'r2']])
    expect(native).toEqual([])
  })
})
