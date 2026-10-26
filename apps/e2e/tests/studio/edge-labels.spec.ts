import { test, expect, fixture } from '../../support/fixtures'
import { relationLabelSize, type RelationLabelText } from '@radical/layout/edgeLabels'

// Zoomed out, relation labels are too small to read and only cover the
// diagram: the canvas hides them, keeps those of the selected node's
// relations, and shows them all again once zoomed in.

test('relation labels follow the zoom', async ({ page, studio }) => {
  await studio.openSampleWhole()
  const visibleLabels = page.locator('.relation-label:visible')

  // The whole sample fits only far zoomed out.
  await expect(studio.canvas).toHaveAttribute('data-edge-labels', 'none')
  await expect(page.locator('.relation-label').first()).toBeAttached()
  await expect(visibleLabels).toHaveCount(0)

  // A selected node shows the labels of its relations.
  await studio.nodeByLabel('Accounts Service').first().click()
  await expect.poll(() => visibleLabels.count()).toBeGreaterThan(0)
  const ofSelection = await visibleLabels.count()
  expect(ofSelection).toBeLessThan(await page.locator('.relation-label').count())

  // Zooming in brings back the names, then the technology too.
  const zoomIn = page.getByTitle('Zoom in (⌘+)')
  for (let i = 0; i < 15 && (await studio.canvas.getAttribute('data-edge-labels')) !== 'full'; i++) {
    await zoomIn.click()
    await page.waitForTimeout(350)
  }
  await expect(studio.canvas).toHaveAttribute('data-edge-labels', 'full')
  await expect.poll(() => visibleLabels.count()).toBeGreaterThan(ofSelection)
  await expect(page.locator('.relation-label-tech:visible').first()).toBeVisible()
})

// A long name takes at most two lines and the technology one, cut with an
// ellipsis, so labels stay smaller than the elements they join; the whole
// text shows while the relation, or an element at its end, is selected.
test('a long relation name is cut after two lines, and shown whole while the relation is selected', async ({ page, studio }) => {
  const LONG = 'reads and writes the orders, the stock levels, the reservations and every payment the shop has taken, then keeps an audit trail of each change'
  const doc = JSON.parse(fixture('bookstore'))
  doc.relations = doc.relations.map((r: { id: string }) => (r.id === 'r3' ? { ...r, label: LONG, technology: 'PostgreSQL wire protocol over TLS with pooled connections' } : r))
  await studio.seedDocument(JSON.stringify(doc))
  await studio.open('v-containers')
  const label = page.locator('.relation-label', { hasText: 'reads and writes the orders' })
  const name = label.locator('.relation-label-name')
  await expect(name).toBeVisible()
  // In CSS pixels, as the line height is: the canvas zoom scales the box on screen.
  const lines = async () => name.evaluate((el) => Math.round((el as HTMLElement).offsetHeight / parseFloat(getComputedStyle(el).lineHeight)))
  const cut = async () => name.evaluate((el) => el.scrollHeight > el.clientHeight + 1)
  await expect.poll(lines).toBe(2)
  expect(await cut()).toBe(true)
  expect(await label.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBe(12)

  // Selected at one of its ends: the whole name.
  await studio.node('db').click()
  await expect.poll(lines).toBeGreaterThan(2)
  expect(await cut()).toBe(false)
})

// A line drawn to a folded container stands for several relations of what
// lies inside (F-0078): the sample's Digital Channels -> Core Banking Platform
// for "Admin API calls" [HTTPS / Admin API] and two "API calls" [HTTPS /
// REST]. Its label lists them one a line, and shows no technology, as no
// one technology is theirs: it read "Admin API calls API calls API calls"
// with the first relation's technology, as if it were one admin relation.
test('a rolled-up line lists its relations one a line, without one relation\'s technology', async ({ page, studio }) => {
  await studio.openSample()
  const label = page.locator('.relation-label', { hasText: 'Admin API calls' })
  await expect(label).toHaveCount(1)
  await expect(label.locator('.relation-label-name')).toHaveText(['Admin API calls', 'API calls', 'API calls'])
  await expect(label.locator('.relation-label-tech')).toHaveCount(0)
})

// Tidy keeps a relation's label between the elements it joins, and the
// canvas places it off the elements, by the size relationLabelSize gives it:
// that has to be the size the canvas draws, in whatever font the platform
// falls back on. It took 'Identity & AML screening' [REST / JSON] for a
// name on two rows, 108x50, drawn on one, 156x35, and Smart Layout left it
// over both elements (F-0098).
test('every relation label of the sample is drawn the size the layouts give it room for', async ({ page, studio }) => {
  test.slow()
  await studio.openSample()
  const docId = studio.activeDocId()
  // The canvases (not sequences, tables, wikis, matrices, ...).
  const views = (JSON.parse(await studio.storedJson(docId)).views as { id: string; kind?: string }[])
    .filter((v) => !v.kind || v.kind === 'static')
  let checked = 0
  for (const view of views) {
    await studio.open(view.id, 'designer', docId)
    // Every label shown in full, as the layouts count it, and the widths of
    // its words in the fonts it is drawn in, as the page measures them.
    const { labels, widths } = await page.evaluate(() => {
      document.querySelector('.canvas-area')?.setAttribute('data-edge-labels', 'full')
      const ctx = new OffscreenCanvas(1, 1).getContext('2d')!
      const widths: Record<string, Record<string, number>> = {}
      const measured = (el: HTMLElement) => {
        const style = getComputedStyle(el)
        const text = el.textContent ?? ''
        const key = `${parseFloat(style.fontSize)}|${style.fontStyle === 'italic'}`
        // (Chromium leaves the `font` shorthand empty here.)
        ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
        widths[key] ??= {}
        for (const word of [' ', ...text.split(/\s+/)]) widths[key][word] = ctx.measureText(word).width
        return { text, italic: style.fontStyle === 'italic' }
      }
      const labels = [...document.querySelectorAll<HTMLElement>('.relation-label:not(.relation-label-active)')].map((el) => {
        const tech = el.querySelector<HTMLElement>('.relation-label-tech')
        return {
          names: [...el.querySelectorAll<HTMLElement>('.relation-label-name')].map(measured),
          tech: tech ? measured(tech).text : null,
          w: el.offsetWidth,
          h: el.offsetHeight,
        }
      })
      return { labels, widths }
    })
    const measure = (text: string, size: number, italic: boolean) => {
      const of = widths[`${size}|${italic}`]
      const words = text.split(' ')
      return words.reduce((sum, w) => sum + of[w], 0) + (words.length - 1) * of[' ']
    }
    for (const l of labels) {
      const typeOnly = l.names.length === 1 && l.names[0].italic
      const r: RelationLabelText = {
        ...(typeOnly ? { typeName: l.names[0].text } : l.names.length ? { label: l.names.map((n) => n.text).join('\n') } : {}),
        ...(l.tech ? { technology: l.tech.slice(1, -1) } : {}),
      }
      const size = relationLabelSize(r, undefined, measure)!
      const what = `${view.id}: ${JSON.stringify(r)} drawn ${l.w}x${l.h}, sized ${size.w.toFixed(1)}x${size.h.toFixed(1)}`
      expect(Math.abs(size.w - l.w), what).toBeLessThanOrEqual(2)
      expect(Math.abs(size.h - l.h), what).toBeLessThanOrEqual(2)
      checked++
    }
  }
  expect(checked).toBeGreaterThan(100)
})
