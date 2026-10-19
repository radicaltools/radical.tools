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
      // Every requirement in the Hub is a candidate to pick from, ranked.
      expect(clarify).toContain('Hub catalogue candidates for this stage')
      expect(clarify).toContain('- req-idempotency | [requirement] Idempotent Write Operations')
      expect(clarify).toContain('ask the user which of your picks to apply')
      expect(clarify).toContain('Ask the user those questions')
      expect(clarify).not.toContain('JSON')

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
      expect(await refused(client, 'forge_generate', { stage: 'fitness', hubConcepts: ['req-idempotency'] })).toContain('not a Hub candidate of this stage')
      const fitness = await call(client, 'forge_generate', { stage: 'fitness', hubConcepts: ['ff-ledger-balance-integrity'] })
      expect(fitness).toContain('Ledger Balance Integrity Check')
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

      // The domain model goes into a Domain view of its own, and Conceptual too.
      await call(client, 'forge_clarify', { stage: 'domain' })
      await call(client, 'forge_generate', { stage: 'domain' })
      await call(client, 'add_node', { tempId: 'shop', type: 'domain', label: 'Click & collect', properties: { kind: 'core' } })
      await call(client, 'add_node', { tempId: 'res', type: 'entity', label: 'Reservation', parentId: 'shop', properties: { kind: 'aggregate-root' } })
      await call(client, 'add_node', { tempId: 'line', type: 'entity', label: 'Reservation line', parentId: 'shop', properties: { kind: 'entity' } })
      await call(client, 'add_relation', { sourceId: 'line', targetId: 'res', relationType: 'part-of' })
      expect(await call(client, 'get_issues', {})).toContain('No issues')
      const domainDone = await call(client, 'forge_complete_stage', { stage: 'domain', summary: 'One context, one aggregate.' })
      expect(domainDone).toContain('Made the view Domain (')
      data = await read()
      const modelIds = data.nodes.filter((n) => n.type === 'domain' || n.type === 'entity').map((n) => n.id)
      expect(data.views!.find((v) => v.name === 'Domain')!.nodeIds.sort()).toEqual([...modelIds].sort())
      expect(data.views!.find((v) => v.name === 'Conceptual')!.nodeIds).toEqual(expect.arrayContaining(modelIds))

      await call(client, 'forge_clarify', { stage: 'fitness' })
      await call(client, 'forge_generate', { stage: 'fitness', hubConcepts: [] })
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
      await call(client, 'forge_generate', { stage: 'fitness', hubConcepts: [] })
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
      expect(done).toContain('Made the view States (')

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
        await call(client, 'forge_generate', { stage, ...(stage === 'fitness' ? { hubConcepts: [] } : {}) })
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
      expect(done).toMatch(/Made the view Processes \(.+\); it lays itself out\./)
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
        await call(client, 'forge_generate', { stage, ...(stage === 'fitness' ? { hubConcepts: [] } : {}) })
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
        await call(client, 'forge_generate', { stage, ...(stage === 'fitness' || stage === 'c4' ? { hubConcepts: [] } : {}) })
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
      expect(done).toContain('tell the user which stay open')
      expect(done).not.toContain('Nothing satisfies')
      expect(done).toContain('This was the last stage.')
      expect(await call(client, 'forge_finish', {})).toContain('- Review: +0 nodes · +1 relations · 1 refinements of earlier stages accepted')
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
      expect(started).toContain('ask the user for the view structure')
      let data = await read()
      const need = data.nodes.find((n) => n.type === 'need')!
      expect(data.views!.map((v) => [v.name, v.folder, v.viewpoint, v.kind, v.nodeIds])).toEqual([['Traceability', 'Conceptual', 'traceability', 'table', []]])

      await call(client, 'forge_clarify', { stage: 'requirements' })
      await call(client, 'forge_generate', { stage: 'requirements' })
      await call(client, 'add_node', { tempId: 'r', type: 'requirement', label: 'Reserve online', properties: { ears_type: 'ubiquitous', action: 'let shoppers reserve products' } })
      await call(client, 'add_relation', { sourceId: 'r', targetId: need.id, relationType: 'derives' })
      const requirements = await call(client, 'forge_complete_stage', { stage: 'requirements', summary: 'One requirement.' })
      expect(requirements).toMatch(/Traceability \(.+\) shows 1 new element; it lays itself out\./)
      expect(requirements).toMatch(/Made the view Requirement coverage \(.+\); shows 1 new element; it lays itself out\./)
      expect(requirements).not.toContain('forge_arrange')
      data = await read()
      expect(data.views!.find((v) => v.name === 'Requirement coverage')).toMatchObject({ folder: 'Governance', viewpoint: 'requirement-coverage', nodeIds: [] })

      for (const stage of ['domain', 'fitness', 'scenarios', 'states', 'processes', 'mockups']) {
        await call(client, 'forge_clarify', { stage })
        await call(client, 'forge_generate', { stage, ...(stage === 'fitness' ? { hubConcepts: [] } : {}) })
        await call(client, 'forge_complete_stage', { stage, summary: 'Nothing.' })
      }
      await call(client, 'forge_clarify', { stage: 'c4' })
      await call(client, 'forge_generate', { stage: 'c4', hubConcepts: [] })
      await call(client, 'add_node', { tempId: 'shopper', type: 'person', label: 'Shopper' })
      await call(client, 'add_node', { tempId: 'shop', type: 'system', label: 'Shop' })
      await call(client, 'add_relation', { sourceId: 'shopper', targetId: 'shop', relationType: 'interacts', label: 'Reserves' })
      const c4 = await call(client, 'forge_complete_stage', { stage: 'c4', summary: 'The shop.' })
      expect(c4).toMatch(/Made the view System context \(.+\); shows 2 new elements\./)
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

  it('draws wireframes, imports Hub concepts and exports the Gherkin files', async () => {
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
      const imported = await call(client, 'forge_import_hub_concept', { conceptId: 'pattern-anti-corruption-layer' })
      expect(imported).toContain('Imported')
      const after = await read()
      const added = after.nodes.filter((n) => !before.nodes.some((b) => b.id === n.id))
      expect(added.length).toBeGreaterThan(0)
      for (const node of added.filter((n) => !n.parentId)) expect(node.x).toBeGreaterThan(right)
      expect(await refused(client, 'forge_import_hub_concept', { conceptId: 'nope' })).toContain('no Hub concept')

      const finish = await call(client, 'forge_finish', {})
      expect(finish).toContain('- Requirements: skipped')
      expect(finish).toContain('Feature:')
      const dir = join(folder, '..', `${basename(folder)}-features`)
      folders.push(dir)
      expect(await call(client, 'forge_finish', { gherkinDir: dir })).toContain('Wrote 1 .feature files')
      const [file] = await readdir(dir)
      expect(await readFile(join(dir, file), 'utf8')).toContain('Scenario: Reserve a product')
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
