import type { Page, Route } from '@playwright/test'
import { test, expect, fixture } from '../../support/fixtures'

// Radical Forge asks for the view structure first: the Radical one (views of
// the viewpoints in folders, made as they fill) or the layer canvases. It
// offers the Hub concepts the model picked from a stage's candidates; with
// layer canvases it files what each stage generates into the views
// Conceptual, Logical & physical and Governance, places it beside what the
// view already shows, and after the stage offers to keep it in a row, column
// or grid and to run Smart Layout. The AI provider is scripted: no network, no key.

interface ToolUse { name: string; input: Record<string, unknown> }

interface ScriptedStage {
  task: RegExp
  calls: ToolUse[] | ((prompt: string) => ToolUse[])
  /** Later rounds, each made from the whole conversation so far (the tool
   *  results included); none left, or an empty one, ends the stage. */
  followUps?: Array<(conversation: string) => ToolUse[]>
}

/** Answers Anthropic Messages calls: no clarifying questions, and per stage
 *  one round of tool calls (or calls made from the stage's prompt), its
 *  follow-up rounds, then a summary. */
async function scriptAnthropic(page: Page, stages: ScriptedStage[]): Promise<string[]> {
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
    if (all.includes('tool_result')) {
      // The stage by its task; a round is an assistant turn and the tool results after it.
      const stage = stages.find((s) => s.task.test(JSON.stringify(body.messages[0])))
      const followUp = stage?.followUps?.[(body.messages.length - 1) / 2 - 1]
      const calls = followUp?.(all) ?? []
      if (!calls.length) return reply([{ type: 'text', text: 'Done.' }], 'end_turn')
      return reply(calls.map((call, i) => ({ type: 'tool_use', id: `f${body.messages.length}-${i}`, name: call.name, input: call.input })), 'tool_use')
    }
    stagePrompts.push(all)
    const stage = stages.find((s) => s.task.test(all))
    if (!stage) return reply([{ type: 'text', text: 'Nothing to do.' }], 'end_turn')
    const calls = typeof stage.calls === 'function' ? stage.calls(all) : stage.calls
    return reply(calls.map((call, i) => ({ type: 'tool_use', id: `t${i}`, name: call.name, input: call.input })), 'tool_use')
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
  await page.getByRole('group', { name: 'Views' }).getByLabel(/Layer canvases/).check()
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
  await page.getByRole('group', { name: 'Views' }).getByLabel(/Layer canvases/).check()
  await page.getByRole('button', { name: 'Start →' }).click()

  // Eleven steps on one line: description, the nine stages, finish.
  const steps = page.locator('.forge-step')
  await expect(steps).toHaveText(['✓Description', 'Requirements', 'Domain', 'Fitness', 'Scenarios', 'States', 'Processes', 'Mockups', 'C4', 'Review', 'Finish'])
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

test('Forge asks for the view structure and files the run into the Radical one', async ({ page, studio }) => {
  const doc = JSON.parse(fixture('bookstore'))
  doc.metamodel = { id: 'c4-ddd-governance-builtin', name: 'Radical', nodeTypes: {}, relationTypes: {} }
  await studio.seedDocument(JSON.stringify(doc))
  await scriptAnthropic(page, [{ task: /extract its functional requirements/, calls: [1, 2].map(requirement) }])
  await studio.open('v-context')
  await page.getByTitle('Menu').click()
  await page.getByRole('menuitem', { name: 'Radical Forge…' }).click()

  // Radical by default, in the radical model's folders; any viewpoint can be left out.
  const views = page.getByRole('group', { name: 'Views' })
  await expect(views.getByLabel(/Radical structure/)).toBeChecked()
  await expect(views).toContainText('in the folders Conceptual, Logical, Governance, made once something lands in it')
  // The whole-model viewpoints a view per element stands in for are left out.
  await views.getByRole('button', { name: 'Customise… (21 of 25 viewpoints)' }).click()
  await expect(views.getByRole('group', { name: 'Logical', exact: true }).getByLabel('Containers', { exact: true })).not.toBeChecked()
  await expect(views.getByRole('group', { name: 'Logical', exact: true }).getByRole('checkbox')).toHaveCount(8)
  await views.getByRole('group', { name: 'Conceptual', exact: true }).getByLabel('Specification').uncheck()
  await expect(views.getByRole('button', { name: 'Hide the viewpoints' })).toBeVisible()
  await page.locator('.forge-textarea').fill('# Click & collect\n\nReaders reserve a book online and pick it up in the shop.')
  await page.getByRole('button', { name: 'Start →' }).click()

  type View = { id: string; name: string; folder?: string; viewpoint?: string; nodeIds: string[] }
  const made = async () => ((await studio.storedDoc()) as unknown as { views: View[] }).views
    .filter((v) => v.viewpoint).map((v) => [v.name, v.folder, v.nodeIds.length])
  // The need: a Traceability view in Conceptual, on screen; the architecture
  // already there: its views in Logical, the groups with a view of the
  // Bookstore system (none of the external Payment Provider) and of each of
  // its containers.
  const logical = [
    ['System context', 'Logical', 0],
    ['Containers of a system', 'Logical', 0], ['Bookstore', 'Logical', 0],
    ['Components of a container', 'Logical', 0], ['Web App', 'Logical', 0], ['API', 'Logical', 0],
    ['Container dependencies', 'Logical', 0],
  ]
  await expect.poll(made).toEqual([['Traceability', 'Conceptual', 0], ...logical])
  const traceability = ((await studio.storedDoc()) as unknown as { views: View[] }).views.find((v) => v.viewpoint === 'traceability')!
  await expect(page).toHaveURL(new RegExp(`/v/${traceability.id}$`))

  await page.getByRole('button', { name: 'Skip questions' }).click()
  await page.getByRole('button', { name: 'Generate requirements' }).click()
  await expect(page.getByRole('button', { name: 'Continue →' })).toBeVisible()
  // The views of requirements in Governance; nothing for Specification, which
  // was left out, or for viewpoints that show nothing yet.
  await expect.poll(made).toEqual([
    ['Traceability', 'Conceptual', 0],
    ...logical,
    ['Requirement coverage', 'Governance', 0],
    ['Requirement gaps', 'Governance', 0],
  ])
  await expect(page).toHaveURL(new RegExp(`/v/${traceability.id}$`))
  // No canvas shows the requirements: nothing to arrange.
  await expect(page.locator('.forge-arrange')).toHaveCount(0)
  // The structure is the run's: it cannot change once started.
  await page.locator('.forge-step', { hasText: 'Description' }).click()
  await expect(views.getByLabel(/Layer canvases/)).toBeDisabled()
})

test('Forge asks before it refines an earlier stage and applies only what the user accepts', async ({ page, studio }) => {
  const doc = JSON.parse(fixture('bookstore'))
  doc.metamodel = { id: 'c4-ddd-governance-builtin', name: 'Radical', nodeTypes: {}, relationTypes: {} }
  await studio.seedDocument(JSON.stringify(doc))
  // The id of a node the stage's model context lists, by its label.
  const idOf = (prompt: string, label: string): string => {
    const match = new RegExp(`\\\\"id\\\\":\\\\"([^\\\\"]+)\\\\",\\\\"type\\\\":\\\\"requirement\\\\",\\\\"label\\\\":\\\\"${label}\\\\"`).exec(prompt)
    if (!match) throw new Error(`no ${label} in the prompt`)
    return match[1]
  }
  const conversations: string[] = []
  const stagePrompts = await scriptAnthropic(page, [
    { task: /extract its functional requirements/, calls: [requirement(1)] },
    {
      task: /ubiquitous language/,
      calls: (prompt) => [
        { name: 'add_node', input: { tempId: 'lib', type: 'domain', label: 'Lending', properties: { kind: 'core' } } },
        { name: 'add_node', input: { tempId: 'loan', type: 'entity', label: 'Loan', parentId: 'lib', properties: { kind: 'aggregate-root' } } },
        // Written directly, an earlier stage's element is refused.
        { name: 'add_node', input: { tempId: 'sneak', type: 'requirement', label: 'Sneaked in', properties: { ears_type: 'ubiquitous', action: 'appear unasked' } } },
        // A gap the domain model shows, and a vague requirement made precise: proposed.
        { name: 'propose_refinement', input: {
          reason: 'A loan ends with a return, which no requirement asks for.',
          changes: [
            { tool: 'add_node', input: { tempId: 'ret', type: 'requirement', label: 'Return books', properties: { ears_type: 'ubiquitous', action: 'take back a lent book' } } },
            { tool: 'update_node', input: { id: idOf(prompt, 'Requirement 1'), properties: { action: 'lend a book to a reader' } } },
          ],
        } },
      ],
      followUps: [
        (conversation) => {
          conversations.push(conversation)
          return [{ name: 'propose_refinement', input: {
            reason: 'Readers may want to keep a book longer.',
            changes: [{ tool: 'add_node', input: { tempId: 'renew', type: 'requirement', label: 'Renew loans', properties: { ears_type: 'ubiquitous', action: 'renew a loan' } } }],
          } }]
        },
        (conversation) => { conversations.push(conversation); return [] },
      ],
    },
  ])
  await studio.open('v-context')
  await page.getByTitle('Menu').click()
  await page.getByRole('menuitem', { name: 'Radical Forge…' }).click()
  await page.locator('.forge-textarea').fill('# Click & collect\n\nReaders reserve a book online and pick it up in the shop.')
  await page.getByRole('group', { name: 'Views' }).getByLabel(/Layer canvases/).check()
  await page.getByRole('button', { name: 'Start →' }).click()
  await page.getByRole('button', { name: 'Skip questions' }).click()
  await page.getByRole('button', { name: 'Generate requirements' }).click()
  await expect(page.getByTestId('forge-refinements')).toHaveCount(0)
  await page.getByRole('button', { name: 'Continue →' }).click()
  await page.getByRole('button', { name: 'Generate domain model' }).click()

  // The stage was told how to refine, with the gaps the requirements left.
  const domainPrompt = stagePrompts.find((p) => p.includes('ubiquitous language'))!
  expect(domainPrompt).toContain('Refine the whole model as you go.')
  expect(domainPrompt).toContain('propose it with propose_refinement')
  expect(domainPrompt).toMatch(/Requirement 1[\\"]+ derives from no need/)

  // The stage pauses on exactly what it would write.
  const proposal = page.getByTestId('forge-proposal')
  await expect(proposal).toContainText('A loan ends with a return, which no requirement asks for.')
  await expect(proposal.locator('.forge-proposal-change > span')).toHaveText(['Add requirement "Return books"', 'Change requirement "Requirement 1"'])
  await expect(proposal.locator('.forge-proposal-change').first().locator('li')).toHaveText(['ears_type: "ubiquitous"', 'action: "take back a lent book"'])
  await expect(proposal.locator('.forge-proposal-change').nth(1).locator('li')).toHaveText(['action: "do thing 1" → "lend a book to a reader"'])
  // What the round did reads in full (the refused write wraps, no ellipsis),
  // and every step is in sight, the ✎ of the Domain step included.
  const refused = page.locator('.forge-progress-entry-text-inner', { hasText: 'refused' }).first()
  expect(await refused.evaluate((el) => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1)).toBe(true)
  const steps = (await page.locator('.forge-steps').boundingBox())!
  const finish = (await page.locator('.forge-step').last().boundingBox())!
  expect(finish.x + finish.width).toBeLessThanOrEqual(steps.x + steps.width + 1)
  // The step bar shows that the stage waits for the answer.
  const badge = page.locator('.forge-step', { hasText: 'Domain' }).getByTestId('forge-step-refined')
  await expect(badge).toHaveClass(/pending/)
  await expect(page.locator('.forge-step', { hasText: 'Domain' })).toHaveAttribute('title', /waiting for your answer to a proposed refinement/)
  const stored = async () => await studio.storedDoc() as unknown as { nodes: Array<Record<string, unknown>> }
  expect((await stored()).nodes.some((n) => n.label === 'Return books')).toBe(false)
  await page.locator('.forge-panel').screenshot({ path: test.info().outputPath('proposal.png') })
  await proposal.getByRole('button', { name: 'Add it' }).click()

  // The next one is declined, with a reply.
  await expect(proposal).toContainText('Readers may want to keep a book longer.')
  await expect(badge).toHaveText('✎2')
  await proposal.getByLabel('Reply to the proposal').fill('Not for now: renewals come later.')
  await proposal.getByRole('button', { name: "Don't add" }).click()
  await expect(proposal).toHaveCount(0)

  // The AI was told: the direct write refused, the first proposal added, the second not, with the reply.
  await expect.poll(() => conversations.length).toBe(2)
  expect(conversations[0]).toContain('a requirement belongs to an earlier stage')
  expect(conversations[0]).toContain('The user added it.')
  expect(conversations[1]).toContain('The user did not add it')
  expect(conversations[1]).toContain('Not for now: renewals come later.')

  await expect.poll(async () => (await stored()).nodes.find((n) => n.label === 'Requirement 1')?.action).toBe('lend a book to a reader')
  const labels = (await stored()).nodes.map((n) => n.label)
  expect(labels).toContain('Return books')
  expect(labels).not.toContain('Renew loans')
  expect(labels).not.toContain('Sneaked in')

  // After the stage: no list to decide on, the refinements told as accepted.
  const refinements = page.getByTestId('forge-refinements')
  await expect(refinements).toContainText('Refined 2 elements of earlier stages, as you accepted (1 proposal declined)')
  await refinements.locator('summary').click()
  await expect(refinements.locator('li')).toHaveText(['added requirement "Return books"', 'changed requirement "Requirement 1" (action)'])
  await expect(page.locator('.forge-panel').getByRole('button', { name: /Reject/ })).toHaveCount(0)
  await expect(badge).toHaveText('✎2')
  await expect(badge).not.toHaveClass(/pending/)
  await expect(page.locator('.forge-step', { hasText: 'Domain' })).toHaveAttribute('title', /refined 2 elements of earlier stages \(requirement 2\)$/)
  await expect(page.getByTestId('forge-gaps')).toContainText('open gaps in the model — the next stage gets them')
  await page.locator('.forge-panel').screenshot({ path: test.info().outputPath('refinements-accepted.png') })
})

test('without an AI provider Radical Forge is offered disabled, with how to set one up, and asks nothing', async ({ page, studio }) => {
  await studio.seed()
  const asked: string[] = []
  page.on('request', (r) => { if (/index\.json|api\.anthropic\.com/.test(r.url())) asked.push(r.url()) })
  await studio.open('v-context')
  await page.getByTitle('Menu', { exact: true }).click()
  const item = page.getByRole('menuitem', { name: /Radical Forge…/ })
  await expect(item).toBeDisabled()
  await expect(item).toContainText('Needs an AI provider')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Open Radical Forge' })).toBeDisabled()
  await expect(page.locator('.forge-panel')).toHaveCount(0)
  expect(asked).toEqual([])
})
