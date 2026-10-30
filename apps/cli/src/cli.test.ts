import { afterEach, describe, expect, it } from 'vitest'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
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

/** A working directory holding `model/`: one requirement no scenario verifies,
 *  satisfied by an outside system, which no concern pack asks about. */
async function workspace(data: Partial<DiagramData> = {}): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'radical-cli-'))
  dirs.push(cwd)
  const files = serializeToMdFolder({
    metamodel: builtInGovernanceMetamodel(),
    nodes: [
      node('sys', 'system', 'Shop', { external: true }),
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

  it('reports an unaddressed concern from the bundled catalogue', async () => {
    const cwd = await workspace({
      nodes: [node('user', 'person', 'Customer'), node('sys', 'system', 'Shop'), node('web', 'webapp', 'Storefront', { parentId: 'sys' })],
      relations: [{ id: 'u', relationType: 'interacts', sourceId: 'user', targetId: 'web' }],
    })
    const { code, out } = await run(cwd, 'check', 'model', '--format', 'json')
    const found = (JSON.parse(out) as { findings: Array<{ rule: string; code?: string; nodeId?: string; details?: string[] }> }).findings
      .filter((f) => f.rule === 'concern-unaddressed')
    // Several packs apply to a web app people use; authentication is one.
    const auth = found.find((f) => f.code === 'concern-authentication')
    expect(auth).toMatchObject({ nodeId: 'web' })
    expect(auth?.details?.[0]).toMatch(/^How do people sign in\? \(idp: /)
    expect(found.length).toBeGreaterThan(1)
    // A warning by default: it does not fail the check.
    expect(code).toBe(0)
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
        node('sc', 'scenario', 'Paying', { given: 'g', when: 'w', then: 't', metrics: 'test(src/pay.test.ts › pays) passed\ntest(src/pay.test.ts › refunds) passed' }),
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

  it('reads measurements given with --metrics, keeps them beside the model, and judges the conditions by them', async () => {
    const cwd = await workspace({
      nodes: [
        node('adr', 'adr', 'Fast pay', { status: 'accepted', date: '2026-10-29', context: 'c', decision: 'd', consequences: 'q' }),
        node('ff', 'fitness-fn', 'Pay latency', { metrics: 'pay.latency.p95{env=staging} <= 300 ms', max_age: '7d' }),
      ],
      relations: [{ id: 'i', relationType: 'implements', sourceId: 'ff', targetId: 'adr' }],
    })
    const file = (value: number, unit: string) => JSON.stringify({
      format: 'radical-metrics', version: 1, source: 'json', at: new Date().toISOString(), measurements: [{ metric: 'pay.latency.p95', value, unit, labels: { env: 'staging' } }],
    })
    await mkdir(join(cwd, 'metrics'))
    await writeFile(join(cwd, 'metrics/slow.json'), file(0.42, 's'))
    const red = await run(cwd, 'check', 'model', '--metrics', 'metrics', '--evidence', 'evidence.json')
    expect(red.code).toBe(1)
    expect(red.out).toMatch(/Fitness function "Pay latency": pay\.latency\.p95\{env=staging\} <= 300 ms does not hold \(0\.42 s from json, 0 min ago\)\./)
    expect(red.out).toContain('measurements: 1')
    expect(JSON.parse(await readFile(join(cwd, 'evidence.json'), 'utf8')).nodes.adr.status).toBe('broken')
    // Kept beside the model: radical check reads it without --metrics too.
    const store = JSON.parse(await readFile(join(cwd, 'model/.radical/measurements.json'), 'utf8'))
    expect(store.measurements).toHaveLength(1)
    expect((await run(cwd, 'check', 'model')).code).toBe(1)
    // A later measurement replaces it.
    await writeFile(join(cwd, 'fast.json'), file(120, 'ms'))
    expect((await run(cwd, 'check', 'model', '--metrics', 'fast.json')).code).toBe(0)
    // An old one is stale, which warns and does not pass.
    await writeFile(join(cwd, 'model/.radical/measurements.json'), JSON.stringify({ version: 1, measurements: [{ ...store.measurements[0], value: 100, unit: 'ms', at: new Date(Date.now() - 9 * 86400e3).toISOString() }] }))
    const stale = await run(cwd, 'check', 'model', '--format', 'json')
    expect(JSON.parse(stale.out).findings.map((f: { rule: string }) => f.rule)).toContain('metric-stale')
    // A file that is no radical-metrics/1 stops the check.
    await writeFile(join(cwd, 'bad.json'), '{"format":"other"}')
    const bad = await run(cwd, 'check', 'model', '--metrics', 'bad.json')
    expect(bad.code).toBe(2)
    expect(bad.err).toContain('bad.json is no radical-metrics/1 file')
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

  it('reads a check.json saved with a byte-order mark', async () => {
    const cwd = await workspace()
    await writeFile(join(cwd, 'model/check.json'), '\ufeff' + JSON.stringify({ rules: { 'requirement-without-scenario': 'error' } }))
    const { code, out, err } = await run(cwd, 'check', 'model')
    expect(err).toBe('')
    expect(code).toBe(1)
    expect(out).toContain('✖ 1 error, 0 warnings')
  })

  it('exits 2 on a report with no test case, naming it, and keeps the test results it had', async () => {
    const cwd = await workspace()
    await writeFile(join(cwd, 'green.json'), JSON.stringify({ testResults: [{ name: `${cwd}/src/pay.test.ts`, assertionResults: [{ ancestorTitles: [], title: 'pays', status: 'passed' }] }] }))
    expect((await run(cwd, 'check', 'model', '--report', 'green.json')).code).toBe(0)
    const kept = await readFile(join(cwd, 'model/.radical/test-results.json'), 'utf8')

    await writeFile(join(cwd, 'notes.xml'), '<?xml version="1.0"?><notes><note>not a report</note></notes>')
    const xml = await run(cwd, 'check', 'model', '--report', 'notes.xml')
    expect(xml.code).toBe(2)
    expect(xml.err).toContain('notes.xml')
    expect(xml.err).toContain('no test case')
    await mkdir(join(cwd, 'empty'))
    const dir = await run(cwd, 'check', 'model', '--report', 'empty')
    expect(dir.code).toBe(2)
    expect(dir.err).toContain('empty')
    // With a good report beside it, too: the check does not run on part of the input.
    expect((await run(cwd, 'check', 'model', '--report', 'green.json', '--report', 'notes.xml')).code).toBe(2)
    expect(await readFile(join(cwd, 'model/.radical/test-results.json'), 'utf8')).toBe(kept)
  })

  it('says that a goal on what the tests verify did not run without a report', async () => {
    const cwd = await workspace()
    await writeFile(join(cwd, 'model/check.json'), JSON.stringify({ goals: { 'requirements-verified': { min: 80 }, 'requirements-satisfied': { min: 50 } } }))
    const { code, out } = await run(cwd, 'check', 'model')
    expect(code).toBe(0)
    expect(out).toContain('Goals:\n  ✓ requirements-satisfied  100% (1 of 1, min 50%)\n  – requirements-verified  not run: no test report (min 80%)')
  })

  it('lists the rules', async () => {
    const { code, out } = await run(await workspace(), 'check', '--list-rules')
    expect(code).toBe(0)
    expect(out).toMatch(/^requirement-without-scenario +warning +Every requirement is verified by at least one scenario\.$/m)
  })
})

describe('radical', () => {
  it('prints the product version with --version', async () => {
    const cwd = await workspace()
    const { version } = JSON.parse(await readFile(join(import.meta.dirname, '../package.json'), 'utf8')) as { version: string }
    for (const flag of ['--version', '-v']) {
      const { code, out } = await run(cwd, flag)
      expect(code).toBe(0)
      // The bare version on the commit tagged v<version>, with the commit otherwise.
      expect(out.trim()).toMatch(new RegExp(`^${version.replace(/\./g, '\\.')}(\\+[0-9a-f]{7,})?$`))
    }
  })

  it('stops quietly when the reader of its output goes away (radical … | head)', async () => {
    // Node threw on the unhandled EPIPE: a stack trace and exit 1.
    const many = Array.from({ length: 2000 }, (_, i) => node(`r${i}`, 'requirement', `Requirement number ${i} of many`, { action: 'act' }))
    const cwd = await workspace({ nodes: many, relations: [] })
    const child = spawn(process.execPath, ['--import', createRequire(import.meta.url).resolve('tsx'), join(import.meta.dirname, 'index.ts'), 'check', 'model', '--verbose'],
      { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let err = ''
    child.stderr.on('data', (chunk: Buffer) => { err += chunk.toString() })
    // As head does: read the first lines, then close the pipe.
    child.stdout.once('data', () => child.stdout.destroy())
    const code = await new Promise<number | null>((done) => child.on('close', done))
    expect(err).toBe('')
    expect(code).toBe(0)
  }, 30_000)

  it('prints usage, and refuses an unknown command', async () => {
    const cwd = await workspace()
    expect((await run(cwd)).out).toContain('Usage: radical <command>')
    const unknown = await run(cwd, 'lint')
    expect(unknown.code).toBe(2)
    expect(unknown.err).toContain('Unknown command: lint')
  })
})
