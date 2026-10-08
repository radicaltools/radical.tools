import type { Page, Route } from '@playwright/test'
import { test, expect, fixture } from '../../support/fixtures'

// Radical Forge files what each stage generates into the views Conceptual,
// Logical & physical and Governance, places it beside what the view already
// shows, and after the stage offers to keep it in a row, column or grid and
// to run Smart Layout. The AI provider is scripted: no network, no key.

interface ToolUse { name: string; input: Record<string, unknown> }

/** Answers Anthropic Messages calls: no clarifying questions, and per stage
 *  one round of add_node calls, then a summary. */
async function scriptAnthropic(page: Page, stages: Array<{ task: RegExp; calls: ToolUse[] }>): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('radical-ai-settings', JSON.stringify({
      enabled: true,
      active: 'anthropic',
      providers: { anthropic: { apiKey: 'e2e', baseUrl: '', model: '' } },
    }))
  })
  await page.route('https://api.anthropic.com/v1/messages', async (route: Route) => {
    const body = route.request().postDataJSON() as { tools?: unknown[]; messages: Array<{ content: unknown }> }
    const reply = (content: unknown[], stop: string) => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ model: 'claude-haiku-4-5', content, stop_reason: stop, usage: { input_tokens: 10, output_tokens: 10 } }),
    })
    if (!body.tools) return reply([{ type: 'text', text: '[]' }], 'end_turn')
    const all = JSON.stringify(body.messages)
    if (all.includes('tool_result')) return reply([{ type: 'text', text: 'Done.' }], 'end_turn')
    const stage = stages.find((s) => s.task.test(all))
    if (!stage) return reply([{ type: 'text', text: 'Nothing to do.' }], 'end_turn')
    return reply(stage.calls.map((call, i) => ({ type: 'tool_use', id: `t${i}`, name: call.name, input: call.input })), 'tool_use')
  })
}

const requirement = (i: number): ToolUse => ({
  name: 'add_node',
  input: { tempId: `r${i}`, type: 'requirement', label: `Requirement ${i}`, properties: { ears_type: 'ubiquitous', action: `do thing ${i}` } },
})
const fitness = (i: number): ToolUse => ({
  name: 'add_node',
  input: { tempId: `f${i}`, type: 'fitness-fn', label: `Guardrail ${i}`, properties: { category: 'performance', threshold: `${i} s` } },
})

interface Doc {
  nodes: Array<{ id: string; type: string; label: string }>
  views: Array<{ id: string; name: string; nodeIds: string[]; layoutConstraints?: Array<{ type: string; columns?: number; nodeIds: string[] }> }>
}

test('Forge files each stage into its view and offers to arrange it', async ({ page, studio }) => {
  const doc = JSON.parse(fixture('bookstore'))
  doc.metamodel = { id: 'c4-ddd-governance-builtin', name: 'C4 + DDD + Governance', nodeTypes: {}, relationTypes: {} }
  await studio.seedDocument(JSON.stringify(doc))
  await scriptAnthropic(page, [
    { task: /extract its functional requirements/, calls: [1, 2, 3, 4, 5].map(requirement) },
    { task: /propose fitness functions/, calls: [1, 2].map(fitness) },
  ])
  await studio.open('v-context')

  await page.getByTitle('Menu').click()
  await page.getByRole('menuitem', { name: 'Radical Forge…' }).click()
  await page.locator('.forge-textarea').fill('# Click & collect\n\nReaders reserve a book online and pick it up in the shop.')
  await page.getByRole('button', { name: 'Start →' }).click()

  // The need opens the Conceptual view.
  const stored = async (): Promise<Doc> => await studio.storedDoc() as unknown as Doc
  const viewNamed = async (name: string) => (await stored()).views.find((v) => v.name === name)
  await expect.poll(async () => (await viewNamed('Conceptual'))?.nodeIds.length).toBe(1)
  const conceptual = (await viewNamed('Conceptual'))!
  await expect(page).toHaveURL(new RegExp(`/v/${conceptual.id}$`))

  // Requirements: into Conceptual, then the arrange questions.
  await page.getByRole('button', { name: 'Generate requirements' }).click()
  const arrange = page.locator('.forge-arrange')
  await expect(arrange).toContainText('Keep the 5 new elements on Conceptual in a')
  await expect(arrange).toContainText('Run Smart Layout on Conceptual?')
  await expect.poll(async () => (await viewNamed('Conceptual'))!.nodeIds.length).toBe(6)
  const requirements = (await stored()).nodes.filter((n) => n.type === 'requirement').map((n) => n.id)
  expect((await viewNamed('Conceptual'))!.nodeIds).toEqual([conceptual.nodeIds[0], ...requirements])
  expect(await viewNamed('Governance')).toBeUndefined()
  // Placed beside the need in a block wider than tall.
  const boxes = await studio.boxes()
  const block = requirements.map((id) => boxes[id])
  const width = Math.max(...block.map((b) => b.x + b.width)) - Math.min(...block.map((b) => b.x))
  const height = Math.max(...block.map((b) => b.y + b.height)) - Math.min(...block.map((b) => b.y))
  expect(width).toBeGreaterThan(height)

  await arrange.getByRole('button', { name: 'Grid' }).click()
  await expect(arrange.getByRole('button', { name: '✓ Grid' })).toBeDisabled()
  await expect(arrange).toContainText('Conceptual: 5 elements in a grid of 3 columns.')
  await expect.poll(async () => (await viewNamed('Conceptual'))!.layoutConstraints)
    .toEqual([expect.objectContaining({ type: 'grid', columns: 3, nodeIds: requirements })])
  await arrange.getByRole('button', { name: 'Smart Layout' }).click()
  await expect(arrange.getByRole('button', { name: '✓ Smart Layout' })).toBeVisible({ timeout: 30_000 })

  // Fitness functions: a Governance view of their own, made when they arrive.
  await page.getByRole('button', { name: 'Continue →' }).click()
  await page.getByRole('button', { name: 'Generate fitness functions' }).click()
  await expect(arrange).toContainText('Keep the 2 new elements on Governance in a')
  await expect.poll(async () => (await viewNamed('Governance'))?.nodeIds.length).toBe(2)
  const guardrails = (await stored()).nodes.filter((n) => n.type === 'fitness-fn').map((n) => n.id)
  expect((await viewNamed('Governance'))!.nodeIds).toEqual(guardrails)
  await expect(page).toHaveURL(new RegExp(`/v/${(await viewNamed('Governance'))!.id}$`))
  await expect(studio.nodes).toHaveCount(2)
  await page.locator('.forge-panel').screenshot({ path: test.info().outputPath('forge-panel.png') })
  await page.screenshot({ path: test.info().outputPath('governance.png') })
})
