import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { findingTestName, readFindings, writeFinding, type Finding } from '@radical/crucible/findings'
import type { Io } from './check'

export const HARDEN_USAGE = `Usage: radical harden <finding> [--scenario <name>]
       radical harden --gate (<finding> | --test "<file> › <name>") [options]

Turns a finding into a test bound to the model (Radical Crucible).

  <finding>           a finding of the findings folder (F-0003): a fuzz
                      finding is hardened by its own steps, replayed as the
                      test "<fuzz file> › <id> stays fixed: <title>"; the
                      finding is marked hardened with that test, and the test
                      id is printed for the scenario's Tests
  --scenario <name>   the scenario the test proves, kept in the finding

  --gate              checks a test before it is bound: with the source files
                      changed since the base set back to it, it must fail;
                      with them put back, it must pass; and it must pass
                      several runs at once. The working tree is left as it was,
                      also when the gate is interrupted (Ctrl+C, kill)
  --test "<f> › <n>"  the test to gate: a file from the folder crucible.json
                      is in, and the test's name
  --base <ref>        the commit without the fix (default: the merge base
                      with origin/main, else main)
  --runs <n>          runs at once for the flakiness check (default 5)
  --config <file>     the Crucible settings (default: crucible.json)

A test runs through the runner crucible.json gives for its folder
("runners": [{ "files": "apps/e2e/", "cwd": "apps/e2e",
"command": ["npx", "playwright", "test", "{file}", "-g", "{name}"] }]),
else with npx vitest run {file} -t {name} in the file's package. Tests,
findings and crucible.json are not set back.

Exit status: 0 done (the gate passed), 1 the gate failed, 2 radical harden
could not run or was interrupted.`

interface Runner {
  files: string
  cwd?: string
  command: string[]
}

interface HardenConfig {
  findings: string
  fuzz: { file: string; cwd?: string; command?: string[] }[]
  runners: Runner[]
}

/** What a gated test runs: a command in a folder. */
interface TestRun {
  label: string
  command: string
  args: string[]
  cwd: string
}

/** Files the gate never sets back: tests, findings, Crucible's settings. */
const NOT_A_FIX = /(^|\/)(tests?|__tests__|e2e)\/|\.(test|spec)\.[cm]?[jt]sx?$|^crucible\/|^crucible\.json$/

function readConfig(file: string): HardenConfig | string {
  if (!existsSync(file)) return { findings: 'crucible/findings', fuzz: [], runners: [] }
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as Partial<HardenConfig>
    return {
      findings: typeof raw.findings === 'string' ? raw.findings : 'crucible/findings',
      fuzz: Array.isArray(raw.fuzz) ? raw.fuzz : [],
      runners: Array.isArray(raw.runners) ? raw.runners.filter((r) => r && typeof r.files === 'string' && Array.isArray(r.command) && r.command.length > 0) : [],
    }
  } catch (error) {
    return `${file} is no JSON: ${(error as Error).message}`
  }
}

/** Runs `radical harden` with `args` (after the command name); returns the exit status. */
export async function hardenCommand(args: string[], io: Io): Promise<number> {
  let parsed
  try {
    parsed = parseArgs({
      args,
      allowPositionals: true,
      options: {
        scenario: { type: 'string' },
        gate: { type: 'boolean', default: false },
        test: { type: 'string' },
        base: { type: 'string' },
        runs: { type: 'string', default: '5' },
        config: { type: 'string' },
        help: { type: 'boolean', short: 'h', default: false },
      },
    })
  } catch (error) {
    io.err(`${(error as Error).message}\n\n${HARDEN_USAGE}`)
    return 2
  }
  const { values, positionals } = parsed
  if (values.help) { io.out(HARDEN_USAGE); return 0 }
  const id = positionals[0]
  const runs = Number(values.runs)
  if (positionals.length > 1 || (!id && !(values.gate && values.test)) || (id && values.test) || (values.test && !values.gate) || !Number.isInteger(runs) || runs < 1) {
    io.err(HARDEN_USAGE)
    return 2
  }
  const configFile = resolve(io.cwd, values.config ?? 'crucible.json')
  const config = readConfig(configFile)
  if (typeof config === 'string') { io.err(config); return 2 }
  const root = dirname(configFile)
  const findingsDir = resolve(root, config.findings)

  let finding: Finding | undefined
  if (id) {
    finding = readFindings(findingsDir).find((f) => f.id === id)
    if (!finding) { io.err(`No finding ${id} in ${relative(io.cwd, findingsDir) || '.'}.`); return 2 }
    if (!Array.isArray(finding.sequence) || !finding.file || !finding.world) {
      io.err(`Finding ${id} has no steps to replay (a fuzz finding has its file, world and sequence): write its test by hand, then gate it with --test.`)
      return 2
    }
  }

  if (!values.gate) {
    const test = `${finding!.file} › ${findingTestName(finding!)}`
    writeFinding(findingsDir, { ...finding!, status: 'hardened', test, ...(values.scenario ? { scenario: values.scenario } : {}) })
    io.out(`${finding!.id} is hardened: its fuzz file replays its steps as`)
    io.out(`  ${test}`)
    io.out(values.scenario
      ? `Add that line to the Tests of scenario "${values.scenario}" (the model's files are left as they are).`
      : 'Add that line to the Tests of the scenario it proves (--scenario keeps its name in the finding).')
    return 0
  }

  // The gate.
  const run = finding ? findingRun(finding, config, root) : testRun(values.test!, config, root)
  if (typeof run === 'string') { io.err(run); return 2 }
  const top = git(root, ['rev-parse', '--show-toplevel']).stdout?.trim()
  if (!top) { io.err(`${root} is not in a git repository: the gate sets files back to a commit.`); return 2 }
  const base = values.base ?? mergeBase(top)
  if (!base) { io.err('No base commit: give --base <ref>.'); return 2 }
  const changed = changedSources(top, base)
  if (typeof changed === 'string') { io.err(changed); return 2 }
  if (!changed.length) { io.err(`No source file changed since ${base}: no fix to set back.`); return 2 }

  io.out(`Gate for ${run.label}, base ${base}, ${changed.length} source file${changed.length === 1 ? '' : 's'} changed since:`)
  for (const f of changed) io.out(`  ${f}`)

  // Interrupted (Ctrl+C, kill, the terminal closed), Node would end without
  // running a finally: stop the tests, put the fix back, then end.
  let putBack: (() => void) | undefined
  const interrupted = (signal: NodeJS.Signals) => {
    for (const child of running) child.kill('SIGTERM')
    try {
      putBack?.()
      io.err(`Interrupted (${signal}): ${putBack ? 'the changed files are put back as they were.' : 'the working tree is as it was.'}`)
    } catch (error) {
      io.err(`Interrupted (${signal}): ${(error as Error).message}`)
    }
    process.exit(2)
  }
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP']
  for (const s of signals) process.on(s, interrupted)
  try {
    return await gate(run, runs, io, async () => {
      putBack = setBack(top, base, changed)
      try {
        return await runTest(run, io)
      } finally {
        const done = putBack
        putBack = undefined
        done()
      }
    })
  } finally {
    for (const s of signals) process.off(s, interrupted)
  }
}

/** The gate's three steps, the first run by `withoutFix`. */
async function gate(run: TestRun, runs: number, io: Io, withoutFix: () => Promise<number>): Promise<number> {
  const without = await withoutFix()
  if (without === 0) {
    io.out('1. Without the fix: passed. ✖ The test does not fail without the fix, so it does not prove it.')
    return 1
  }
  io.out(`1. Without the fix: failed (exit ${without}), as it should.`)
  const withFix = await runTest(run, io)
  if (withFix !== 0) {
    io.out(`2. With the fix: failed (exit ${withFix}). ✖`)
    return 1
  }
  io.out('2. With the fix: passed.')
  const codes = await Promise.all(Array.from({ length: runs }, () => runTest(run, { ...io, out: () => {}, err: () => {} })))
  const failed = codes.filter((c) => c !== 0).length
  if (failed) {
    io.out(`3. ${runs} runs at once: ${failed} failed. ✖ The test is flaky under load.`)
    return 1
  }
  io.out(`3. ${runs} runs at once: all passed.`)
  io.out('The gate passed.')
  return 0
}

/** The run of a fuzz finding's test: its fuzz file's runner, its case only. */
function findingRun(finding: Finding, config: HardenConfig, root: string): TestRun | string {
  const entry = config.fuzz.find((e) => e.file === finding.file)
  if (!entry) return `Finding ${finding.id}'s fuzz file ${finding.file} is not in crucible.json.`
  if (entry.command) return `${finding.file} runs with a command of its own: gate its case with --test "${finding.file} › ${findingTestName(finding)}" and a runner for it.`
  const cwd = resolve(root, entry.cwd ?? '.')
  return { label: findingTestName(finding), command: 'npx', args: ['vitest', 'run', relative(cwd, resolve(root, entry.file)), '-t', escapeRegExp(findingTestName(finding))], cwd }
}

/** The run of "<file> › <name>": the runner crucible.json gives for the
 *  file's folder, else Vitest in the file's package. */
function testRun(spec: string, config: HardenConfig, root: string): TestRun | string {
  const at = spec.indexOf(' › ')
  if (at < 0) return `--test takes "<file> › <name>", not "${spec}".`
  const file = spec.slice(0, at).trim(), name = spec.slice(at + 3).trim()
  if (!existsSync(resolve(root, file))) return `No test file ${file}.`
  const runner = config.runners.find((r) => file.startsWith(r.files))
  if (runner) {
    const cwd = resolve(root, runner.cwd ?? '.')
    const rel = relative(cwd, resolve(root, file))
    const fill = (part: string) => part.replace('{file}', rel).replace('{name}', escapeRegExp(name))
    return { label: spec, command: runner.command[0], args: runner.command.slice(1).map(fill), cwd }
  }
  let dir = dirname(resolve(root, file))
  while (dir.startsWith(root) && !existsSync(join(dir, 'package.json'))) dir = dirname(dir)
  if (!existsSync(join(dir, 'package.json'))) return `No package.json above ${file}: give a runner for it in crucible.json.`
  return { label: spec, command: 'npx', args: ['vitest', 'run', relative(dir, resolve(root, file)), '-t', escapeRegExp(name)], cwd: dir }
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const git = (root: string, args: string[]) => spawnSync('git', args, { cwd: root, encoding: 'utf8' })

function mergeBase(root: string): string | undefined {
  for (const ref of ['origin/main', 'main']) {
    const r = git(root, ['merge-base', 'HEAD', ref])
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim().slice(0, 12)
  }
  return undefined
}

/** The source files that differ from `base` in the working tree (changed,
 *  added, deleted, or new and not ignored), tests and findings left out. */
function changedSources(root: string, base: string): string[] | string {
  const diff = git(root, ['diff', '--name-only', base, '--'])
  if (diff.status !== 0) return `git diff ${base} failed: ${diff.stderr.trim()}`
  const untracked = git(root, ['ls-files', '--others', '--exclude-standard'])
  const all = [...diff.stdout.split('\n'), ...untracked.stdout.split('\n')].map((l) => l.trim()).filter(Boolean)
  return [...new Set(all)].filter((f) => !NOT_A_FIX.test(f)).sort()
}

/** Sets `files` as they are at `base` (a file the base has not is taken
 *  away), and returns what puts every one back as it was, once. Copies,
 *  never git stash; when a copy cannot be put back, the error names the
 *  folder that keeps them. */
function setBack(root: string, base: string, files: string[]): () => void {
  const saved = mkdtempSync(join(tmpdir(), 'radical-harden-'))
  const had = new Set<string>()
  let back = false
  const putBack = () => {
    if (back) return
    back = true
    const failed: string[] = []
    for (const f of files) {
      try {
        if (had.has(f)) {
          mkdirSync(dirname(join(root, f)), { recursive: true })
          copyFileSync(join(saved, f), join(root, f))
        } else {
          rmSync(join(root, f), { force: true })
        }
      } catch (error) {
        failed.push(`${f} (${(error as Error).message})`)
      }
    }
    if (failed.length) throw new Error(`could not put back ${failed.join(', ')}: the copies of the changed files are in ${saved}.`)
    rmSync(saved, { recursive: true, force: true })
  }
  try {
    for (const f of files) {
      if (!existsSync(join(root, f))) continue
      mkdirSync(dirname(join(saved, f)), { recursive: true })
      copyFileSync(join(root, f), join(saved, f))
      had.add(f)
    }
    for (const f of files) {
      const show = spawnSync('git', ['show', `${base}:${f}`], { cwd: root, maxBuffer: 256 * 1024 * 1024 })
      if (show.status === 0) {
        mkdirSync(dirname(join(root, f)), { recursive: true })
        writeFileSync(join(root, f), show.stdout)
      } else {
        rmSync(join(root, f), { force: true })
      }
    }
  } catch (error) {
    putBack()
    throw error
  }
  return putBack
}

/** The tests running now, stopped when the gate is interrupted. */
const running = new Set<ChildProcess>()

/** Runs the test, its output passed on; resolves with its exit status. */
function runTest(run: TestRun, io: Io): Promise<number> {
  return new Promise((done) => {
    const child = spawn(run.command, run.args, { cwd: run.cwd, shell: process.platform === 'win32' })
    running.add(child)
    child.on('close', () => running.delete(child))
    child.stdout.on('data', (d: Buffer) => { for (const line of d.toString().split('\n')) if (line.trim()) io.out(`    ${line}`) })
    child.stderr.on('data', (d: Buffer) => { for (const line of d.toString().split('\n')) if (line.trim()) io.err(`    ${line}`) })
    child.on('error', (error) => { io.err(`${run.command}: ${error.message}`); done(2) })
    child.on('close', (code) => done(code ?? 1))
  })
}
