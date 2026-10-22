import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { nextFindingId, readFindings, writeFinding, type Finding } from '@radical/crucible/findings'
import type { SurveyRecord } from '@radical/crucible'
import type { Io } from './check'

export const FUZZ_USAGE = `Usage: radical fuzz [plan] [options]

Runs the fuzz files crucible.json lists (Radical Crucible), each through its
test runner, with the plan's settings.

  plan                ci (default): the seeds and runs each file fixes;
                      night: a random seed and 2000 runs of each world
  --world <name>      run this world of each file only
  --seed <n>          run with this seed
  --runs <n>          runs of each world
  --length <n>        the longest sequence of actions
  --survey            go on after each failure, and record each one whose
                      signature no finding has as an open finding
  --replay <id>       run a finding again with its world, seed, path and
                      length, without shrinking
  --no-known          known failures filter nothing
  --no-shrink         report the first failure as found
  --report <dir>      write a Vitest JSON report of each file into the
                      directory, for radical check --report
  --config <file>     the Crucible settings (default: crucible.json in the
                      working directory)

crucible.json names the fuzz files and the findings folder:
  { "findings": "crucible/findings",
    "fuzz": [{ "file": "packages/ui/tests/invariants.test.ts", "cwd": "packages/ui" }] }
Paths are from the folder crucible.json is in. A file runs with
\`npx vitest run <file>\` in its cwd, or with its "command" (a list).

Exit status: 0 every file passed, 1 one failed, 2 radical fuzz could not run.`

/** A fuzz file of crucible.json. */
interface FuzzEntry {
  file: string
  cwd?: string
  /** The command that runs it, in place of npx vitest run <file>. */
  command?: string[]
}

interface CrucibleConfig {
  findings: string
  fuzz: FuzzEntry[]
}

/** The settings in crucible.json, or why they cannot be used. */
function readConfig(file: string): CrucibleConfig | string {
  if (!existsSync(file)) return `No ${file}: it lists the fuzz files (radical fuzz --help).`
  let raw: unknown
  try { raw = JSON.parse(readFileSync(file, 'utf8')) } catch (error) { return `${file} is no JSON: ${(error as Error).message}` }
  const config = raw as Partial<CrucibleConfig>
  if (!Array.isArray(config.fuzz) || !config.fuzz.length || !config.fuzz.every((e) => e && typeof e.file === 'string' && (e.command === undefined || (Array.isArray(e.command) && e.command.length > 0)))) {
    return `${file} lists no fuzz files: "fuzz" is a list of { "file", "cwd"?, "command"? }.`
  }
  return { findings: typeof config.findings === 'string' ? config.findings : 'crucible/findings', fuzz: config.fuzz }
}

/** Runs `radical fuzz` with `args` (after the command name); returns the exit status. */
export async function fuzzCommand(args: string[], io: Io): Promise<number> {
  let parsed
  try {
    parsed = parseArgs({
      args,
      allowPositionals: true,
      options: {
        world: { type: 'string' },
        seed: { type: 'string' },
        runs: { type: 'string' },
        length: { type: 'string' },
        survey: { type: 'boolean', default: false },
        replay: { type: 'string' },
        'no-known': { type: 'boolean', default: false },
        'no-shrink': { type: 'boolean', default: false },
        report: { type: 'string' },
        config: { type: 'string' },
        help: { type: 'boolean', short: 'h', default: false },
      },
    })
  } catch (error) {
    io.err(`${(error as Error).message}\n\n${FUZZ_USAGE}`)
    return 2
  }
  const { values, positionals } = parsed
  if (values.help) { io.out(FUZZ_USAGE); return 0 }
  const plan = positionals[0] ?? 'ci'
  const numbers = { seed: values.seed, runs: values.runs, length: values.length }
  const badNumber = Object.entries(numbers).find(([, v]) => v !== undefined && !/^-?\d+$/.test(v))
  if (positionals.length > 1 || !['ci', 'night'].includes(plan) || badNumber || (values.survey && values.replay)) {
    io.err(`${badNumber ? `--${badNumber[0]} takes a whole number.\n\n` : !['ci', 'night'].includes(plan) ? `Unknown plan ${plan}: ci or night.\n\n` : ''}${FUZZ_USAGE}`)
    return 2
  }
  const configFile = resolve(io.cwd, values.config ?? 'crucible.json')
  const config = readConfig(configFile)
  if (typeof config === 'string') { io.err(config); return 2 }
  const root = dirname(configFile)
  const findingsDir = resolve(root, config.findings)

  // What every file runs with.
  const settings: Record<string, string> = { FUZZ_PLAN: plan }
  if (values.world) settings.FUZZ_WORLD = values.world
  if (values.seed) settings.FUZZ_SEED = values.seed
  if (values.runs) settings.FUZZ_RUNS = values.runs
  if (values.length) settings.FUZZ_LENGTH = values.length
  if (values['no-known']) settings.FUZZ_NO_KNOWN = '1'
  if (values['no-shrink']) settings.FUZZ_NO_SHRINK = '1'

  let entries = config.fuzz
  if (values.replay) {
    const finding = readFindings(findingsDir).find((f) => f.id === values.replay)
    if (!finding) { io.err(`No finding ${values.replay} in ${relative(io.cwd, findingsDir) || '.'}.`); return 2 }
    const entry = config.fuzz.find((e) => e.file === finding.file)
    if (!entry || !finding.world || finding.seed === undefined) {
      io.err(`Finding ${finding.id} names no fuzz file of crucible.json, world and seed to replay.`)
      return 2
    }
    entries = [entry]
    Object.assign(settings, { FUZZ_WORLD: finding.world, FUZZ_SEED: String(finding.seed), FUZZ_NO_SHRINK: '1' })
    if (finding.path) settings.FUZZ_PATH = finding.path
    if (finding.length !== undefined) settings.FUZZ_LENGTH = String(finding.length)
    io.out(`Replaying ${finding.id}: ${finding.title}`)
  }

  const scratch = values.survey ? mkdtempSync(join(tmpdir(), 'radical-fuzz-')) : undefined
  if (scratch) {
    settings.FUZZ_SURVEY = join(scratch, 'survey.txt')
    settings.FUZZ_FINDINGS = join(scratch, 'findings.jsonl')
  }
  const reportDir = values.report ? resolve(io.cwd, values.report) : undefined
  if (reportDir) mkdirSync(reportDir, { recursive: true })

  try {
    let failed = 0
    for (const entry of entries) {
      const cwd = resolve(root, entry.cwd ?? '.')
      const command = entry.command ?? ['npx', 'vitest', 'run', relative(cwd, resolve(root, entry.file))]
      const args = [...command.slice(1)]
      if (reportDir && !entry.command) args.push('--reporter=default', '--reporter=json', `--outputFile.json=${join(reportDir, `crucible-${entry.file.replace(/[^\w.-]+/g, '-')}.json`)}`)
      io.out(`▶ ${entry.file} (${values.replay ? `replay ${values.replay}` : `plan ${plan}`})`)
      const code = await run(command[0], args, cwd, settings, io)
      if (code !== 0) failed++
    }
    if (scratch) {
      const written = recordSurvey(join(scratch, 'findings.jsonl'), findingsDir, root, io)
      io.out(written.length
        ? `New findings (${written.length}):\n${written.map((f) => `  ${f.id}  ${f.title}`).join('\n')}`
        : 'No new findings: every failure the survey met is known or a finding already.')
      if (existsSync(settings.FUZZ_SURVEY)) io.out(`The survey's reports: ${settings.FUZZ_SURVEY}`)
    }
    io.out(`radical fuzz: ${entries.length} file${entries.length === 1 ? '' : 's'}, ${failed ? `${failed} failed` : 'all passed'}`)
    return failed ? 1 : 0
  } finally {
    // The survey's reports stay for the reader; the records are made findings.
    if (scratch) rmSync(join(scratch, 'findings.jsonl'), { force: true })
  }
}

/** Runs a command with the FUZZ_* settings (and none it inherited), its
 *  output passed on; resolves with its exit status. */
function run(command: string, args: string[], cwd: string, settings: Record<string, string>, io: Io): Promise<number> {
  const env: Record<string, string | undefined> = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('FUZZ_')))
  return new Promise((done) => {
    const child = spawn(command, args, { cwd, env: { ...env, ...settings }, shell: process.platform === 'win32' })
    const pass = (stream: NodeJS.ReadableStream, write: (text: string) => void) => {
      let buffer = ''
      stream.on('data', (chunk: Buffer) => {
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) write(line)
      })
      stream.on('end', () => { if (buffer) write(buffer) })
    }
    pass(child.stdout, io.out)
    pass(child.stderr, io.err)
    child.on('error', (error) => { io.err(`${command}: ${error.message}`); done(2) })
    child.on('close', (code) => done(code ?? 1))
  })
}

/** Makes an open finding of each survey record whose signature no finding
 *  (but a fixed one) has yet; returns those written. */
function recordSurvey(recordsFile: string, findingsDir: string, root: string, io: Io): Finding[] {
  if (!existsSync(recordsFile)) return []
  const records = readFileSync(recordsFile, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l) as SurveyRecord)
  const existing = readFindings(findingsDir)
  const known = new Set(existing.filter((f) => f.status !== 'fixed').map((f) => f.signature))
  const ids = existing.map((f) => f.id)
  const commit = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout?.trim() || undefined
  const found = new Date().toISOString().slice(0, 10)
  const written: Finding[] = []
  for (const r of records) {
    if (known.has(r.signature)) continue
    known.add(r.signature)
    const last = /a: '([^']+)'/.exec(r.actions[r.actions.length - 1] ?? '')?.[1] ?? 'a step'
    const finding: Finding = {
      id: nextFindingId(ids),
      title: `${r.rule} broken after ${last} (${r.world})`,
      source: 'fuzz',
      status: 'open',
      rule: r.rule,
      signature: r.signature,
      ...(r.file ? { file: r.file } : {}),
      suite: r.suite,
      world: r.world,
      seed: r.seed,
      ...(r.path ? { path: r.path } : {}),
      length: r.length,
      ...(commit ? { commit } : {}),
      found,
      steps: r.steps,
      detail: r.detail,
    }
    ids.push(finding.id)
    writeFinding(findingsDir, finding)
    written.push(finding)
  }
  if (written.length) io.out(`Wrote ${written.length} finding${written.length === 1 ? '' : 's'} into ${relative(root, findingsDir) || '.'}.`)
  return written
}
