import type { Page, Route } from '@playwright/test'
import { test, expect, fixture } from '../../support/fixtures'

// Radical Forge offers the Hub concepts the model picked from a stage's
// candidates, files what each stage generates into the views Conceptual,
// Logical & physical and Governance, places it beside what the view already
// shows, and after the stage offers to keep it in a row, column or grid and
// to run Smart Layout. The AI provider is scripted: no network, no key.

interface ToolUse { name: string; input: Record<string, unknown> }

/** Answers Anthropic Messages calls: no clarifying questions, and per stage
 *  one round of add_node calls, then a summary. */
async function scriptAnthropic(page: Page, stages: Array<{ task: RegExp; calls: ToolUse[] }>): Promise<string[]> {
  const stagePrompts: string[] = []
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
    if (!body.tools) {
      // Clarify: pick one Hub candidate when the requirements stage offers it.
      const prompt = JSON.stringify(body.messages)
      const pick = prompt.includes('\\"Requirements\\" stage') && prompt.includes('- req-idempotency |')
        ? [{ id: 'hub_matches', question: 'Apply these Hub concepts?', kind: 'select', multiSelect: true, options: ['Idempotent Write Operations'] }]
        : []
      return reply([{ type: 'text', text: JSON.stringify(pick) }], 'end_turn')
    }
    const all = JSON.stringify(body.messages)
    if (all.includes('tool_result')) return reply([{ type: 'text', text: 'Done.' }], 'end_turn')
    stagePrompts.push(all)
    const stage = stages.find((s) => s.task.test(all))
    if (!stage) return reply([{ type: 'text', text: 'Nothing to do.' }], 'end_turn')
    return reply(stage.calls.map((call, i) => ({ type: 'tool_use', id: `t${i}`, name: call.name, input: call.input })), 'tool_use')
  })
  return stagePrompts
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
  doc.metamodel = { id: 'c4-ddd-governance-builtin', name: 'Radical', nodeTypes: {}, relationTypes: {} }
  await studio.seedDocument(JSON.stringify(doc))
  const stagePrompts = await scriptAnthropic(page, [
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

  // The model picked one of the stage's Hub candidates; the user confirms it.
  const hub = page.locator('.forge-hub-suggestions')
  await expect(hub.locator('.forge-hub-suggestions-label')).toHaveText('Picked from the Hub')
  await expect(hub.locator('.forge-hub-card-name')).toHaveText(['Idempotent Write Operations'])
  await expect(page.getByLabel('Idempotent Write Operations')).toBeChecked()
  await page.getByRole('button', { name: 'Confirm answers' }).click()

  // Requirements: into Conceptual, then the arrange questions.
  await page.getByRole('button', { name: 'Generate requirements' }).click()
  const arrange = page.locator('.forge-arrange')
  await expect(arrange).toContainText('Keep the 5 new elements on Conceptual in a')
  expect(stagePrompts[0]).toContain('Relevant prior art already in the Hub catalogue')
  expect(stagePrompts[0]).toContain('Idempotent Write Operations')
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

  // The domain model comes next; nothing to add here.
  await page.getByRole('button', { name: 'Continue →' }).click()
  await page.getByRole('button', { name: 'Generate domain model' }).click()

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

test('Forge builds the domain model after the requirements and the state machines after the scenarios', async ({ page, studio }) => {
  const doc = JSON.parse(fixture('bookstore'))
  doc.metamodel = { id: 'c4-ddd-governance-builtin', name: 'Radical', nodeTypes: {}, relationTypes: {} }
  await studio.seedDocument(JSON.stringify(doc))
  const node = (tempId: string, type: string, label: string, parentId?: string, properties?: Record<string, unknown>): ToolUse =>
    ({ name: 'add_node', input: { tempId, type, label, ...(parentId ? { parentId } : {}), ...(properties ? { properties } : {}) } })
  const transition = (sourceId: string, targetId: string, properties: Record<string, unknown> = {}): ToolUse =>
    ({ name: 'add_relation', input: { sourceId, targetId, relationType: 'transition', properties } })
  const stagePrompts = await scriptAnthropic(page, [
    { task: /extract its functional requirements/, calls: [requirement(1)] },
    { task: /ubiquitous language/, calls: [
      node('lib', 'domain', 'Lending', undefined, { kind: 'core' }),
      node('loan', 'entity', 'Loan', 'lib', { kind: 'aggregate-root' }),
    ] },
    { task: /real lifecycle/, calls: [
      node('m', 'state-machine', 'Loan lifecycle', undefined, { subject: 'Loan' }),
      node('collected', 'event', 'BookCollected', 'm'),
      node('i', 'pseudostate', 'Start', 'm', { kind: 'initial' }),
      node('reserved', 'state', 'Reserved', 'm'),
      node('lent', 'state', 'Lent', 'm', { kind: 'final' }),
      transition('i', 'reserved'),
      transition('reserved', 'lent', { event: 'collected' }),
    ] },
  ])
  await studio.open('v-context')
  await page.getByTitle('Menu').click()
  await page.getByRole('menuitem', { name: 'Radical Forge…' }).click()
  await page.locator('.forge-textarea').fill('# Click & collect\n\nReaders reserve a book online and pick it up in the shop.')
  await page.getByRole('button', { name: 'Start →' }).click()

  // Nine steps on one line: description, the seven stages, finish.
  const steps = page.locator('.forge-step')
  await expect(steps).toHaveText(['✓Description', 'Requirements', 'Domain', 'Fitness', 'Scenarios', 'States', 'Mockups', 'C4', 'Finish'])
  const tops = await steps.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)))
  expect(new Set(tops).size).toBe(1)
  // …without scrolling.
  expect(await page.locator('.forge-steps').evaluate((el) => el.scrollWidth - el.clientWidth)).toBe(0)

  await page.getByRole('button', { name: 'Skip questions' }).click()
  for (const stage of ['requirements', 'domain model', 'fitness functions', 'Gherkin scenarios']) {
    await page.getByRole('button', { name: `Generate ${stage}` }).click()
    await page.getByRole('button', { name: 'Continue →' }).click()
  }
  await page.getByRole('button', { name: 'Generate state machines' }).click()
  await expect(page.locator('.forge-arrange')).toContainText('on States')

  const stored = async () => await studio.storedDoc() as unknown as Doc & { relations: Array<Record<string, unknown>> }
  await expect.poll(async () => (await stored()).views.find((v) => v.name === 'States')?.nodeIds.length).toBe(5)
  // The domain model is in a Domain view of its own, and in Conceptual.
  const domainView = (await stored()).views.find((v) => v.name === 'Domain')!
  expect(domainView.nodeIds).toHaveLength(2)
  expect((await stored()).views.find((v) => v.name === 'Conceptual')!.nodeIds).toEqual(expect.arrayContaining(domainView.nodeIds))
  const data = await stored()
  const id = (label: string) => data.nodes.find((n) => n.label === label)!.id
  expect(data.relations.find((r) => r.targetId === id('Lent'))!.event).toBe(id('BookCollected'))
  expect(stagePrompts.find((p) => p.includes('real lifecycle'))).toContain('Given is the source state')
  await expect(page).toHaveURL(new RegExp(`/v/${data.views.find((v) => v.name === 'States')!.id}$`))
  await expect(page.locator('.relation-label', { hasText: 'BookCollected' })).toBeVisible()
})
