import { afterEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import type { C4Node, DiagramData } from '@radical/common/c4'
import { main } from './cli'

const dirs: string[] = []
afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))) })

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node

/** A working directory holding `model/`: one requirement no scenario verifies. */
async function workspace(data: Partial<DiagramData> = {}): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'radical-cli-'))
  dirs.push(cwd)
  const files = serializeToMdFolder({
    metamodel: builtInGovernanceMetamodel(),
    nodes: [
      node('sys', 'system', 'Shop'),
      node('need', 'need', 'Brief'),
      node('req', 'requirement', 'Pay', { action: 'take the payment' }),
    ],
    relations: [
      { id: 'r1', relationType: 'derives', sourceId: 'req', targetId: 'need' },
      { id: 'r2', relationType: 'satisfies', sourceId: 'sys', targetId: 'req' },
    ],
    ...data,
  }, 'Test')
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(cwd, 'model', path)), { recursive: true })
    await writeFile(join(cwd, 'model', path), content)
  }
  return cwd
}

async function run(cwd: string, ...args: string[]): Promise<{ code: number; out: string; err: string }> {
  let out = ''
  let err = ''
  const code = await main(args, { cwd, out: (t) => { out += t + '\n' }, err: (t) => { err += t + '\n' } })
  return { code, out, err }
}

describe('radical check', () => {
  it('exits 0 with warnings only, and says what it found', async () => {
    const cwd = await workspace()
    const { code, out } = await run(cwd, 'check', 'model')
    expect(code).toBe(0)
    expect(out).toContain('radical check: model (3 elements, 2 relations)')
    expect(out).toMatch(/⚠ requirement-without-scenario {2}1\n {4}warning {2}model\/nodes\/.*\.md {2}No scenario verifies requirement "Pay"\./)
    expect(out).toContain('✓ 0 errors, 1 warning')
  })

  it('exits 1 when the config makes a finding an error, read from the model\'s check.json', async () => {
    const cwd = await workspace()
    await writeFile(join(cwd, 'model/check.json'), JSON.stringify({ rules: { 'requirement-without-scenario': 'error' } }))
    const { code, out } = await run(cwd, 'check', 'model')
    expect(code).toBe(1)
    expect(out).toContain('✖ 1 error, 0 warnings')
  })

  it('prints the result as JSON', async () => {
    const cwd = await workspace()
    const { out } = await run(cwd, 'check', 'model', '--format', 'json')
    const result = JSON.parse(out)
    expect(result).toMatchObject({ ok: true, errors: 0, warnings: 1, nodeCount: 3 })
    expect(result.findings[0]).toMatchObject({ rule: 'requirement-without-scenario', nodeId: 'req' })
  })

  it('ratchets the baseline in the config file', async () => {
    const cwd = await workspace()
    await writeFile(join(cwd, 'gate.json'), JSON.stringify({ rules: { 'requirement-without-scenario': { severity: 'error', max: 4 } } }))
    const { code, err } = await run(cwd, 'check', 'model', '--config', 'gate.json', '--ratchet')
    expect(code).toBe(0)
    expect(err).toContain('requirement-without-scenario 4 → 1')
    expect(JSON.parse(await readFile(join(cwd, 'gate.json'), 'utf8'))).toEqual({ rules: { 'requirement-without-scenario': { severity: 'error', max: 1 } } })
  })

  it('exits 1 on a folder that is no model', async () => {
    const cwd = await workspace()
    await rm(join(cwd, 'model/radical.md'))
    const { code, out } = await run(cwd, 'check', 'model')
    expect(code).toBe(1)
    expect(out).toContain('folder-manifest')
  })

  it('exits 2 when it cannot run', async () => {
    const cwd = await workspace()
    expect((await run(cwd, 'check', 'nowhere')).code).toBe(2)
    expect((await run(cwd, 'check', 'model', '--format', 'xml')).code).toBe(2)
    expect((await run(cwd, 'check', 'model', '--config', 'missing.json')).code).toBe(2)
    expect((await run(cwd, 'check', 'model', '--bogus')).code).toBe(2)
    await writeFile(join(cwd, 'model/check.json'), '{ nope')
    expect((await run(cwd, 'check', 'model')).err).toContain('Cannot read the config')
  })

  it('reads test reports, fails on a failed test, and writes the evidence', async () => {
    const cwd = await workspace({
      nodes: [
        node('req', 'requirement', 'Pay', { action: 'take the payment' }),
        node('sc', 'scenario', 'Paying', { given: 'g', when: 'w', then: 't', tests: 'src/pay.test.ts › pays\nsrc/pay.test.ts › refunds' }),
      ],
      relations: [{ id: 'v', relationType: 'verifies', sourceId: 'sc', targetId: 'req' }],
    })
    const report = (refunds: string) => JSON.stringify({ testResults: [{ name: `${cwd}/src/pay.test.ts`, assertionResults: [
      { ancestorTitles: [], title: 'pays', status: 'passed' },
      { ancestorTitles: [], title: 'refunds', status: refunds },
    ] }] })
    await writeFile(join(cwd, 'red.json'), report('failed'))
    await writeFile(join(cwd, 'green.json'), report('passed'))

    const red = await run(cwd, 'check', 'model', '--report', 'red.json', '--evidence', 'evidence.json')
    expect(red.code).toBe(1)
    expect(red.out).toContain('Scenario "Paying": test src/pay.test.ts › refunds failed. Not verified now: requirement "Pay".')
    expect(red.out).toContain('  Requirements: 1 broken')
    const evidence = JSON.parse(await readFile(join(cwd, 'evidence.json'), 'utf8'))
    expect(evidence.nodes.req).toMatchObject({ status: 'broken', by: ['sc'] })

    // The test cases are kept beside the model for Studio.
    const results = JSON.parse(await readFile(join(cwd, 'model/.radical/test-results.json'), 'utf8'))
    expect(results).toMatchObject({ version: 1, reports: ['red.json'] })
    expect(results.cases).toHaveLength(2)
    expect(await readFile(join(cwd, 'model/.radical/.gitignore'), 'utf8')).toBe('*\n')
    // Into the model folder's .radical directory, made with its .gitignore.
    await run(cwd, 'check', 'model', '--report', 'red.json', '--evidence', 'model/.radical/evidence.json')
    expect(JSON.parse(await readFile(join(cwd, 'model/.radical/evidence.json'), 'utf8')).nodes.req.status).toBe('broken')
    expect(await readFile(join(cwd, 'model/.radical/.gitignore'), 'utf8')).toBe('*\n')

    const green = await run(cwd, 'check', 'model', '--report', 'red.json', '--report', 'green.json')
    // Either report failing the test fails it.
    expect(green.code).toBe(1)
    expect((await run(cwd, 'check', 'model', '--report', 'green.json')).code).toBe(0)
    // A directory: every report in it.
    await mkdir(join(cwd, 'reports'))
    await writeFile(join(cwd, 'reports/green.json'), report('passed'))
    await writeFile(join(cwd, 'reports/notes.txt'), 'not a report')
    const dir = await run(cwd, 'check', 'model', '--report', 'reports')
    expect(dir.code).toBe(0)
    expect(dir.out).toContain('Test reports: 2 test cases')
  })

  it('exits 2 on a report it cannot read, or evidence without a report', async () => {
    const cwd = await workspace()
    await writeFile(join(cwd, 'bad.json'), '{"stats":{}}')
    const bad = await run(cwd, 'check', 'model', '--report', 'bad.json')
    expect(bad.code).toBe(2)
    expect(bad.err).toContain('Cannot read the test report bad.json')
    expect((await run(cwd, 'check', 'model', '--report', 'missing.json')).code).toBe(2)
    expect((await run(cwd, 'check', 'model', '--evidence', 'e.json')).code).toBe(2)
  })

  it('lists the rules', async () => {
    const { code, out } = await run(await workspace(), 'check', '--list-rules')
    expect(code).toBe(0)
    expect(out).toMatch(/^requirement-without-scenario +warning +Every requirement is verified by at least one scenario\.$/m)
  })
})

describe('radical', () => {
  it('prints usage and its version, and refuses an unknown command', async () => {
    const cwd = await workspace()
    expect((await run(cwd)).out).toContain('Usage: radical <command>')
    expect((await run(cwd, '--version')).out.trim()).toMatch(/^\d+\.\d+\.\d+$/)
    const unknown = await run(cwd, 'lint')
    expect(unknown.code).toBe(2)
    expect(unknown.err).toContain('Unknown command: lint')
  })
})
