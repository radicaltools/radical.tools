import { afterEach, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { connect } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { serializeToMdFolder } from '@radical/common/formats/mdFolder'
import type { C4Node } from '@radical/common/c4'
import { readFindings, writeFinding } from '@radical/crucible/findings'
import { main } from './cli'

const dirs: string[] = []
afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))) })

async function run(cwd: string, ...args: string[]): Promise<{ code: number; out: string; err: string }> {
  let out = ''
  let err = ''
  const code = await main(['explore', ...args], { cwd, out: (t) => { out += t + '\n' }, err: (t) => { err += t + '\n' } })
  return { code, out, err }
}

const PORTS = 47000

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node

async function writeModel(cwd: string, action: string): Promise<void> {
  await rm(join(cwd, 'model'), { recursive: true, force: true })
  const files = serializeToMdFolder({
    metamodel: builtInGovernanceMetamodel(),
    nodes: [
      node('conceptual', 'group', 'Conceptual'),
      node('layout', 'domain', 'Layout', { parentId: 'conceptual' }),
      node('calm', 'requirement', 'Drag is calm', { parentId: 'layout', action }),
    ],
    relations: [],
  }, 'Test')
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(cwd, 'model', path)), { recursive: true })
    await writeFile(join(cwd, 'model', path), content)
  }
}

/** A repository at its second commit: the model's requirement and the code
 *  changed since the first, which an earlier round (runs 3 and 4) tested. */
async function project(explore: object | null = {}): Promise<{ cwd: string; first: string; second: string }> {
  const cwd = await mkdtemp(join(tmpdir(), 'radical-explore-'))
  dirs.push(cwd)
  const git = (...args: string[]) => execFileSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=Test', ...args], { cwd, encoding: 'utf8' }).trim()
  await writeModel(cwd, 'move only what is dragged')
  await writeFile(join(cwd, 'app.txt'), 'one\n')
  await writeFile(join(cwd, 'BRIEF-RULES.md'), '# How to tell that something is wrong\n')
  // A server of the build: answers with the file it is given.
  await writeFile(join(cwd, 'serve.mjs'), "import { createServer } from 'node:http'\nimport { readFileSync } from 'node:fs'\ncreateServer((req, res) => res.end(readFileSync(process.argv[3] + '/index.html'))).listen(Number(process.argv[2]), '127.0.0.1')\n")
  await writeFile(join(cwd, 'crucible.json'), JSON.stringify({
    findings: 'crucible/findings',
    ...(explore ? {
      explore: {
        rounds: 'rounds',
        brief: 'BRIEF-RULES.md',
        known: ['docs/KNOWN.md'],
        model: 'model',
        build: [['node', '-e', "require('fs').mkdirSync('out',{recursive:true});require('fs').writeFileSync('out/index.html','the app')"]],
        copy: { site: 'out' },
        serve: { command: ['node', 'serve.mjs', '{port}', '{build}/site'] },
        ports: PORTS,
        rules: ['Do not use the MCP tools of the real model.'],
        ...explore,
      },
    } : {}),
  }))
  await writeFile(join(cwd, '.gitignore'), 'out/\nrounds/\n')
  writeFinding(join(cwd, 'crucible', 'findings'), { id: 'F-0001', title: 'A reload moves Customer', source: 'fuzz', status: 'open', rule: 'reloadKeeps', signature: 's', found: '2026-10-21', steps: [], detail: '' })
  git('init', '-q', '-b', 'main')
  git('add', '.')
  git('commit', '-q', '-m', 'first')
  const first = git('rev-parse', '--short', 'HEAD')
  await writeModel(cwd, 'move only what is dragged, and drop it clear of its neighbours')
  await writeFile(join(cwd, 'app.txt'), 'two\n')
  git('commit', '-q', '-am', 'drops land clear of neighbours')
  const second = git('rev-parse', '--short', 'HEAD')
  await mkdir(join(cwd, 'rounds', 'round-3-4'), { recursive: true })
  await writeFile(join(cwd, 'rounds', 'round-3-4', 'round.json'), JSON.stringify({ round: 'round-3-4', from: 3, to: 4, commit: first, created: '2026-10-21', runs: [] }))
  return { cwd, first, second }
}

const listening = (port: number) => new Promise<boolean>((done) => {
  const socket = connect({ port, host: '127.0.0.1' })
  socket.once('connect', () => { socket.destroy(); done(true) })
  socket.once('error', () => done(false))
})

describe('radical explore prepare', () => {
  it('builds once and gives each run its folder, copy, ports and prompt', async () => {
    const { cwd } = await project()
    const { code, out } = await run(cwd, 'prepare', '--runs', '2', '--areas', 'layout under edits; undo')
    expect(code).toBe(0)
    const round = join(cwd, 'rounds', 'round-5-6')
    expect(out).toContain('Prepared runs 5–6')
    expect(out).toContain(`run 5: port ${PORTS + 5}, layout under edits`)
    expect(await readFile(join(round, 'build', 'site', 'index.html'), 'utf8')).toBe('the app')
    const prompt = await readFile(join(round, 'run-5', 'PROMPT.md'), 'utf8')
    expect(prompt).toContain('- Your area: layout under edits.')
    expect(prompt).toContain(`- Your ports: ${PORTS + 5} (the app), ${PORTS + 105}, ${PORTS + 205}.`)
    expect(prompt).toContain(`\`node serve.mjs ${PORTS + 5} ${join(round, 'build')}/site\``)
    expect(await readFile(join(round, 'run-6', 'PROMPT.md'), 'utf8')).toContain('- Your area: undo.')
    const journal = JSON.parse(await readFile(join(round, 'round.json'), 'utf8'))
    expect(journal.runs.map((r: { run: number; area: string }) => [r.run, r.area])).toEqual([[5, 'layout under edits'], [6, 'undo']])
    // The repository is left as it was.
    expect(execFileSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8' })).toBe('')
  })

  it('writes a brief of what changed since the last round, in the code and the model', async () => {
    const { cwd, first, second } = await project()
    await run(cwd, 'prepare', '--runs', '1')
    const brief = await readFile(join(cwd, 'rounds', 'round-5-5', 'BRIEF.md'), 'utf8')
    expect(brief).toContain(`commit ${second}.`)
    expect(brief).toContain('First read in full and follow `BRIEF-RULES.md`')
    expect(brief).toContain('the findings in `crucible/findings` and `docs/KNOWN.md`')
    expect(brief).toContain(`since the last round's commit ${first} (\`git log ${first}..${second}\`, 1 commit)`)
    expect(brief).toMatch(new RegExp(`  - ${second} drops land clear of neighbours`))
    expect(brief).toContain('  - Layout: 1 changed — Drag is calm')
    expect(brief).toContain('  - F-0001 A reload moves Customer (open)')
    expect(brief).toContain('- Do not use the MCP tools of the real model.')
    expect(brief).toContain('```json\n{ "run": NN, "findings": [')
    // A finding's script is copied out of the round: it must run from there too.
    expect(brief).toContain('Scripts name no absolute path:')
  })

  it('exits 2 without explore settings', async () => {
    const { cwd } = await project(null)
    const { code, err } = await run(cwd, 'prepare', '--runs', '2')
    expect(code).toBe(2)
    expect(err).toContain('has no "explore" settings')
    expect((await run(cwd, 'prepare')).code).toBe(2)
  })
})

describe('radical explore verify', () => {
  it('serves the run\'s build, runs its scripts and stops the server', async () => {
    const { cwd } = await project()
    await run(cwd, 'prepare', '--runs', '1')
    const folder = join(cwd, 'rounds', 'round-5-5', 'run-5')
    await writeFile(join(folder, 'look.mjs'), `const r = await fetch('http://127.0.0.1:' + process.argv[2]); console.log('page: ' + await r.text())\n`)
    await writeFile(join(folder, 'broken.mjs'), "console.log('the row is 12 px off'); process.exit(3)\n")
    const { code, out } = await run(cwd, 'verify', '5', `look.mjs ${PORTS + 5}`, 'broken.mjs')
    expect(code).toBe(0)
    expect(out).toContain(`Serving run 5's build on port ${PORTS + 5}.`)
    expect(out).toContain(`=== look.mjs ${PORTS + 5}\n  page: the app\n  (exit 0)`)
    expect(out).toContain('=== broken.mjs\n  the row is 12 px off\n  (exit 3)')
    expect(await listening(PORTS + 5)).toBe(false)
    const journal = JSON.parse(await readFile(join(cwd, 'rounds', 'round-5-5', 'round.json'), 'utf8'))
    expect(journal.runs[0].verified.map((v: { script: string; exit: number }) => [v.script, v.exit])).toEqual([[`look.mjs ${PORTS + 5}`, 0], ['broken.mjs', 3]])
    expect((await run(cwd, 'verify', '9', 'look.mjs')).code).toBe(2)
  })
})

describe('radical explore verify with several servers', () => {
  it('serves each server on its port of the run, and stops them all', async () => {
    const { cwd } = await project({
      copy: { site: 'out', hub: 'out' },
      serve: [
        { command: ['node', 'serve.mjs', '{port}', '{build}/site'] },
        { command: ['node', 'serve.mjs', '{hubPort}', '{build}/hub'], port: 'hub' },
      ],
    })
    expect((await run(cwd, 'prepare', '--runs', '1')).code).toBe(0)
    const round = join(cwd, 'rounds', 'round-5-5')
    const prompt = await readFile(join(round, 'run-5', 'PROMPT.md'), 'utf8')
    expect(prompt).toContain(`\`node serve.mjs ${PORTS + 5} ${join(round, 'build')}/site\``)
    expect(prompt).toContain(`\`node serve.mjs ${PORTS + 105} ${join(round, 'build')}/hub\``)
    const folder = join(round, 'run-5')
    await writeFile(join(folder, 'both.mjs'), `for (const p of process.argv.slice(2)) console.log(p + ': ' + await (await fetch('http://127.0.0.1:' + p)).text())\n`)
    const { code, out, err } = await run(cwd, 'verify', '5', `both.mjs ${PORTS + 5} ${PORTS + 105}`)
    expect(err).toBe('')
    expect(code).toBe(0)
    expect(out).toContain(`Serving run 5's build on ports ${PORTS + 5} and ${PORTS + 105}.`)
    expect(out).toContain(`  ${PORTS + 5}: the app\n  ${PORTS + 105}: the app\n  (exit 0)`)
    expect(await listening(PORTS + 5)).toBe(false)
    expect(await listening(PORTS + 105)).toBe(false)
  })
})

describe('radical explore record', () => {
  it('writes each finding with a copy of its script, once', async () => {
    const { cwd, second } = await project()
    await run(cwd, 'prepare', '--runs', '1')
    const folder = join(cwd, 'rounds', 'round-5-5', 'run-5')
    await writeFile(join(folder, 'lib.mjs'), 'export const port = 4505\n')
    await writeFile(join(folder, 'f1-row.mjs'), "import { port } from './lib.mjs'\nconsole.log(port)\n")
    const report = join(folder, 'REPORT.md')
    await writeFile(report, [
      '# Run 5', '', 'Two findings.', '', '```json',
      JSON.stringify({
        run: 5,
        findings: [
          { title: 'A drop next to a row leaves the row off its line', rule: 'nothing moves by itself', steps: ['keep API and DB in a row', 'drop Queue beside DB'], script: 'f1-row.mjs 2', expected: 'the row holds', actual: 'DB is 12 px lower', seen: '2 of 2', where: 'a guess: settleMovedNodes', test: 'packages/ui/tests/calmDrag.test.ts: a drop beside a row' },
          { title: 'Should a drop on a pinned element push it?', question: true },
        ],
      }),
      '```', '',
    ].join('\n'))
    const first = await run(cwd, 'record', report)
    expect(first.code).toBe(0)
    expect(first.out).toContain('Wrote 2 findings of run 5:\n  F-0002  A drop next to a row leaves the row off its line\n  F-0003  Should a drop on a pinned element push it? (question)')
    const [, bug, question] = readFindings(join(cwd, 'crucible', 'findings'))
    expect(bug).toMatchObject({ source: 'explore', status: 'open', rule: 'nothing moves by itself', round: 'round-5-5', run: 5, script: 'F-0002/f1-row.mjs 2', commit: second, steps: ['keep API and DB in a row', 'drop Queue beside DB'] })
    expect(bug.detail).toBe('Expected: the row holds\nActual: DB is 12 px lower\nSeen: 2 of 2\nWhere it probably comes from: a guess: settleMovedNodes\nA test that would catch it: packages/ui/tests/calmDrag.test.ts: a drop beside a row')
    expect(question).toMatchObject({ status: 'question', title: 'Should a drop on a pinned element push it?' })
    expect(readdirSync(join(cwd, 'crucible', 'findings', 'F-0002')).sort()).toEqual(['f1-row.mjs', 'lib.mjs'])
    expect(existsSync(join(cwd, 'crucible', 'findings', 'F-0003'))).toBe(false)
    const again = await run(cwd, 'record', report)
    expect(again.out).toContain('No new findings in run 5\'s report.')
    expect(readFindings(join(cwd, 'crucible', 'findings'))).toHaveLength(3)
  })

  it('keeps the screenshot a finding names, beside its script', async () => {
    const { cwd } = await project()
    await run(cwd, 'prepare', '--runs', '1')
    const folder = join(cwd, 'rounds', 'round-5-5', 'run-5')
    await writeFile(join(folder, 'f1-row.mjs'), "console.log('row')\n")
    await mkdir(join(folder, 'shots'))
    await writeFile(join(folder, 'shots', 'f1.png'), 'png')
    const report = join(folder, 'REPORT.md')
    await writeFile(report, '```json\n' + JSON.stringify({ run: 5, findings: [
      { title: 'The row is off', script: 'f1-row.mjs', screenshot: 'shots/f1.png' },
      { title: 'The camera jumps', screenshot: 'shots/missing.png' },
    ] }) + '\n```\n')
    const { code, err } = await run(cwd, 'record', report)
    expect(code).toBe(0)
    const [, shot, missing] = readFindings(join(cwd, 'crucible', 'findings'))
    expect(shot).toMatchObject({ script: 'F-0002/f1-row.mjs', screenshot: 'F-0002/shots/f1.png' })
    expect(await readFile(join(cwd, 'crucible', 'findings', 'F-0002', 'shots', 'f1.png'), 'utf8')).toBe('png')
    // One that is not there is named as the report names it, and said.
    expect(missing).toMatchObject({ screenshot: 'shots/missing.png' })
    expect(err).toContain(`F-0003's screenshot shots/missing.png is not in run 5's folder.`)
  })

  it('warns about a recorded script that names the round\'s absolute paths', async () => {
    const { cwd } = await project()
    await run(cwd, 'prepare', '--runs', '1')
    const folder = join(cwd, 'rounds', 'round-5-5', 'run-5')
    await writeFile(join(folder, 'lib.mjs'), `export const CLI = '${join(cwd, 'apps/cli/dist/index.js')}'\n`)
    await writeFile(join(folder, 'f1-row.mjs'), `import { CLI } from './lib.mjs'\nconst build = '${join(cwd, 'rounds', 'round-5-5', 'build')}'\nconsole.log(CLI, build)\n`)
    await writeFile(join(folder, 'f2-ok.mjs'), "console.log('/usr/bin/env')\n")
    const report = join(folder, 'REPORT.md')
    await writeFile(report, '```json\n' + JSON.stringify({ run: 5, findings: [
      { title: 'The row is off', script: 'f1-row.mjs' },
      { title: 'The camera jumps', script: 'f2-ok.mjs' },
    ] }) + '\n```\n')
    const { code, err } = await run(cwd, 'record', report)
    expect(code).toBe(0)
    expect(err).toContain(`Warning: F-0002/f1-row.mjs names ${join(cwd, 'rounds', 'round-5-5', 'build')} (line 2): it runs only where the round ran.`)
    expect(err).toContain(`Warning: F-0002/lib.mjs names ${join(cwd, 'apps/cli/dist/index.js')} (line 1): it runs only where the round ran.`)
    expect(err).not.toContain('F-0003')
  })
})
