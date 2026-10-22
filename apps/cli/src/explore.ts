import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { appendFileSync, copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { connect } from 'node:net'
import { dirname, join, relative, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { nextFindingId, readFindings, writeFinding, type Finding } from '@radical/crucible/findings'
import { diffCommand } from './diff'
import type { Io } from './check'

export const EXPLORE_USAGE = `Usage: radical explore prepare --runs <n> [--areas "<a>;<b>"] [options]
       radical explore verify <run> "<script> [args]"…
       radical explore record <report>

An exploratory round (Radical Crucible): agents look for bugs no test
describes, each run in its own area. radical explore prepares the round and
checks what comes back; the agent session starts the agents
(.claude/skills/crucible-explore).

  prepare             builds the project once (crucible.json's explore.build),
                      copies what runs need into the round's folder, and
                      writes the brief (BRIEF.md: the project's brief, the
                      commit, what changed since the last round in the code
                      and the model, the open findings, the setup, the rules,
                      the report's form), a PROMPT.md per run and round.json
    --runs <n>        how many runs
    --areas "<a>;…"   an area per run, in order (the rest choose their own)
    --since <ref>     what changed is counted from here (default: the last
                      round's commit)
    --from <n>        the first run's number (default: after the last round's)
    --no-build        copy what is built already
  verify <run> …      serves the run's build on its port, runs each script
                      ("<script> [args]", from the run's folder) and stops the
                      server; the results go into round.json
  record <report>     writes the findings of a run's report (its JSON block)
                      as findings, with a copy of each one's script

  --config <file>     the Crucible settings (default: crucible.json)

crucible.json's "explore": { "rounds": ".crucible/rounds", "brief": "…",
"known": […], "model": "architecture", "build": [[…], …], "copy": { "name":
"path" }, "serve": { "cwd": "…", "command": [… "{port}" … "{build}/name" …] },
"ports": 4500, "rules": […] }. A run NN has the ports <ports>+NN (the app),
+100+NN and +200+NN.

Exit status: 0 done, 2 radical explore could not run.`

interface ExploreConfig {
  rounds: string
  brief?: string
  known: string[]
  model?: string
  build: string[][]
  copy: Record<string, string>
  serve?: { cwd?: string; command: string[] }
  ports: number
  rules: string[]
}

interface RunEntry {
  run: number
  area?: string
  folder: string
  ports: { app: number; hub: number; other: number }
  verified: { at: string; script: string; exit: number }[]
}

interface Round {
  round: string
  from: number
  to: number
  commit: string
  since?: string
  created: string
  runs: RunEntry[]
}

interface Settings {
  root: string
  findings: string
  explore: ExploreConfig
}

/** One finding of a run's report, as the brief asks for it. */
interface ReportedFinding {
  title: string
  rule?: string
  steps?: string[]
  script?: string
  expected?: string
  actual?: string
  seen?: string
  where?: string
  test?: string
  question?: boolean
}

function readSettings(file: string): Settings | string {
  if (!existsSync(file)) return `No ${file}: its "explore" settings say how to build, copy and serve the project (radical explore --help).`
  let raw: Record<string, unknown>
  try { raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown> } catch (error) { return `${file} is no JSON: ${(error as Error).message}` }
  const e = raw.explore as Partial<ExploreConfig> | undefined
  if (!e || typeof e !== 'object') return `${file} has no "explore" settings (radical explore --help).`
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
  return {
    root: dirname(file),
    findings: typeof raw.findings === 'string' ? raw.findings : 'crucible/findings',
    explore: {
      rounds: typeof e.rounds === 'string' ? e.rounds : '.crucible/rounds',
      brief: typeof e.brief === 'string' ? e.brief : undefined,
      known: strings(e.known),
      model: typeof e.model === 'string' ? e.model : undefined,
      build: Array.isArray(e.build) ? e.build.filter((c): c is string[] => Array.isArray(c) && c.length > 0) : [],
      copy: e.copy && typeof e.copy === 'object' ? e.copy as Record<string, string> : {},
      serve: e.serve && Array.isArray(e.serve.command) && e.serve.command.length ? e.serve : undefined,
      ports: typeof e.ports === 'number' ? e.ports : 4500,
      rules: strings(e.rules),
    },
  }
}

/** Runs `radical explore` with `args` (after the command name); returns the exit status. */
export async function exploreCommand(args: string[], io: Io): Promise<number> {
  let parsed
  try {
    parsed = parseArgs({
      args,
      allowPositionals: true,
      options: {
        runs: { type: 'string' },
        areas: { type: 'string' },
        since: { type: 'string' },
        from: { type: 'string' },
        'no-build': { type: 'boolean', default: false },
        config: { type: 'string' },
        help: { type: 'boolean', short: 'h', default: false },
      },
    })
  } catch (error) {
    io.err(`${(error as Error).message}\n\n${EXPLORE_USAGE}`)
    return 2
  }
  const { values, positionals } = parsed
  const [sub, ...rest] = positionals
  if (values.help || !sub) { io.out(EXPLORE_USAGE); return sub || values.help ? 0 : 2 }
  const settings = readSettings(resolve(io.cwd, values.config ?? 'crucible.json'))
  if (typeof settings === 'string') { io.err(settings); return 2 }
  if (sub === 'prepare') {
    const runs = Number(values.runs)
    if (!Number.isInteger(runs) || runs < 1 || rest.length || (values.from !== undefined && !/^\d+$/.test(values.from))) { io.err(EXPLORE_USAGE); return 2 }
    return prepare(settings, runs, values.areas?.split(';').map((a) => a.trim()).filter(Boolean) ?? [], values.since, values.from ? Number(values.from) : undefined, !values['no-build'], io)
  }
  if (sub === 'verify') {
    if (rest.length < 2 || !/^\d+$/.test(rest[0])) { io.err(EXPLORE_USAGE); return 2 }
    return verify(settings, Number(rest[0]), rest.slice(1), io)
  }
  if (sub === 'record') {
    if (rest.length !== 1) { io.err(EXPLORE_USAGE); return 2 }
    return record(settings, resolve(io.cwd, rest[0]), io)
  }
  io.err(`Unknown step ${sub}: prepare, verify or record.\n\n${EXPLORE_USAGE}`)
  return 2
}

const git = (root: string, args: string[]) => spawnSync('git', args, { cwd: root, encoding: 'utf8' })

/** The rounds kept so far, oldest first. */
function rounds(dir: string): Round[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .map((d) => join(dir, d, 'round.json'))
    .filter((f) => existsSync(f))
    .map((f) => JSON.parse(readFileSync(f, 'utf8')) as Round)
    .sort((a, b) => a.from - b.from)
}

function portsOf(explore: ExploreConfig, run: number): RunEntry['ports'] {
  const nn = run % 100
  return { app: explore.ports + nn, hub: explore.ports + 100 + nn, other: explore.ports + 200 + nn }
}

/** The serve command of a run, its placeholders filled. */
function serveCommand(settings: Settings, round: string, entry: RunEntry): { cwd: string; command: string[] } | undefined {
  const serve = settings.explore.serve
  if (!serve) return undefined
  const fill = (part: string) => part
    .replace(/\{port\}/g, String(entry.ports.app)).replace(/\{hubPort\}/g, String(entry.ports.hub)).replace(/\{otherPort\}/g, String(entry.ports.other))
    .replace(/\{build\}/g, join(round, 'build')).replace(/\{run\}/g, entry.folder)
  return { cwd: resolve(settings.root, serve.cwd ?? '.'), command: serve.command.map(fill) }
}

async function prepare(settings: Settings, count: number, areas: string[], sinceArg: string | undefined, fromArg: number | undefined, build: boolean, io: Io): Promise<number> {
  const { root, explore } = settings
  const roundsDir = resolve(root, explore.rounds)
  const earlier = rounds(roundsDir)
  const last = earlier[earlier.length - 1]
  const from = fromArg ?? (last ? last.to + 1 : 1)
  const to = from + count - 1
  const head = git(root, ['rev-parse', '--short', 'HEAD'])
  if (head.status !== 0) { io.err(`${root} is not in a git repository: a round tests a commit.`); return 2 }
  const commit = head.stdout.trim()
  const dirty = git(root, ['status', '--porcelain', '--untracked-files=no']).stdout.trim() !== ''
  const since = sinceArg ?? last?.commit
  const name = `round-${from}-${to}`
  const dir = join(roundsDir, name)
  if (existsSync(dir)) { io.err(`${relative(io.cwd, dir)} exists already: give --from.`); return 2 }
  mkdirSync(join(dir, 'build'), { recursive: true })

  // The build, once, then what the runs need copied out of the repository,
  // so that a rebuild there during the round changes nothing for them.
  if (build) {
    for (const command of explore.build) {
      io.out(`Building: ${command.join(' ')}`)
      const r = spawnSync(command[0], command.slice(1), { cwd: root, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 256 * 1024 * 1024 })
      appendFileSync(join(dir, 'build.log'), `$ ${command.join(' ')}\n${r.stdout ?? ''}${r.stderr ?? ''}\n`)
      if (r.status !== 0) { io.err(`The build failed: ${command.join(' ')} (see ${relative(io.cwd, join(dir, 'build.log'))}).`); return 2 }
    }
  }
  for (const [copyName, path] of Object.entries(explore.copy)) {
    const source = resolve(root, path)
    if (!existsSync(source)) { io.err(`Nothing to copy at ${path}: build it first, or leave out --no-build.`); return 2 }
    cpSync(source, join(dir, 'build', copyName), { recursive: true })
  }

  const runs: RunEntry[] = []
  for (let run = from; run <= to; run++) {
    const folder = join(dir, `run-${run}`)
    mkdirSync(folder, { recursive: true })
    runs.push({ run, area: areas[run - from], folder, ports: portsOf(explore, run), verified: [] })
  }
  const round: Round = { round: name, from, to, commit, ...(since ? { since } : {}), created: new Date().toISOString(), runs }

  // What changed since the last round: commits, and the model's elements by area.
  const commits = since ? git(root, ['log', '--oneline', '--no-decorate', `${since}..HEAD`]).stdout.trim().split('\n').filter(Boolean) : []
  const modelAreas = since && explore.model ? await changedAreas(root, explore.model, since) : []
  const open = readFindings(resolve(root, settings.findings)).filter((f) => f.status === 'open' || f.status === 'question' || f.status === 'hardened')
  const earlierRuns = earlier.flatMap((r) => r.runs.map((x) => x.folder)).slice(-20)

  const serve = (entry: RunEntry) => serveCommand(settings, dir, entry)
  const brief = [
    `# Exploratory runs ${from}–${to}: common setup`,
    '',
    `You are one of ${count} exploratory run${count === 1 ? '' : 's'} working at the same time, each in its own area: stay in yours.`,
    '',
    `- Repository: ${root}, commit ${commit}${dirty ? ' (with changes not committed yet)' : ''}.`,
    ...(explore.brief ? [`- First read in full and follow \`${explore.brief}\`, the brief: how to tell that something is wrong, where to look, how to drive the product, what to hand back.`] : []),
    `- Known already, so not new findings: the findings in \`${settings.findings}\`${explore.known.length ? ` and ${explore.known.map((k) => `\`${k}\``).join(', ')}` : ''}.`,
    ...(since
      ? [`- What changed since the last round's commit ${since} (\`git log ${since}..${commit}\`, ${commits.length} commit${commits.length === 1 ? '' : 's'}). Test each change next to its neighbours, not alone: its own tests cover it alone. Look for the same pattern in other places too.`,
        ...commits.slice(0, 40).map((c) => `  - ${c}`),
        ...(commits.length > 40 ? [`  - … ${commits.length - 40} more`] : [])]
      : ['- There was no earlier round: look where bugs are likely, not where it is easy.']),
    ...(modelAreas.length
      ? [`- The model's elements changed since ${since} (\`radical diff ${explore.model} --since ${since}\`), by area: candidate areas, each with what changed in it.`,
        ...modelAreas.map((a) => `  - ${a}`)]
      : []),
    ...(open.length ? ['- Open findings and questions (not new):', ...open.map((f) => `  - ${f.id} ${f.title} (${f.status})`)] : []),
    ...(earlierRuns.length ? [`- Earlier runs' folders, with their scripts (copy a helper into your folder and change its port; do not write there): ${earlierRuns.map((f) => relative(root, f)).join(', ')}.`] : []),
    '',
    '## Setup (done: do not build in the repository)',
    '',
    `- The build of ${commit}: \`${dir}/build\`${Object.keys(explore.copy).length ? ` (${Object.keys(explore.copy).join(', ')})` : ''}.`,
    ...(explore.serve ? [`- Serve it for your run from \`${resolve(root, explore.serve.cwd ?? '.')}\` with the command in your prompt.`] : []),
    '- Your folder and your ports are in your prompt: a run NN has the ports of NN. Write scripts, screenshots and notes only in your folder.',
    `- ${count} run${count === 1 ? '' : 's'} share this machine: keep one browser open at a time and close it when a script ends; do not run the project's whole test suites.`,
    '',
    '## Rules',
    '',
    '- Do not change the repository in any way: no files written into it, no git command that changes state, no branch, no pull request.',
    '- Nothing leaves localhost.',
    ...explore.rules.map((r) => `- ${r}`),
    '- Stop your servers when you are done.',
    '',
    '## Hand back',
    '',
    'Your final message is your report, as the brief says, and ends with one JSON block for `radical explore record`. Each finding reproduced twice from a fresh start, with the script that does it (run with `node <script> [args]` from your folder while your server runs). A question for the maintainer, not a bug, is a finding with `"question": true`.',
    '',
    '```json',
    '{ "run": NN, "findings": [ { "title": "what is wrong, as a user would say it", "rule": "the rule of the brief it breaks", "steps": ["the shortest sequence", "…"], "script": "f1-short-name.mjs [args]", "screenshot": "shots/f1.png", "expected": "…", "actual": "… with numbers", "seen": "2 of 2", "where": "file and function, a guess marked as one", "test": "the test that would catch it", "question": false } ],',
    '  "covered": ["…"], "notCovered": ["…"], "seenOnce": ["…"] }',
    '```',
    '',
  ].join('\n')
  writeFileSync(join(dir, 'BRIEF.md'), brief)
  for (const entry of runs) {
    const s = serve(entry)
    writeFileSync(join(entry.folder, 'PROMPT.md'), [
      `# Run ${entry.run} of exploratory runs ${from}–${to}`,
      '',
      `Read \`${join(dir, 'BRIEF.md')}\` in full first and follow it.`,
      '',
      `- Your area: ${entry.area ?? 'your choice: one of the candidate areas of the brief that no other run of this round has, or another place where bugs are likely'}.`,
      `- Your folder: \`${entry.folder}\`.`,
      `- Your ports: ${entry.ports.app} (the app), ${entry.ports.hub}, ${entry.ports.other}.`,
      ...(s ? [`- Serve your build: from \`${s.cwd}\`, \`${s.command.join(' ')}\`.`] : []),
      '',
    ].join('\n'))
  }
  writeFileSync(join(dir, 'round.json'), JSON.stringify(round, null, 2) + '\n')
  io.out(`Prepared runs ${from}–${to} at ${commit} in ${relative(io.cwd, dir) || '.'}:`)
  for (const entry of runs) io.out(`  run ${entry.run}: port ${entry.ports.app}, ${entry.area ?? 'area of its choice'} — ${relative(io.cwd, join(entry.folder, 'PROMPT.md'))}`)
  if (modelAreas.length) io.out(`Candidate areas from the model:\n${modelAreas.map((a) => `  ${a}`).join('\n')}`)
  return 0
}

/** The model elements changed since `since`, grouped by the area they are in
 *  (the second step of their path, or the first). */
async function changedAreas(root: string, model: string, since: string): Promise<string[]> {
  let out = ''
  const code = await diffCommand([resolve(root, model), '--since', since, '--format', 'json'], { cwd: root, out: (t) => { out += t }, err: () => {} })
  if (code !== 0) return []
  const report = JSON.parse(out) as { elements: Record<'added' | 'changed' | 'removed', { label: string; path?: string[] }[]> }
  const byArea = new Map<string, { added: string[]; changed: string[]; removed: string[] }>()
  for (const kind of ['added', 'changed', 'removed'] as const) {
    for (const e of report.elements[kind] ?? []) {
      const area = (e.path?.length ?? 0) > 1 ? e.path![1] : e.path?.[0] ?? e.label
      if (!byArea.has(area)) byArea.set(area, { added: [], changed: [], removed: [] })
      byArea.get(area)![kind].push(e.label)
    }
  }
  return [...byArea]
    .sort((a, b) => count(b[1]) - count(a[1]))
    .map(([area, c]) => `${area}: ${[c.added.length && `${c.added.length} added`, c.changed.length && `${c.changed.length} changed`, c.removed.length && `${c.removed.length} removed`].filter(Boolean).join(', ')} — ${[...c.changed, ...c.added, ...c.removed].slice(0, 6).join(', ')}${count(c) > 6 ? ', …' : ''}`)
}
const count = (c: { added: string[]; changed: string[]; removed: string[] }) => c.added.length + c.changed.length + c.removed.length

/** The round that holds `run`, and the run. */
function findRun(settings: Settings, run: number): { dir: string; round: Round; entry: RunEntry } | undefined {
  const roundsDir = resolve(settings.root, settings.explore.rounds)
  for (const round of rounds(roundsDir)) {
    const entry = round.runs.find((r) => r.run === run)
    if (entry) return { dir: join(roundsDir, round.round), round, entry }
  }
  return undefined
}

async function verify(settings: Settings, run: number, scripts: string[], io: Io): Promise<number> {
  const found = findRun(settings, run)
  if (!found) { io.err(`No round has run ${run}.`); return 2 }
  const { dir, round, entry } = found
  const serve = serveCommand(settings, dir, entry)
  let server: ChildProcess | undefined
  try {
    if (serve) {
      if (await listening(entry.ports.app, 200)) { io.err(`Port ${entry.ports.app} is taken: stop what listens there first.`); return 2 }
      server = spawn(serve.command[0], serve.command.slice(1), { cwd: serve.cwd, detached: process.platform !== 'win32', stdio: 'ignore', shell: process.platform === 'win32' })
      if (!(await listening(entry.ports.app, 30_000))) { io.err(`The run's server did not answer on port ${entry.ports.app}: ${serve.command.join(' ')}`); return 2 }
      io.out(`Serving run ${run}'s build on port ${entry.ports.app}.`)
    }
    for (const line of scripts) {
      const [script, ...args] = line.trim().split(/\s+/)
      const r = spawnSync('node', [script, ...args], { cwd: entry.folder, encoding: 'utf8', timeout: 10 * 60_000, maxBuffer: 64 * 1024 * 1024 })
      const output = `${r.stdout ?? ''}${r.stderr ?? ''}`.trimEnd().split('\n').slice(-20)
      io.out(`=== ${line}`)
      for (const l of output) if (l) io.out(`  ${l}`)
      io.out(`  (exit ${r.status ?? 'killed'})`)
      entry.verified.push({ at: new Date().toISOString(), script: line, exit: r.status ?? -1 })
    }
    writeFileSync(join(dir, 'round.json'), JSON.stringify(round, null, 2) + '\n')
    return 0
  } finally {
    if (server?.pid) {
      try { process.kill(process.platform === 'win32' ? server.pid : -server.pid) } catch { /* gone already */ }
      await waitClosed(entry.ports.app)
    }
  }
}

/** Whether something answers on the port within `ms`. */
async function listening(port: number, ms: number): Promise<boolean> {
  const until = Date.now() + ms
  do {
    // A server on localhost may listen on IPv4 or IPv6 only (vite on macOS: ::1).
    for (const host of ['127.0.0.1', '::1']) {
      const open = await new Promise<boolean>((done) => {
        const socket = connect({ port, host })
        socket.once('connect', () => { socket.destroy(); done(true) })
        socket.once('error', () => done(false))
      })
      if (open) return true
    }
    await new Promise((r) => setTimeout(r, 100))
  } while (Date.now() < until)
  return false
}

async function waitClosed(port: number): Promise<void> {
  for (let i = 0; i < 50 && (await listening(port, 0)); i++) await new Promise((r) => setTimeout(r, 100))
}

async function record(settings: Settings, file: string, io: Io): Promise<number> {
  if (!existsSync(file)) { io.err(`No report ${file}.`); return 2 }
  const text = readFileSync(file, 'utf8')
  const block = [...text.matchAll(/```json\s*\n([\s\S]*?)\n```/g)].pop()?.[1] ?? text
  let report: { run?: number; findings?: ReportedFinding[] }
  try { report = JSON.parse(block) } catch { io.err(`${file} has no JSON report (a \`\`\`json block with "run" and "findings").`); return 2 }
  if (typeof report.run !== 'number' || !Array.isArray(report.findings)) { io.err(`${file}'s report names no run and findings.`); return 2 }
  const found = findRun(settings, report.run)
  if (!found) { io.err(`No round has run ${report.run}.`); return 2 }
  const findingsDir = resolve(settings.root, settings.findings)
  const existing = readFindings(findingsDir)
  const ids = existing.map((f) => f.id)
  const commit = found.round.commit
  const written: Finding[] = []
  for (const f of report.findings) {
    if (!f.title || existing.some((x) => x.round === found.round.round && x.title === f.title) || written.some((x) => x.title === f.title)) continue
    const id = nextFindingId(ids)
    ids.push(id)
    let script: string | undefined
    if (f.script) {
      const [name, ...args] = f.script.trim().split(/\s+/)
      const copied = copyScript(found.entry.folder, name, join(findingsDir, id))
      script = copied ? [`${id}/${name}`, ...args].join(' ') : f.script
    }
    const finding: Finding = {
      id,
      title: f.title,
      source: 'explore',
      status: f.question ? 'question' : 'open',
      rule: f.rule ?? '',
      signature: `explore|${f.rule ?? '-'}|${f.title}`,
      round: found.round.round,
      run: report.run,
      ...(script ? { script } : {}),
      commit,
      found: new Date().toISOString().slice(0, 10),
      steps: f.steps ?? [],
      detail: [f.expected && `Expected: ${f.expected}`, f.actual && `Actual: ${f.actual}`, f.seen && `Seen: ${f.seen}`, f.where && `Where it probably comes from: ${f.where}`, f.test && `A test that would catch it: ${f.test}`].filter(Boolean).join('\n'),
    }
    writeFinding(findingsDir, finding)
    written.push(finding)
  }
  io.out(written.length
    ? `Wrote ${written.length} finding${written.length === 1 ? '' : 's'} of run ${report.run}:\n${written.map((f) => `  ${f.id}  ${f.title}${f.status === 'question' ? ' (question)' : ''}`).join('\n')}`
    : `No new findings in run ${report.run}'s report.`)
  return 0
}

/** Copies a script and the scripts beside it that it imports (relative
 *  imports, followed) into `to`; false when the script is not there. */
function copyScript(folder: string, name: string, to: string): boolean {
  const seen = new Set<string>()
  const visit = (rel: string) => {
    const file = resolve(folder, rel)
    if (seen.has(file) || !existsSync(file) || !file.startsWith(resolve(folder))) return
    seen.add(file)
    mkdirSync(dirname(join(to, relative(folder, file))), { recursive: true })
    copyFileSync(file, join(to, relative(folder, file)))
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g)) visit(join(dirname(relative(folder, file)), m[1]))
  }
  if (!existsSync(resolve(folder, name))) return false
  visit(name)
  return true
}
