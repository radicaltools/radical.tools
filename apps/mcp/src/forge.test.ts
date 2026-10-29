import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, basename } from 'node:path'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { serializeToMdFolder, deserializeFromMdFolder } from '@radical/common/formats/mdFolder'
import { MdFolderSession } from '@radical/common/formats/mdFolderSync'
import { diskFolderStorage } from '@radical/node-files/diskFolderStorage'
import { parseForgeRun } from '@radical/common/formats/forgeRunStatus'
import { parseModelBase, serializeModelBase } from '@radical/common/formats/modelBase'
import { FolderModel } from './folderModel'
import { checkModel } from '@radical/common/check'

const folders: string[] = []
afterEach(async () => { await Promise.all(folders.splice(0).map((folder) => rm(folder, { recursive: true, force: true }))) })

async function connect(): Promise<{ client: Client; folder: string; read: () => Promise<ReturnType<typeof deserializeFromMdFolder>['data']> }> {
  const folder = await mkdtemp(join(tmpdir(), 'radical-mcp-forge-'))
  folders.push(folder)
  const files = serializeToMdFolder({ nodes: [], relations: [], metamodel: builtInGovernanceMetamodel() }, 'Forge')
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(folder, path)), { recursive: true })
    await writeFile(join(folder, path), content)
  }
  const client = new Client({ name: 'radical-test', version: '1.0.0' })
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: [join(import.meta.dirname, '../dist/index.js'), '--folder', folder],
  }))
  const read = async () => deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
  return { client, folder, read }
}

async function call(client: Client, name: string, args: Record<string, unknown>): Promise<string> {
  const result = await client.callTool({ name, arguments: args })
  const text = (result.content as Array<{ text: string }>).map((c) => c.text).join('')
  expect(result.isError, `${name}: ${text}`).not.toBe(true)
  return text
}

async function refused(client: Client, name: string, args: Record<string, unknown>): Promise<string> {
  const result = await client.callTool({ name, arguments: args })
  expect(result.isError).toBe(true)
  return (result.content as Array<{ text: string }>).map((c) => c.text).join('')
}

const BRIEF = '# Click & collect\nShoppers reserve products online and pick them up in a store within two hours. Store staff confirm the order is ready.'

describe('Radical Forge over MCP', () => {
  it('runs the stages in order with the wizard\'s prompts, and regenerate replaces what a stage added', async () => {
    const { client, read } = await connect()
    try {
      expect(await refused(client, 'forge_clarify', { stage: 'requirements' })).toContain('forge_start first')

      const started = await call(client, 'forge_start', { description: BRIEF })
      const need = (await read()).nodes.find((n) => n.type === 'need')!
      expect(need).toMatchObject({ label: 'Click & collect', description: BRIEF, kind: 'brief', source: 'Radical Forge' })
      expect(started).toContain(need.id)
      expect(started).toContain('forge_clarify')

      expect(await refused(client, 'forge_generate', { stage: 'requirements' })).toContain('forge_clarify')
      expect(await refused(client, 'forge_clarify', { stage: 'fitness' })).toContain('first')

      const clarify = await call(client, 'forge_clarify', { stage: 'requirements' })
      expect(clarify).toContain('"Requirements" stage')
      // The Hub's concern packs to pick from, with their questions.
      expect(clarify).toContain('Concern packs of the Hub')
      expect(clarify).toContain('- concern-authentication | Authentication: ')
      expect(clarify).toContain('propose the answer, quoting the words of the description it rests on')
      expect(clarify).toContain('  - IDENTITY: How do people sign in? [idp = ')
      expect(clarify).toContain('Ask the user those questions')
      expect(clarify).not.toContain('Respond with ONLY a JSON array')

      const brief = await call(client, 'forge_generate', { stage: 'requirements', answers: [{ question: 'Which stores?', answer: 'All of them' }] })
      expect(brief).toContain('stage 1 of 9: Requirements')
      expect(brief).toContain('Keep labels short')
      expect(brief).toContain('Q: Which stores?\nA: All of them')
      expect(brief).toContain(`(id ${need.id})`)
      expect(brief).toContain('forge_complete_stage')
      expect(await refused(client, 'forge_clarify', { stage: 'fitness' })).toContain('still open')

      await call(client, 'add_node', { tempId: 'r1', type: 'requirement', label: 'Reserve online', properties: { ears_type: 'ubiquitous', action: 'let shoppers reserve products' } })
      await call(client, 'add_relation', { sourceId: 'r1', targetId: need.id, relationType: 'derives' })
      const done = await call(client, 'forge_complete_stage', { stage: 'requirements', summary: 'One requirement for reserving.' })
      expect(done).toContain('+1 nodes (requirement 1), +1 relations')
      expect(done).toContain('forge_clarify with stage "domain"')

      expect(await refused(client, 'forge_generate', { stage: 'requirements' })).toContain('regenerate: true')
      const again = await call(client, 'forge_generate', { stage: 'requirements', regenerate: true })
      expect(again).toContain('regenerating')
      // The earlier answers still apply.
      expect(again).toContain('Q: Which stores?')
      const regenerated = await read()
      expect(regenerated.nodes.map((n) => n.type)).toEqual(['need'])
      expect(regenerated.relations).toEqual([])

      await call(client, 'add_node', { tempId: 'r2', type: 'requirement', label: 'Pick up in store', properties: { ears_type: 'ubiquitous', action: 'hand over reserved products' } })
      await call(client, 'forge_complete_stage', { stage: 'requirements', summary: 'Pick-up requirement.' })

      // The domain model comes next, before the fitness functions.
      expect(await refused(client, 'forge_clarify', { stage: 'fitness' })).toContain('Domain model')
      await call(client, 'forge_clarify', { stage: 'domain' })
      expect(await call(client, 'forge_generate', { stage: 'domain' })).toContain('stage 2 of 9: Domain model')
      await call(client, 'forge_complete_stage', { stage: 'domain', summary: 'No domain model needed.' })

      await call(client, 'forge_clarify', { stage: 'fitness' })
      expect(await refused(client, 'forge_generate', { stage: 'fitness', concerns: [{ id: 'concern-authentication' }] })).toContain('concerns are picked in the Requirements stage')
      const fitness = await call(client, 'forge_generate', { stage: 'fitness' })
      expect(fitness).toContain('- Requirements: Pick-up requirement.')
      expect(await refused(client, 'forge_generate', { stage: 'scenarios' })).toContain('still open')
    } finally {
      await client.close()
    }
  }, 60_000)

  it('files each stage into its view beside what is there, and arranges it as the user chooses', async () => {
    const { client, read } = await connect()
    try {
      await call(client, 'forge_start', { description: BRIEF, views: { structure: 'layers' } })
      let data = await read()
      const need = data.nodes.find((n) => n.type === 'need')!
      const conceptual = data.views!.find((v) => v.name === 'Conceptual')!
      expect(conceptual.nodeIds).toEqual([need.id])
      expect(conceptual.positions[need.id]).toMatchObject({ x: 0, y: 0 })

      await call(client, 'forge_clarify', { stage: 'requirements' })
      await call(client, 'forge_generate', { stage: 'requirements' })
      for (const [i, label] of ['Reserve online', 'Pick up in store', 'Confirm ready'].entries()) {
        await call(client, 'add_node', { tempId: `r${i}`, type: 'requirement', label, properties: { ears_type: 'ubiquitous', action: label } })
      }
      const done = await call(client, 'forge_complete_stage', { stage: 'requirements', summary: 'Three requirements.' })
      expect(done).toContain(`Conceptual (${conceptual.id}) shows 3 new elements.`)
      expect(done).toContain('Keep its 3 new elements on Conceptual in a row, a column or a grid?')
      expect(done).toContain('Run Smart Layout on Conceptual?')
      expect(done).toContain('forge_arrange')
      data = await read()
      const view = data.views!.find((v) => v.id === conceptual.id)!
      const reqs = data.nodes.filter((n) => n.type === 'requirement').map((n) => n.id)
      expect(view.nodeIds).toEqual([need.id, ...reqs])
      // Right of the need, in a block that grows sideways.
      const x0 = need.width + 120
      expect(reqs.map((id) => [view.positions[id].x, view.positions[id].y])).toEqual([[x0, 0], [x0 + 360, 0], [x0, 280]])
      expect(data.views!.map((v) => v.name)).toEqual(['Conceptual'])

      expect(await refused(client, 'forge_arrange', { stage: 'requirements' })).toContain('align, smartLayout')
      expect(await refused(client, 'forge_arrange', { stage: 'fitness', align: 'row' })).toContain('complete the Fitness functions stage first')
      expect(await call(client, 'forge_arrange', { stage: 'requirements', align: 'grid' })).toContain('Conceptual: 3 elements in a grid of 2 columns.')
      expect((await read()).views!.find((v) => v.id === conceptual.id)!.layoutConstraints)
        .toEqual([{ id: expect.any(String), type: 'grid', columns: 2, nodeIds: reqs }])
      expect(await call(client, 'forge_arrange', { stage: 'requirements', smartLayout: true })).toContain('Smart Layout (Conceptual)')

      // The domain model goes into a Domain view of its own, and Conceptual
      // too; the view is there before the stage's first element.
      await call(client, 'forge_clarify', { stage: 'domain' })
      expect(await call(client, 'forge_generate', { stage: 'domain' })).toContain("Made the stage's views before it begins: Domain.")
      expect((await read()).views!.find((v) => v.name === 'Domain')).toMatchObject({ nodeIds: [], empty: true })
      await call(client, 'add_node', { tempId: 'shop', type: 'domain', label: 'Click & collect', properties: { kind: 'core' } })
      await call(client, 'add_node', { tempId: 'res', type: 'entity', label: 'Reservation', parentId: 'shop', properties: { kind: 'aggregate-root' } })
      await call(client, 'add_node', { tempId: 'line', type: 'entity', label: 'Reservation line', parentId: 'shop', properties: { kind: 'entity' } })
      await call(client, 'add_relation', { sourceId: 'line', targetId: 'res', relationType: 'part-of' })
      expect(await call(client, 'get_issues', {})).toContain('No issues')
      const domainDone = await call(client, 'forge_complete_stage', { stage: 'domain', summary: 'One context, one aggregate.' })
      expect(domainDone).toMatch(/Domain \(.+\) shows 3 new elements\./)
      data = await read()
      const modelIds = data.nodes.filter((n) => n.type === 'domain' || n.type === 'entity').map((n) => n.id)
      expect(data.views!.find((v) => v.name === 'Domain')!.nodeIds.sort()).toEqual([...modelIds].sort())
      expect(data.views!.find((v) => v.name === 'Conceptual')!.nodeIds).toEqual(expect.arrayContaining(modelIds))

      await call(client, 'forge_clarify', { stage: 'fitness' })
      await call(client, 'forge_generate', { stage: 'fitness' })
      await call(client, 'add_node', { tempId: 'f1', type: 'fitness-fn', label: 'Ready within 2 h', properties: { category: 'performance', threshold: '2 h' } })
      const fitness = await call(client, 'forge_complete_stage', { stage: 'fitness', summary: 'Pick-up time.' })
      expect(fitness).not.toContain('row, a column or a grid')
      expect(fitness).toContain('Run Smart Layout on Governance?')
      data = await read()
      const governance = data.views!.find((v) => v.name === 'Governance')!
      expect(governance.nodeIds).toEqual(data.nodes.filter((n) => n.type === 'fitness-fn').map((n) => n.id))
    } finally {
      await client.close()
    }
  }, 60_000)

  it('runs the state machine stage after the scenarios, into a States view', async () => {
    const { client, read } = await connect()
    try {
      await call(client, 'forge_start', { description: BRIEF, views: { structure: 'layers' } })
      await call(client, 'forge_clarify', { stage: 'requirements' })
      await call(client, 'forge_generate', { stage: 'requirements' })
      await call(client, 'add_node', { tempId: 'req', type: 'requirement', label: 'Reserve online', properties: { ears_type: 'ubiquitous', action: 'let shoppers reserve products' } })
      await call(client, 'forge_complete_stage', { stage: 'requirements', summary: 'One requirement.' })
      await call(client, 'forge_clarify', { stage: 'domain' })
      await call(client, 'forge_generate', { stage: 'domain' })
      await call(client, 'add_node', { tempId: 'shop', type: 'domain', label: 'Click & collect' })
      await call(client, 'add_node', { tempId: 'order', type: 'entity', label: 'Order', parentId: 'shop' })
      await call(client, 'forge_complete_stage', { stage: 'domain', summary: 'The order.' })
      await call(client, 'forge_clarify', { stage: 'fitness' })
      await call(client, 'forge_generate', { stage: 'fitness' })
      await call(client, 'forge_complete_stage', { stage: 'fitness', summary: 'None needed.' })
      await call(client, 'forge_clarify', { stage: 'scenarios' })
      await call(client, 'forge_generate', { stage: 'scenarios' })
      await call(client, 'add_node', { tempId: 'sc', type: 'scenario', label: 'Order is ready', properties: { given: 'a reserved order', when: 'staff confirm it is ready', then: 'the order is ready for pick-up' } })
      await call(client, 'add_relation', { sourceId: 'sc', targetId: 'req', relationType: 'verifies' })
      await call(client, 'forge_complete_stage', { stage: 'scenarios', summary: 'One scenario.' })
      // Mockups wait for the state machines.
      expect(await refused(client, 'forge_clarify', { stage: 'mockups' })).toContain('State machines')

      await call(client, 'forge_clarify', { stage: 'states' })
      const brief = await call(client, 'forge_generate', { stage: 'states' })
      expect(brief).toContain('stage 5 of 9: State machines')
      expect(brief).toContain('real lifecycle')
      expect(brief).toContain('Given is the source state, When')
      expect(brief).toContain('"type":"ref","refType":"event"')

      // The entity comes from the domain model.
      await call(client, 'add_node', { tempId: 'm', type: 'state-machine', label: 'Order lifecycle' })
      await call(client, 'add_relation', { sourceId: 'm', targetId: 'order', relationType: 'lifecycle-of' })
      await call(client, 'add_node', { tempId: 'ready', type: 'event', label: 'OrderReady', parentId: 'm' })
      await call(client, 'add_node', { tempId: 'i', type: 'pseudostate', label: 'Start', parentId: 'm', properties: { kind: 'initial' } })
      await call(client, 'add_node', { tempId: 'reserved', type: 'state', label: 'Reserved', parentId: 'm' })
      await call(client, 'add_node', { tempId: 'pickup', type: 'state', label: 'Ready for pick-up', parentId: 'm', properties: { kind: 'final' } })
      await call(client, 'add_relation', { sourceId: 'i', targetId: 'reserved', relationType: 'transition' })
      await call(client, 'add_relation', { sourceId: 'reserved', targetId: 'pickup', relationType: 'transition', properties: { event: 'ready' } })
      await call(client, 'add_relation', { sourceId: 'sc', targetId: 'm', relationType: 'verifies' })
      expect(await call(client, 'get_issues', {})).toContain('No issues')
      const done = await call(client, 'forge_complete_stage', { stage: 'states', summary: 'The order lifecycle.' })
      expect(brief).toContain("Made the stage's views before it begins: States.")
      expect(done).toMatch(/States \(.+\) shows \d+ new elements\./)

      const data = await read()
      const states = data.views!.find((v) => v.name === 'States')!
      const machineIds = data.nodes.filter((n) => ['entity', 'state-machine', 'state', 'pseudostate', 'event'].includes(n.type)).map((n) => n.id)
      expect(states.nodeIds.sort()).toEqual(machineIds.sort())
      // The machine itself stays off Conceptual. (The entity is there too, for
      // now: forgeViewsOf files the domain model into both views.)
      const conceptual = data.views!.find((v) => v.name === 'Conceptual')!.nodeIds
      const machine = data.nodes.filter((n) => ['state-machine', 'state', 'pseudostate', 'event'].includes(n.type)).map((n) => n.id)
      expect(machine.filter((id) => conceptual.includes(id))).toEqual([])
      // The processes come next, then the mockups.
      expect(await refused(client, 'forge_clarify', { stage: 'mockups' })).toContain('Processes')
      await call(client, 'forge_clarify', { stage: 'processes' })
    } finally {
      await client.close()
    }
  }, 60_000)

  it('runs the processes stage after the state machines', async () => {
    const { client, read } = await connect()
    try {
      await call(client, 'forge_start', { description: BRIEF, views: { structure: 'layers' } })
      await call(client, 'forge_clarify', { stage: 'requirements' })
      await call(client, 'forge_generate', { stage: 'requirements' })
      await call(client, 'add_node', { tempId: 'req', type: 'requirement', label: 'Reserve online', properties: { ears_type: 'ubiquitous', action: 'let shoppers reserve products' } })
      await call(client, 'forge_complete_stage', { stage: 'requirements', summary: 'One requirement.' })
      for (const stage of ['domain', 'fitness']) {
        await call(client, 'forge_clarify', { stage })
        await call(client, 'forge_generate', { stage })
        await call(client, 'forge_complete_stage', { stage, summary: 'Nothing.' })
      }
      await call(client, 'forge_clarify', { stage: 'scenarios' })
      await call(client, 'forge_generate', { stage: 'scenarios' })
      await call(client, 'add_node', { tempId: 'sc', type: 'scenario', label: 'Reserve and collect', properties: { given: 'a product in stock', when: 'a shopper reserves it', then: 'staff pick it and the shopper collects it' } })
      await call(client, 'add_relation', { sourceId: 'sc', targetId: 'req', relationType: 'verifies' })
      await call(client, 'forge_complete_stage', { stage: 'scenarios', summary: 'One scenario.' })
      // The processes wait for the state machines.
      expect(await refused(client, 'forge_clarify', { stage: 'processes' })).toContain('State machines')
      await call(client, 'forge_clarify', { stage: 'states' })
      await call(client, 'forge_generate', { stage: 'states' })
      await call(client, 'forge_complete_stage', { stage: 'states', summary: 'No entity has a lifecycle.' })

      await call(client, 'forge_clarify', { stage: 'processes' })
      const brief = await call(client, 'forge_generate', { stage: 'processes' })
      expect(brief).toContain('stage 6 of 9: Processes')
      expect(brief).toContain('Give every step its `order`')
      expect(brief).toContain('"key":"repeat"')
      await call(client, 'add_node', { tempId: 'p', type: 'process', label: 'Click and collect' })
      await call(client, 'add_node', { tempId: 's1', type: 'step', label: 'Reserve the product', parentId: 'p', properties: { order: 1 } })
      await call(client, 'add_node', { tempId: 's2', type: 'step', label: 'Pick the items', parentId: 'p', properties: { order: 2, repeat: '1..n', condition: 'for each order line' } })
      await call(client, 'add_node', { tempId: 's3', type: 'step', label: 'Collect', parentId: 'p', properties: { order: 3 } })
      await call(client, 'add_relation', { sourceId: 'sc', targetId: 'p', relationType: 'verifies' })
      await call(client, 'add_relation', { sourceId: 'p', targetId: 'req', relationType: 'satisfies' })
      expect(await call(client, 'get_issues', {})).toContain('No issues')
      const done = await call(client, 'forge_complete_stage', { stage: 'processes', summary: 'Click and collect.' })
      expect(brief).toContain("Made the stage's views before it begins: Processes.")
      expect(done).not.toContain('Made the view')
      expect(done).not.toContain('forge_arrange')
      expect(done).toContain('continue with Mockups')

      const data = await read()
      expect(data.views!.find((v) => v.name === 'Processes')).toMatchObject({ kind: 'warnier', viewpoint: 'process-warnier', nodeIds: [] })
      // Not on the canvases: the processes are drawn where they read.
      const listed = new Set(data.views!.flatMap((v) => v.nodeIds))
      expect(data.nodes.filter((n) => n.type === 'process' || n.type === 'step').some((n) => listed.has(n.id))).toBe(false)
      expect(await refused(client, 'forge_arrange', { stage: 'processes', smartLayout: true })).toContain('added nothing that is on a canvas view of the run')
    } finally {
      await client.close()
    }
  }, 60_000)

  it('asks the user before each refinement, applies what they accept, and regenerate undoes it', async () => {
    const { client, read, folder } = await connect()
    try {
      await call(client, 'forge_start', { description: BRIEF, views: { structure: 'layers' } })
      const need = (await read()).nodes.find((n) => n.type === 'need')!
      await call(client, 'forge_clarify', { stage: 'requirements' })
      await call(client, 'forge_generate', { stage: 'requirements' })
      await call(client, 'add_node', { tempId: 'req', type: 'requirement', label: 'Reserve online', properties: { ears_type: 'ubiquitous', action: 'let shoppers reserve products' } })
      await call(client, 'add_relation', { sourceId: 'req', targetId: need.id, relationType: 'derives' })
      await call(client, 'add_node', { tempId: 'req2', type: 'requirement', label: 'Hand over', properties: { ears_type: 'ubiquitous', action: 'hand over reserved products' } })
      await call(client, 'add_relation', { sourceId: 'req2', targetId: need.id, relationType: 'derives' })
      await call(client, 'forge_complete_stage', { stage: 'requirements', summary: 'Two requirements.' })
      for (const stage of ['domain', 'fitness']) {
        await call(client, 'forge_clarify', { stage })
        await call(client, 'forge_generate', { stage })
        await call(client, 'forge_complete_stage', { stage, summary: 'Nothing.' })
      }
      await call(client, 'forge_clarify', { stage: 'scenarios' })
      expect(await call(client, 'forge_generate', { stage: 'scenarios' })).toContain('Refine the whole model as you go.')
      await call(client, 'add_node', { tempId: 'sc', type: 'scenario', label: 'Reserve', properties: { given: 'a product in stock', when: 'a shopper reserves it', then: 'it is held for two hours' } })
      await call(client, 'add_relation', { sourceId: 'sc', targetId: 'req', relationType: 'verifies' })
      const scenarios = await call(client, 'forge_complete_stage', { stage: 'scenarios', summary: 'One scenario.' })
      // The rules of the stages done find what the scenarios left out.
      expect(scenarios).toContain('Gaps the model has now (1)')
      expect(scenarios).toContain('No scenario verifies requirement "Hand over".')
      expect(scenarios).not.toContain('refined earlier stages')
      await call(client, 'forge_clarify', { stage: 'states' })
      await call(client, 'forge_generate', { stage: 'states' })
      await call(client, 'forge_complete_stage', { stage: 'states', summary: 'No lifecycle.' })

      await call(client, 'forge_clarify', { stage: 'processes' })
      const brief = await call(client, 'forge_generate', { stage: 'processes' })
      expect(brief).toContain('Gaps the model has now')
      expect(brief).toContain('No scenario verifies requirement "Hand over".')
      await call(client, 'add_node', { tempId: 'p', type: 'process', label: 'Click and collect' })
      await call(client, 'add_node', { tempId: 's1', type: 'step', label: 'Reserve the product', parentId: 'p', properties: { order: 1 } })
      await call(client, 'add_node', { tempId: 's2', type: 'step', label: 'Notify the shopper', parentId: 'p', properties: { order: 2 } })
      // The process shows a missing requirement and its scenario, and a vague action.
      // Writing them directly is refused.
      expect(await refused(client, 'add_node', { tempId: 'notify', type: 'requirement', label: 'Notify when ready', properties: { ears_type: 'ubiquitous', action: 'notify the shopper' } }))
        .toContain('forge_propose_refinement')
      const reqId = (await read()).nodes.find((n) => n.label === 'Reserve online')!.id
      expect(await refused(client, 'update_node', { id: reqId, properties: { action: 'x' } })).toContain('"Reserve online" belongs to an earlier stage')
      // Proposed instead: the user sees exactly what it writes, and nothing is written yet.
      const proposed = await call(client, 'forge_propose_refinement', {
        stage: 'processes',
        reason: 'Step "Notify the shopper" needs a requirement and a scenario.',
        changes: [
          { tool: 'add_node', input: { tempId: 'notify', type: 'requirement', label: 'Notify when ready', properties: { ears_type: 'event-driven', trigger: 'staff confirm an order is ready', action: 'notify the shopper' } } },
          { tool: 'add_relation', input: { sourceId: 'notify', targetId: need.id, relationType: 'derives' } },
          { tool: 'add_node', input: { tempId: 'scn', type: 'scenario', label: 'Shopper notified', properties: { given: 'a reserved order', when: 'staff confirm it is ready', then: 'the shopper gets a message' } } },
          { tool: 'add_relation', input: { sourceId: 'scn', targetId: 'notify', relationType: 'verifies' } },
          { tool: 'update_node', input: { id: reqId, properties: { action: 'let shoppers reserve products for two hours' } } },
        ],
      })
      expect(proposed).toContain('Proposal p1: nothing is written yet.')
      expect(proposed).toContain('Found: Step "Notify the shopper" needs a requirement and a scenario.')
      expect(proposed).toContain('1. Add requirement "Notify when ready"\n   ears_type: "event-driven"')
      expect(proposed).toContain('   action: "notify the shopper"')
      expect(proposed).toContain('2. Link requirement "Notify when ready" → need "Click & collect" (derives)')
      expect(proposed).toContain('5. Change requirement "Reserve online"\n   action: "let shoppers reserve products" → "let shoppers reserve products for two hours"')
      expect((await read()).nodes.some((n) => n.label === 'Notify when ready')).toBe(false)
      // While it waits for the answer nothing is written, and the stage stays open.
      expect(await refused(client, 'add_node', { tempId: 's3', type: 'step', label: 'Hand over', parentId: 'p' })).toContain('waits for the user\'s answer')
      expect(await refused(client, 'forge_complete_stage', { stage: 'processes', summary: 'x' })).toContain('waits for the user\'s answer')
      let status = parseForgeRun(await readFile(join(folder, '.radical/forge-run.json'), 'utf8'))!
      expect(status.stages.find((s) => s.id === 'processes')).toMatchObject({ status: 'generating', asking: true })
      expect(await refused(client, 'forge_answer_refinement', { stage: 'processes', proposal: 'p9', accept: true })).toContain('the open proposal is p1')
      const added = await call(client, 'forge_answer_refinement', { stage: 'processes', proposal: 'p1', accept: true, reply: 'Yes, and keep the two hours.' })
      expect(added).toContain('Added p1.')
      expect(added).toContain('The user replied: "Yes, and keep the two hours."')
      let data = await read()
      const notifyId = data.nodes.find((n) => n.label === 'Notify when ready')!.id
      expect(data.nodes.some((n) => n.label === 'Shopper notified')).toBe(true)
      expect(data.relations.some((r) => r.sourceId === notifyId && r.targetId === need.id && r.relationType === 'derives')).toBe(true)
      expect(data.nodes.find((n) => n.id === reqId)).toMatchObject({ action: 'let shoppers reserve products for two hours' })
      // What the proposal added belongs to the earlier stage too; the stage's own steps are written as usual.
      expect(await refused(client, 'update_node', { id: notifyId, label: 'Notify' })).toContain('forge_propose_refinement')
      await call(client, 'add_relation', { sourceId: 'p', targetId: notifyId, relationType: 'satisfies' })
      // A proposal that would not apply is refused before the user is asked.
      expect(await refused(client, 'forge_propose_refinement', { stage: 'processes', reason: 'x', changes: [{ tool: 'add_relation', input: { sourceId: 'nobody', targetId: need.id } }] }))
        .toContain('Fix the proposal')
      // A second proposal, declined with a reply.
      await call(client, 'forge_propose_refinement', {
        stage: 'processes',
        reason: 'Shoppers may change their mind.',
        changes: [{ tool: 'add_node', input: { tempId: 'cancel', type: 'requirement', label: 'Cancel a reservation', properties: { ears_type: 'ubiquitous', action: 'let shoppers cancel a reservation' } } }],
      })
      const declined = await call(client, 'forge_answer_refinement', { stage: 'processes', proposal: 'p2', accept: false, reply: 'Not in this release.' })
      expect(declined).toContain('Not added; nothing was written.')
      expect(declined).toContain('Not in this release.')
      expect((await read()).nodes.some((n) => n.label === 'Cancel a reservation')).toBe(false)

      const done = await call(client, 'forge_complete_stage', { stage: 'processes', summary: 'Click and collect; added the notification it needs.' })
      expect(done).toContain('It refined earlier stages as the user accepted (3)')
      expect(done).toContain('- changed requirement "Reserve online" (action)')
      expect(done).toContain('added requirement "Notify when ready"')
      expect(done).toContain('added scenario "Shopper notified"')
      expect(done).not.toContain('added process')
      expect(done).toContain('The user declined 1 of its 2 proposals.')
      status = parseForgeRun(await readFile(join(folder, '.radical/forge-run.json'), 'utf8'))!
      expect(status.stages.find((s) => s.id === 'processes')).toMatchObject({ status: 'done', refined: 3 })
      // The stage is closed: nothing guards the model any more.
      await call(client, 'update_node', { id: notifyId, label: 'Notify when ready' })

      // Regenerate takes back what the stage added and the refinements accepted.
      await call(client, 'forge_generate', { stage: 'processes', regenerate: true })
      data = await read()
      expect(data.nodes.some((n) => n.label === 'Notify when ready' || n.label === 'Shopper notified' || n.type === 'process')).toBe(false)
      expect(data.nodes.find((n) => n.id === reqId)).toMatchObject({ action: 'let shoppers reserve products' })
    } finally {
      await client.close()
    }
  }, 60_000)

  it('leaves out of the stage\'s refinements what someone else changed while it ran', async () => {
    const { client, read, folder } = await connect()
    try {
      await call(client, 'forge_start', { description: BRIEF, views: { structure: 'layers' } })
      const need = (await read()).nodes.find((n) => n.type === 'need')!
      await call(client, 'forge_clarify', { stage: 'requirements' })
      await call(client, 'forge_generate', { stage: 'requirements' })
      await call(client, 'add_node', { tempId: 'req', type: 'requirement', label: 'Reserve online', properties: { ears_type: 'ubiquitous', action: 'let shoppers reserve products' } })
      await call(client, 'add_relation', { sourceId: 'req', targetId: need.id, relationType: 'derives' })
      await call(client, 'forge_complete_stage', { stage: 'requirements', summary: 'One requirement.' })
      for (const stage of ['domain', 'fitness']) {
        await call(client, 'forge_clarify', { stage })
        await call(client, 'forge_generate', { stage })
        await call(client, 'forge_complete_stage', { stage, summary: 'Nothing.' })
      }
      await call(client, 'forge_clarify', { stage: 'scenarios' })
      await call(client, 'forge_generate', { stage: 'scenarios' })
      const reqId = (await read()).nodes.find((n) => n.label === 'Reserve online')!.id
      // The user renames the requirement in Studio while the stage runs.
      const files = (await readdir(folder, { recursive: true })).filter((f) => f.endsWith('.md'))
      let renamed = false
      for (const file of files) {
        const text = await readFile(join(folder, file), 'utf8')
        if (!text.includes('Reserve online')) continue
        await writeFile(join(folder, file), text.split('Reserve online').join('Reserve in the app'))
        renamed = true
      }
      expect(renamed).toBe(true)
      expect((await read()).nodes.find((n) => n.id === reqId)!.label).toBe('Reserve in the app')
      await call(client, 'add_node', { tempId: 'sc', type: 'scenario', label: 'Reserve', properties: { given: 'a product in stock', when: 'a shopper reserves it', then: 'it is held for two hours' } })
      await call(client, 'add_relation', { sourceId: 'sc', targetId: reqId, relationType: 'verifies' })
      const done = await call(client, 'forge_complete_stage', { stage: 'scenarios', summary: 'One scenario.' })
      expect(done).not.toContain('refined earlier stages')
      const status = parseForgeRun(await readFile(join(folder, '.radical/forge-run.json'), 'utf8'))!
      expect(status.stages.find((s) => s.id === 'scenarios')?.refined ?? 0).toBe(0)
      // Regenerate takes back the stage's scenario, not the user's rename.
      await call(client, 'forge_generate', { stage: 'scenarios', regenerate: true })
      const data = await read()
      expect(data.nodes.some((n) => n.type === 'scenario')).toBe(false)
      expect(data.nodes.find((n) => n.id === reqId)!.label).toBe('Reserve in the app')
    } finally {
      await client.close()
    }
  }, 60_000)

  it('saves the model before the run as the base when there is none from git, and leaves a git base alone', async () => {
    const { client, folder, read } = await connect()
    const baseFile = join(folder, '.radical/base.json')
    try {
      expect(await call(client, 'forge_start', { description: BRIEF })).toContain('Saved the model as it was before this run to .radical/base.json')
      let base = parseModelBase(await readFile(baseFile, 'utf8'))!
      expect(base).toMatchObject({ source: 'forge', commit: '', nodes: [], relations: [] })

      // A second run replaces the base of the first with the model before it.
      await call(client, 'add_node', { tempId: 'r', type: 'requirement', label: 'Reserve online', properties: { ears_type: 'ubiquitous', action: 'let shoppers reserve products' } })
      await call(client, 'forge_start', { description: `${BRIEF}\nAlso deliveries.` })
      base = parseModelBase(await readFile(baseFile, 'utf8'))!
      expect(base.source).toBe('forge')
      expect(base.nodes.map((n) => n.type).sort()).toEqual(['need', 'requirement'])
      expect((await read()).nodes).toHaveLength(3)

      // A base from git stays.
      const git = serializeModelBase({ commit: 'abc1234def', described: 'merge base with origin/main', branch: 'main', nodes: [], relations: [] })
      await writeFile(baseFile, git)
      expect(await call(client, 'forge_start', { description: BRIEF })).not.toContain('Saved the model')
      expect(await readFile(baseFile, 'utf8')).toBe(git)
    } finally {
      await client.close()
    }
  }, 60_000)

  it('runs the review stage after C4', async () => {
    const { client, read } = await connect()
    try {
      await call(client, 'forge_start', { description: BRIEF, views: { structure: 'layers' } })
      const need = (await read()).nodes.find((n) => n.type === 'need')!
      for (const stage of ['requirements', 'domain', 'fitness', 'scenarios', 'states', 'processes', 'mockups', 'c4']) {
        await call(client, 'forge_clarify', { stage })
        await call(client, 'forge_generate', { stage })
        if (stage === 'requirements') {
          await call(client, 'add_node', { tempId: 'req', type: 'requirement', label: 'Reserve online', properties: { ears_type: 'ubiquitous', action: 'let shoppers reserve products' } })
          await call(client, 'add_relation', { sourceId: 'req', targetId: need.id, relationType: 'derives' })
        }
        if (stage === 'c4') await call(client, 'add_node', { tempId: 'shop', type: 'system', label: 'Shop' })
        await call(client, 'forge_complete_stage', { stage, summary: 'Done.' })
      }
      expect(await refused(client, 'forge_generate', { stage: 'review' })).toContain('forge_clarify')
      await call(client, 'forge_clarify', { stage: 'review' })
      const brief = await call(client, 'forge_generate', { stage: 'review' })
      expect(brief).toContain('stage 9 of 9: Review')
      expect(brief).toContain('Read it as a whole against the')
      expect(brief).toContain('No scenario verifies requirement "Reserve online".')
      expect(brief).toContain('Nothing satisfies requirement "Reserve online".')
      const data = await read()
      const shop = data.nodes.find((n) => n.label === 'Shop')!
      const req = data.nodes.find((n) => n.label === 'Reserve online')!
      expect(await refused(client, 'add_relation', { sourceId: shop.id, targetId: req.id, relationType: 'satisfies' })).toContain('both ends belong to earlier stages')
      await call(client, 'forge_propose_refinement', { stage: 'review', reason: 'Nothing satisfies "Reserve online".', changes: [{ tool: 'add_relation', input: { sourceId: shop.id, targetId: req.id, relationType: 'satisfies' } }] })
      await call(client, 'forge_answer_refinement', { stage: 'review', proposal: 'p1', accept: true })
      const done = await call(client, 'forge_complete_stage', { stage: 'review', summary: 'Linked the shop to its requirement.' })
      expect(done).toContain('It refined earlier stages as the user accepted (1)')
      expect(done).toContain('added satisfies Shop → Reserve online')
      // The relation is the refinement's, not counted as added as well.
      expect(done).toContain('Review done: +0 nodes, +0 relations')
      expect(done).toContain('tell the user which stay open')
      expect(done).not.toContain('Nothing satisfies')
      expect(done).toContain('This was the last stage.')
      expect(await call(client, 'forge_finish', {})).toContain('- Review: +0 nodes · +0 relations · 1 refinements of earlier stages accepted')
    } finally {
      await client.close()
    }
  }, 60_000)

  it('files a run into the Radical structure the user chose', async () => {
    const { client, read } = await connect()
    try {
      expect(await refused(client, 'forge_start', { description: BRIEF, views: { structure: 'radical', viewpoints: ['nope'] } })).toContain('no viewpoint "nope"')
      const started = await call(client, 'forge_start', {
        description: BRIEF,
        views: { structure: 'radical', viewpoints: ['containers', 'traceability', 'requirement-coverage', 'system-context'] },
      })
      expect(started).toContain('View structure: Radical: Conceptual (Traceability); Logical (System context, Containers); Governance (Requirement coverage).')
      expect(started).toMatch(/Made the view Traceability \(.+\); shows 1 new element; it lays itself out\./)
      expect(started).toContain('ask for the view structure')
      let data = await read()
      const need = data.nodes.find((n) => n.type === 'need')!
      expect(data.views!.map((v) => [v.name, v.folder, v.viewpoint, v.kind, v.nodeIds])).toEqual([['Traceability', 'Conceptual', 'traceability', 'table', []]])

      await call(client, 'forge_clarify', { stage: 'requirements' })
      expect(await call(client, 'forge_generate', { stage: 'requirements' })).toContain("Made the stage's views before it begins: Requirement coverage.")
      await call(client, 'add_node', { tempId: 'r', type: 'requirement', label: 'Reserve online', properties: { ears_type: 'ubiquitous', action: 'let shoppers reserve products' } })
      await call(client, 'add_relation', { sourceId: 'r', targetId: need.id, relationType: 'derives' })
      const requirements = await call(client, 'forge_complete_stage', { stage: 'requirements', summary: 'One requirement.' })
      expect(requirements).toMatch(/Traceability \(.+\) shows 1 new element; it lays itself out\./)
      expect(requirements).toMatch(/Requirement coverage \(.+\) shows 1 new element; it lays itself out\./)
      expect(requirements).not.toContain('forge_arrange')
      data = await read()
      expect(data.views!.find((v) => v.name === 'Requirement coverage')).toMatchObject({ folder: 'Governance', viewpoint: 'requirement-coverage', nodeIds: [] })

      for (const stage of ['domain', 'fitness', 'scenarios', 'states', 'processes', 'mockups']) {
        await call(client, 'forge_clarify', { stage })
        await call(client, 'forge_generate', { stage })
        await call(client, 'forge_complete_stage', { stage, summary: 'Nothing.' })
      }
      await call(client, 'forge_clarify', { stage: 'c4' })
      expect(await call(client, 'forge_generate', { stage: 'c4' })).toContain("Made the stage's views before it begins: Containers, System context.")
      expect((await read()).views!.map((v) => v.name)).toEqual(expect.arrayContaining(['Containers', 'System context']))
      await call(client, 'add_node', { tempId: 'shopper', type: 'person', label: 'Shopper' })
      await call(client, 'add_node', { tempId: 'shop', type: 'system', label: 'Shop' })
      await call(client, 'add_relation', { sourceId: 'shopper', targetId: 'shop', relationType: 'interacts', label: 'Reserves' })
      const c4 = await call(client, 'forge_complete_stage', { stage: 'c4', summary: 'The shop.' })
      expect(c4).toMatch(/System context \(.+\) shows 2 new elements\./)
      expect(c4).toContain('Keep its 2 new elements on System context and 2 new elements on Containers in a row, a column or a grid?')
      expect(c4).toContain('Run Smart Layout on System context and Containers?')
      data = await read()
      const context = data.views!.find((v) => v.name === 'System context')!
      expect(context).toMatchObject({ folder: 'Logical', viewpoint: 'system-context', nodeIds: [] })
      // Beside each other on the canvas, though the view lists nothing.
      const [shopper, shop] = ['Shopper', 'Shop'].map((label) => data.nodes.find((n) => n.label === label)!.id)
      expect(Math.abs(context.positions[shop].x - context.positions[shopper].x)).toBeGreaterThanOrEqual(360)
      expect(await call(client, 'forge_arrange', { stage: 'c4', align: 'row' })).toContain('System context: 2 elements in a row.\nContainers: 2 elements in a row.')
      expect(await call(client, 'forge_finish', {})).toContain("The elements are in the run's views (Radical:")
    } finally {
      await client.close()
    }
  }, 60_000)

  it('keeps the places a view gave the stage\'s elements while it ran, and places only the rest', async () => {
    const { client, read } = await connect()
    try {
      await call(client, 'forge_start', { description: BRIEF, views: { structure: 'radical', viewpoints: ['system-context'] } })
      for (const stage of ['requirements', 'domain', 'fitness', 'scenarios', 'states', 'processes', 'mockups']) {
        await call(client, 'forge_clarify', { stage })
        await call(client, 'forge_generate', { stage })
        await call(client, 'forge_complete_stage', { stage, summary: 'Nothing.' })
      }
      await call(client, 'forge_clarify', { stage: 'c4' })
      await call(client, 'forge_generate', { stage: 'c4' })
      await call(client, 'add_node', { tempId: 'shopper', type: 'person', label: 'Shopper' })
      await call(client, 'add_node', { tempId: 'shop', type: 'system', label: 'Shop' })
      await call(client, 'add_relation', { sourceId: 'shopper', targetId: 'shop', relationType: 'interacts', label: 'Reserves' })
      const contextId = (await read()).views!.find((v) => v.name === 'System context')!.id
      // The view laid out while the stage runs, as Studio follows it there.
      await call(client, 'smart_layout', { viewId: contextId })
      const laidOut = (await read()).views!.find((v) => v.id === contextId)!.positions
      let data = await read()
      const ids = ['Shopper', 'Shop'].map((label) => data.nodes.find((n) => n.label === label)!.id)
      expect(ids.every((id) => laidOut[id])).toBe(true)
      // One more added after the layout, which the view has no place for.
      await call(client, 'add_node', { tempId: 'store', type: 'system', label: 'Store system', properties: { external: true } })
      await call(client, 'forge_complete_stage', { stage: 'c4', summary: 'The shop.' })
      data = await read()
      const positions = data.views!.find((v) => v.id === contextId)!.positions
      for (const id of ids) expect({ x: positions[id].x, y: positions[id].y }).toEqual({ x: laidOut[id].x, y: laidOut[id].y })
      const store = data.nodes.find((n) => n.label === 'Store system')!.id
      expect(positions[store]).toBeDefined()
      // Beside what the view showed, not over it.
      for (const id of ids) {
        const a = positions[id], b = positions[store]
        const apart = a.x + a.width! <= b.x || b.x + b.width! <= a.x || a.y + a.height! <= b.y || b.y + b.height! <= a.y
        expect(apart).toBe(true)
      }
    } finally {
      await client.close()
    }
  }, 60_000)

  it('tells Studio where the run stands through .radical/forge-run.json', async () => {
    const { client, folder } = await connect()
    const status = async () => parseForgeRun(await readFile(join(folder, '.radical/forge-run.json'), 'utf8'))!
    try {
      await call(client, 'forge_start', { description: BRIEF })
      expect(await status()).toMatchObject({ client: 'radical-test', state: 'active', need: { label: 'Click & collect' } })
      expect((await status()).stages.map((s) => s.status)).toEqual(Array(9).fill('pending'))
      expect(await readFile(join(folder, '.radical/.gitignore'), 'utf8')).toBe('*\n')

      await call(client, 'forge_clarify', { stage: 'requirements' })
      expect((await status()).stages[0]).toEqual({ id: 'requirements', status: 'clarifying' })
      await call(client, 'forge_generate', { stage: 'requirements' })
      expect((await status()).stages[0].status).toBe('generating')
      await call(client, 'add_node', { tempId: 'r', type: 'requirement', label: 'Reserve online', properties: { ears_type: 'ubiquitous', action: 'let shoppers reserve products' } })
      await call(client, 'forge_complete_stage', { stage: 'requirements', summary: 'One requirement.' })
      expect((await status()).stages[0]).toEqual({ id: 'requirements', status: 'done', summary: 'One requirement.', added: { nodes: 1, relations: 0 } })

      await call(client, 'forge_finish', {})
      expect((await status()).state).toBe('finished')
    } finally {
      await client.close()
    }
  }, 60_000)

  it('marks an unfinished run closed when the client goes away', async () => {
    const { client, folder } = await connect()
    await call(client, 'forge_start', { description: BRIEF })
    await call(client, 'forge_clarify', { stage: 'requirements' })
    await client.close()
    const file = join(folder, '.radical/forge-run.json')
    await expect.poll(async () => parseForgeRun(await readFile(file, 'utf8'))?.state, { timeout: 5000 }).toBe('closed')
  }, 60_000)

  it('draws wireframes, imports Hub concern packs and exports the Gherkin files', async () => {
    const { client, folder, read } = await connect()
    try {
      await call(client, 'forge_start', { description: BRIEF })
      await call(client, 'add_node', { tempId: 'req', type: 'requirement', label: 'Reserve online', properties: { ears_type: 'ubiquitous', action: 'let shoppers reserve products' } })
      await call(client, 'add_node', { tempId: 'm', type: 'mockup', label: 'Reserve screen', properties: { screen: '/reserve' } })
      await call(client, 'add_relation', { sourceId: 'm', targetId: 'req', relationType: 'illustrates' })
      await call(client, 'add_node', { tempId: 's', type: 'scenario', label: 'Reserve a product', properties: { given: 'a product in stock', when: 'the shopper reserves it', then: 'the store holds it' } })
      await call(client, 'add_relation', { sourceId: 's', targetId: 'req', relationType: 'verifies' })

      const drawing = await call(client, 'forge_wireframe', { mockupId: 'm' })
      expect(drawing).toContain('Draw a low-fidelity UI wireframe for the screen "Reserve screen"')
      expect(drawing).toContain('Reserve online: the system shall let shoppers reserve products')
      expect(await refused(client, 'forge_wireframe', { mockupId: 'm', svg: 'no drawing' })).toContain('not a usable SVG')
      expect(await refused(client, 'forge_wireframe', { mockupId: 'req' })).toContain('not a mockup')
      await call(client, 'forge_wireframe', { mockupId: 'm', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="10" height="10"/><script>x()</script></svg>' })
      const mockup = (await read()).nodes.find((n) => n.type === 'mockup') as unknown as { wireframe: string }
      expect(mockup.wireframe).toContain('<rect')
      expect(mockup.wireframe).not.toContain('script')

      const before = await read()
      const right = Math.max(...before.nodes.filter((n) => !n.parentId).map((n) => n.x + n.width))
      const imported = await call(client, 'forge_import_hub_concept', { conceptId: 'concern-authentication', answers: { IDENTITY: 'none', MACHINE: 'none' } })
      expect(imported).toContain('Imported')
      const after = await read()
      const added = after.nodes.filter((n) => !before.nodes.some((b) => b.id === n.id))
      expect(added.length).toBeGreaterThan(0)
      for (const node of added.filter((n) => !n.parentId)) expect(node.x).toBeGreaterThan(right)
      expect(await refused(client, 'forge_import_hub_concept', { conceptId: 'nope' })).toContain('no Hub concern pack')

      const finish = await call(client, 'forge_finish', {})
      expect(finish).toContain('- Requirements: skipped')
      expect(finish).toContain('Feature:')
      const dir = join(folder, '..', `${basename(folder)}-features`)
      folders.push(dir)
      // The model's scenario and the imported pack's.
      expect(await call(client, 'forge_finish', { gherkinDir: dir })).toMatch(/Wrote \d+ \.feature files/)
      const features = await Promise.all((await readdir(dir)).map((f) => readFile(join(dir, f), 'utf8')))
      expect(features.join('\n')).toContain('Scenario: Reserve a product')
      expect(features.join('\n')).toContain('Scenario: No sign-in surface')
    } finally {
      await client.close()
    }
  }, 60_000)

  it('asks for the languages first and keeps them for the run', async () => {
    const { client } = await connect()
    try {
      const { tools } = await client.listTools()
      expect(tools.find((t) => t.name === 'forge_start')!.description).toContain('Ask the user first which languages')
      expect(await refused(client, 'forge_start', { description: BRIEF, languages: { model: 7 } })).toMatch(/languages/)

      const started = await call(client, 'forge_start', { description: BRIEF, languages: { conversation: 'Polish', model: 'German' } })
      expect(started).toContain('Languages: talk in Polish, write the model in German.')
      // The languages are asked before the view structure.
      expect(started.indexOf('Which language to talk in')).toBeGreaterThan(-1)
      expect(started.indexOf('Which language to talk in')).toBeLessThan(started.indexOf('ask for the view structure'))
      const clarify = await call(client, 'forge_clarify', { stage: 'requirements' })
      expect(clarify).toContain('Talk to the user in Polish')
      expect(clarify).toContain('Write the model in German')
      const brief = await call(client, 'forge_generate', { stage: 'requirements' })
      expect(brief).toContain('- Talk to the user in Polish')
      expect(brief).toContain('- Write the model in German, whatever language the description and the answers are in')

      const restarted = await call(client, 'forge_start', { description: BRIEF })
      expect(restarted).toContain('Languages: talk in the language of the description, write the model in English.')
      const defaults = await call(client, 'forge_clarify', { stage: 'requirements' })
      expect(defaults).toContain('Talk to the user in the language the description is written in')
      expect(defaults).toContain('Write the model in English')
    } finally {
      await client.close()
    }
  }, 60_000)

  it('starts from an existing need and offers the flow as a prompt', async () => {
    const { client, read } = await connect()
    try {
      await call(client, 'add_node', { tempId: 'n', type: 'need', label: 'Notes', description: 'Old text' })
      const id = (await read()).nodes[0].id
      await call(client, 'forge_start', { needId: id, description: 'New text' })
      const data = await read()
      expect(data.nodes).toHaveLength(1)
      expect(data.nodes[0].description).toBe('New text')
      expect(await refused(client, 'forge_start', {})).toContain('description or a needId')

      const { prompts } = await client.listPrompts()
      expect(prompts.map((p) => p.name)).toContain('forge')
      const prompt = await client.getPrompt({ name: 'forge', arguments: { description: 'A parking app' } })
      const text = (prompt.messages[0].content as { text: string }).text
      expect(text).toContain('A parking app')
      expect(text).toContain('forge_start')
    } finally {
      await client.close()
    }
  }, 60_000)
})

describe('forge_import_hub_concept', () => {
  /** A folder model where a person uses a web app, the ids by temp id. */
  async function shop() {
    const folder = await mkdtemp(join(tmpdir(), 'radical-mcp-concern-'))
    folders.push(folder)
    const files = serializeToMdFolder({ nodes: [], relations: [], metamodel: builtInGovernanceMetamodel() }, 'Concerns')
    for (const [path, content] of Object.entries(files)) {
      await mkdir(dirname(join(folder, path)), { recursive: true })
      await writeFile(join(folder, path), content)
    }
    const model = await FolderModel.open(folder)
    const ids = new Map<string, string>()
    for (const [name, args] of [
      ['add_node', { tempId: 'user', type: 'person', label: 'Customer' }],
      ['add_node', { tempId: 'shop', type: 'system', label: 'Shop' }],
      ['add_node', { tempId: 'web', type: 'webapp', label: 'Storefront', parentId: 'shop' }],
      ['add_node', { tempId: 'order', type: 'entity', label: 'Order' }],
      ['add_relation', { sourceId: 'user', targetId: 'web', relationType: 'interacts' }],
    ] as Array<[string, Record<string, unknown>]>) {
      const result = await model.call(name, args)
      expect(result.ok, `${name}: ${result.text}`).toBe(true)
      const id = /Created node ([\w-]+)/.exec(result.text)?.[1]
      if (id) ids.set(args.tempId as string, id)
    }
    const read = async () => deserializeFromMdFolder(await new MdFolderSession(diskFolderStorage(folder)).readAll()).data
    return { model, ids, read }
  }

  it('binds a concern pack to an element', async () => {
    const { model, ids, read } = await shop()
    const web = ids.get('web')!
    const result = await model.call('forge_import_hub_concept', { conceptId: 'concern-authentication', answers: { IDENTITY: 'idp', MACHINE: 'mtls' }, bindTo: web })
    expect(result.ok, result.text).toBe(true)
    expect(result.text).toContain('Bound to webapp "Storefront"')
    const data = await read()
    // The answers bring the sign-in decision and, with the second factor on by default, the step-up one.
    const adr = data.nodes.find((n) => n.type === 'adr' && n.label === 'Users sign in through an identity provider')! as unknown as Record<string, string>
    expect(adr).toMatchObject({ concern: 'authentication', status: 'accepted' })
    expect(data.nodes.filter((n) => n.type === 'adr').map((n) => n.label).sort()).toEqual(['A second factor for risky operations', 'Users sign in through an identity provider'])
    expect(adr.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(adr.decision).toContain('Calls from other systems: mutual TLS.')
    // The answers picked the slice: no own user store, no public-by-design.
    const labels = data.nodes.map((n) => n.label)
    expect(labels).toContain('Calling systems authenticate')
    expect(labels).not.toContain('Passwords stored as hashes')
    expect(labels).not.toContain('Public by design')
    const has = (type: string, from: string, to: string) => data.relations.some((r) => r.relationType === type && r.sourceId === from && r.targetId === to)
    expect(has('constrains', adr.id, web)).toBe(true)
    for (const ff of data.nodes.filter((n) => n.type === 'fitness-fn')) expect(has('constrains', ff.id, web)).toBe(true)
    for (const req of data.nodes.filter((n) => n.type === 'requirement')) expect(has('satisfies', web, req.id)).toBe(true)
    expect(JSON.stringify(data.nodes)).not.toMatch(/\{\{[A-Z_]+\}\}|hubWhen/)
    // Its own view, in the folder Concerns, with the web app it is bound to.
    const view = data.views?.find((v) => v.folder === 'Concerns')
    expect(view).toMatchObject({ name: 'Authentication', kind: 'static' })
    expect(view!.nodeIds).toEqual(expect.arrayContaining([adr.id, web]))
    expect(result.text).toContain('and its view "Authentication"')
  })

  it('binds a concern pack to several elements', async () => {
    const { model, ids, read } = await shop()
    const [web, shopId] = [ids.get('web')!, ids.get('shop')!]
    const result = await model.call('forge_import_hub_concept', { conceptId: 'concern-authentication', answers: { IDENTITY: 'none', MACHINE: 'none' }, bindTo: [web, shopId] })
    expect(result.ok, result.text).toBe(true)
    expect(result.text).toContain('Bound to webapp "Storefront", system "Shop"')
    const data = await read()
    const adr = data.nodes.find((n) => n.type === 'adr')!
    const req = data.nodes.find((n) => n.type === 'requirement')!
    const has = (type: string, from: string, to: string) => data.relations.some((r) => r.relationType === type && r.sourceId === from && r.targetId === to)
    for (const id of [web, shopId]) {
      expect(has('constrains', adr.id, id)).toBe(true)
      expect(has('satisfies', id, req.id)).toBe(true)
    }
    expect((await model.call('forge_import_hub_concept', { conceptId: 'concern-authentication', bindTo: [web, 'nope'] })).text).toContain('no element nope')
  })

  it('refuses to bind a concern pack to an element that cannot satisfy requirements, and imports it unbound without one', async () => {
    const { model, ids, read } = await shop()
    const count = (await read()).nodes.length
    const entity = await model.call('forge_import_hub_concept', { conceptId: 'concern-authentication', bindTo: ids.get('order') })
    expect(entity.ok).toBe(false)
    expect(entity.text).toContain('an entity ("Order") cannot be constrained by an ADR and satisfy requirements')
    const answer = await model.call('forge_import_hub_concept', { conceptId: 'concern-authentication', answers: { IDENTITY: 'passkeys' }, bindTo: ids.get('web') })
    expect(answer.ok).toBe(false)
    expect(answer.text).toContain('"passkeys" is not an answer to IDENTITY')
    expect((await read()).nodes).toHaveLength(count)
    // Without bindTo it comes in unbound, which the check reports.
    const unbound = await model.call('forge_import_hub_concept', { conceptId: 'concern-authentication', answers: { IDENTITY: 'none', MACHINE: 'none' } })
    expect(unbound.ok, unbound.text).toBe(true)
    expect(unbound.text).toContain('Not bound to any element')
    const data = await read()
    const adr = data.nodes.find((n) => n.type === 'adr')!
    expect(data.relations.some((r) => r.sourceId === adr.id && r.relationType === 'constrains')).toBe(false)
  })
})

describe('concern packs in a Forge run', () => {
  it('imports the picked packs whole in Requirements and binds them after C4', async () => {
    const { client, read } = await connect()
    try {
      await call(client, 'forge_start', { description: BRIEF, views: { structure: 'layers' } })
      await call(client, 'forge_clarify', { stage: 'requirements' })
      expect(await refused(client, 'forge_generate', { stage: 'requirements', concerns: [{ id: 'concern-authentication', answers: { IDENTITY: 'passkeys' } }] })).toContain('"passkeys" is not an answer to IDENTITY')
      const brief = await call(client, 'forge_generate', { stage: 'requirements', concerns: [{ id: 'concern-authentication', answers: { IDENTITY: 'none', MACHINE: 'none' } }] })
      expect(brief).toContain('Imported the concern packs the user confirmed, whole and unbound: Authentication.')
      const adr = (await read()).nodes.find((n) => n.type === 'adr')!
      expect(adr).toMatchObject({ label: 'Nobody signs in', concern: 'authentication', status: 'accepted' })
      expect(brief).toContain(`- Authentication: ${adr.id} "Nobody signs in"`)
      expect((await read()).relations.some((r) => r.sourceId === adr.id && r.relationType === 'constrains')).toBe(false)
      await call(client, 'forge_complete_stage', { stage: 'requirements', summary: 'The Authentication pack.' })

      for (const stage of ['domain', 'fitness', 'scenarios', 'states', 'processes', 'mockups']) {
        await call(client, 'forge_clarify', { stage })
        const task = await call(client, 'forge_generate', { stage })
        expect(task).toContain('Concerns already decided by Hub concern packs')
        await call(client, 'forge_complete_stage', { stage, summary: 'Nothing.' })
      }
      await call(client, 'forge_clarify', { stage: 'c4' })
      const c4 = await call(client, 'forge_generate', { stage: 'c4' })
      expect(c4).toContain(`- Authentication: decision ${adr.id};`)
      // The stage makes the shop and links nothing to the pack.
      await call(client, 'add_node', { tempId: 'user', type: 'person', label: 'Shopper' })
      await call(client, 'add_node', { tempId: 'shop', type: 'system', label: 'Shop' })
      await call(client, 'add_node', { tempId: 'web', type: 'webapp', label: 'Storefront', parentId: 'shop' })
      await call(client, 'add_relation', { sourceId: 'user', targetId: 'web', relationType: 'interacts' })
      const done = await call(client, 'forge_complete_stage', { stage: 'c4', summary: 'The shop.' })
      expect(done).toContain('Authentication: the stage linked it to nothing, so it was bound to "Storefront", where its concern applies.')

      const data = await read()
      const web = data.nodes.find((n) => n.label === 'Storefront')!
      expect(data.relations.some((r) => r.sourceId === adr.id && r.targetId === web.id && r.relationType === 'constrains')).toBe(true)
      expect(checkModel(data).findings.filter((f) => f.rule === 'concern-unbound')).toEqual([])
    } finally {
      await client.close()
    }
  }, 60_000)
})
