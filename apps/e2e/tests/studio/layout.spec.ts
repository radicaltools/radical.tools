import type { Browser } from '@playwright/test'
import { test, expect, isolatedStudio, type Studio } from '../../support/fixtures'

// Smart Layout on real renders. Unit tests in packages/layout score the
// algorithms; these check that what reaches the screen holds the basic
// invariants (no overlapping siblings, children inside their parent) and
// still looks the same.
//
// Smart Layout saves its result as soon as it is applied. Each test runs the
// layout in a separate context, then reopens that saved document here on a
// frozen clock, so the screenshot shows exactly the layout result: the live
// layout that keeps nudging nested views (see known-issues.spec.ts) has no
// frames in which to move it.

async function smartLayoutResult(browser: Browser, prepare: (s: Studio) => Promise<void>): Promise<string> {
  const { studio, problems, close } = await isolatedStudio(browser)
  try {
    await studio.freezeTime()
    await prepare(studio)
    await studio.smartLayout()
    const json = await studio.storedJson(studio.activeDocId())
    expect(problems).toEqual([])
    return json
  } finally {
    await close()
  }
}

test.beforeEach(async ({ studio }) => {
  await studio.freezeTime()
})

test('bookstore containers', async ({ browser, page, studio }) => {
  const saved = await smartLayoutResult(browser, async (s) => {
    await s.seed()
    await s.open('v-containers')
  })
  await studio.seedDocument(saved)
  await studio.open('v-containers')
  await expect(studio.nodes).toHaveCount(6)
  expect(await studio.layoutViolations()).toEqual([])
  await expect(page).toHaveScreenshot('smart-layout-bookstore-containers.png')
})

for (const view of ['view-ctx', 'view-core', 'view-payments', 'view-screens', 'view-trace', 'canvas']) {
  test(`sample ${view}`, async ({ browser, page, studio }) => {
    const saved = await smartLayoutResult(browser, (s) => s.openSample(view))
    await studio.seedDocument(saved)
    await studio.open(view)
    expect(await studio.layoutViolations()).toEqual([])
    await expect(page).toHaveScreenshot(`smart-layout-sample-${view}.png`)
  })
}

test('the result is the same on every run', async ({ browser }) => {
  const prepare = async (s: Studio): Promise<void> => {
    await s.seed()
    await s.open('v-containers')
  }
  // Node geometry only: the saved camera depends on where an animation was.
  const geometry = (json: string): unknown => {
    const doc = JSON.parse(json)
    return { nodes: doc.nodes, views: doc.views.map((v: { id: string; positions: unknown }) => [v.id, v.positions]) }
  }
  const first = geometry(await smartLayoutResult(browser, prepare))
  const second = geometry(await smartLayoutResult(browser, prepare))
  expect(second).toEqual(first)
})
