import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { serializeToMdFolder, deserializeFromMdFolder } from '@radical/common/formats/mdFolder'
import { MdFolderSession } from '@radical/common/formats/mdFolderSync'
import { diskFolderStorage } from '@radical/node-files/diskFolderStorage'

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
      expect(brief).toContain('stage 1 of 7: Requirements')
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
      expect(await call(client, 'forge_generate', { stage: 'domain' })).toContain('stage 2 of 7: Domain model')
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
      await call(client, 'forge_start', { description: BRIEF })
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
      expect(done).toContain(`Added to the views: Conceptual (view ${conceptual.id}) +3`)
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
      expect(domainDone).toContain('Domain (view')
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
      await call(client, 'forge_start', { description: BRIEF })
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
      expect(brief).toContain('stage 5 of 7: State machines')
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
      expect(done).toContain('States (view')

      const data = await read()
      const states = data.views!.find((v) => v.name === 'States')!
      const machineIds = data.nodes.filter((n) => ['entity', 'state-machine', 'state', 'pseudostate', 'event'].includes(n.type)).map((n) => n.id)
      expect(states.nodeIds.sort()).toEqual(machineIds.sort())
      expect(data.views!.find((v) => v.name === 'Conceptual')!.nodeIds).not.toContain(machineIds[0])
      await call(client, 'forge_clarify', { stage: 'mockups' })
    } finally {
      await client.close()
    }
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
      const dir = join(folder, '..', `${folder.split('/').pop()}-features`)
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
