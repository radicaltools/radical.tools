// Hub, Authentication pack as a wiki: open the page "Idle sessions end", then
// pick an answer in the Answers panel that keeps that page (one that changes
// no element at all, then one that changes others). Does the wiki stay on it?
// Usage: node f2-hub-wiki-answer-jumps.mjs <hubPort>
import { launch, wait, shot, out, arg } from './lib.mjs'
const hubPort = arg(0, '4607')
const { browser, page, problems } = await launch({ port: hubPort, hubPort })
const log = []
const h1 = async () => (await page.locator('.hub-concept-panel h1').allInnerTexts())[0]
try {
  await page.goto('/#/c/concern-authentication/v/wiki')
  const panel = page.getByRole('complementary', { name: 'Answers' })
  await panel.waitFor(); await wait(page, 1500)
  const count = panel.locator('.hub-answers-count')
  for (const [answer, label] of [['mutual TLS', 'How do other systems call it? → mutual TLS'], ['the session alone', 'Second factor? → the session alone']]) {
    await page.locator('.hub-concept-panel').getByText('Idle sessions end', { exact: true }).first().click()
    await wait(page, 800)
    const before = { page: await h1(), count: await count.innerText() }
    const option = panel.locator('label', { hasText: answer })
    const promised = await option.locator('.hub-answers-delta').innerText().catch(() => 'no change')
    await option.getByRole('radio').check()
    await wait(page, 1200)
    const idleStillThere = await page.locator('.hub-concept-panel').getByText('Idle sessions end', { exact: true }).count()
    log.push({ answer: label, promised, before, after: { page: await h1(), count: await count.innerText() }, idleSessionsEndStillInPack: idleStillThere > 0 })
    if (answer === 'mutual TLS') await shot(page, 'f2-wiki-after-answer')
  }
} finally {
  out({ log, problems })
  await browser.close()
}
