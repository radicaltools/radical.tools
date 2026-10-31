import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { CHECK_CONFIG_FILE, CHECK_METRICS, CHECK_RULES, FOLDER_RULES, GOAL_RULE, MEASUREMENTS_FILE, REVIEWS_FILE, TEST_RESULTS_FILE, formatCheckGithub, formatCheckText, mergeMeasurements, parseCheckConfig, parseMeasurementStore, parseMetricsFile, parseReviewsFile, parseTestReport, parseTestResults, ratchetConfig, reviewMeasurements, runCheck, serializeMeasurementStore, serializeTestResults, testsRanAt, type CheckConfig, type CiSource, type Measurement, type TestCase } from '@radical/common/check'
import { MdFolderSession } from '@radical/common/formats/mdFolderSync'
import { SELECTION_DIR, SELECTION_GITIGNORE_CONTENT } from '@radical/common/formats/canvasSelection'
import { diskFolderStorage } from '@radical/node-files/diskFolderStorage'
import { CATALOGUE_DIR, concernPacksOf, readCatalogue } from '@radical/hub-catalogue'
import { CiError, downloadCiReports, findCiRuns, ghCli, headOf, readLater, sameRuns, withFetchLock, type Gh } from './ciResults'

export const CHECK_USAGE = `Usage: radical check [folder] [options]

Checks a Radical Markdown model folder: its files, its metamodel, and that it
is complete (requirements have scenarios, accepted ADRs fitness functions, …).

  folder              the model folder (default: the working directory)
  --config <file>     rule settings (default: check.json in the model folder,
                      when there is one)
  --format <format>   text (default), json, or github (annotations for Actions)
  --report <path>     a test report (Vitest or Jest JSON, Playwright JSON, JUnit
                      XML), or a directory of them (.json and .xml files); repeat
                      for more. The tests that scenarios and fitness functions
                      name are looked up in them. The test cases read are kept
                      in the model folder's .radical/test-results.json for Studio
  --from-ci           read the test reports of CI instead: those of the latest
                      completed runs of the nearest commit in HEAD's history
                      that CI ran (a commit merged from a pull request stands
                      for the pull request's head), through the GitHub CLI
                      (gh, signed in). The artifacts read are check.json's
                      "ci": { "artifacts": [<name>, …] }, or every artifact of
                      the run. They are kept for Studio as --report keeps
                      them, with the commit and runs they come from, unless
                      the results there were read with --report at that
                      commit or a later one. radical hooks install fetches
                      them after a checkout, a commit, a pull and a rebase
  --quiet             print nothing (the git hooks fetch with --from-ci --quiet)
  --detach            start this check in the background and return at once
                      (the git hooks, which git waits for)
  --metrics <path>    a radical-metrics/1 file (radical sense --out), or a
                      directory of them (.json files); repeat for more. They
                      are added to what radical sense keeps in the model
                      folder's .radical/measurements.json, which is read
                      without --metrics too, and the metric conditions of
                      scenarios and fitness functions are evaluated against
                      the latest measurement each matches. The reviews
                      radical sense review keeps in the model folder's
                      reviews.json are read as measurements too
  --baseline <path>   earlier radical-metrics/1 files (a file, or a directory of
                      them; repeat for more) that a condition stated against a
                      baseline (<metric> <= baseline + 20%) compares with: the
                      median of the latest seven measurements of its metric
                      and labels. Read only, never kept beside the model
  --trigger <event>   the event the check runs on (pull-request in the gate): a
                      metric condition of a fitness function that runs on
                      another event, or continually, is not reported when
                      nothing measured it
  --evidence <file>   with --report or measurements: write what they say about
                      each scenario, fitness function, requirement and ADR as JSON
  --ratchet           lower each baseline (max) in the config to the count found
                      now, so a rule that got better cannot get worse again
                      (the test rules only with --report: without it they
                      do not run and keep their baselines)
  --verbose           list every warning, not the first five of each rule
  --list-rules        list the rules and their default severity, and the
                      metrics check.json can set goals for ("goals":
                      { "<metric>": { "min": <percent> } })

Exit status: 0 no errors, 1 errors found, 2 the check could not run.`

export interface Io {
  cwd: string
  out: (text: string) => void
  err: (text: string) => void
  /** How a shell runs this command line, for the git hooks (default: radical). */
  command?: string
  /** The node and the script that run this command line, when it runs from
   *  a file: in place of `command`, the hooks name a script inside the
   *  repository by its path from the top, so each working tree runs its own. */
  cli?: { node: string; script: string }
  /** Asks a question in a terminal and returns the answer; absent when
   *  nobody can answer (radical setup then takes its defaults). */
  ask?: (question: string) => Promise<string>
  /** Where radical setup (and its --status) find the agents' configurations
   *  (default: the process's home, environment, platform and node). */
  home?: string
  env?: Record<string, string | undefined>
  platform?: NodeJS.Platform
  execPath?: string
  /** The version this CLI pins the MCP server to and compares with (default: its build's). */
  version?: string
  /** Runs the GitHub CLI for radical check --from-ci (default: gh on the PATH). */
  gh?: Gh
  /** Starts this CLI with `args` in the background, detached from the
   *  command that started it (radical check --detach); absent when nothing
   *  can be started. */
  background?: (args: string[]) => void
}

/** Runs `radical check` with `args` (after the command name); returns the exit status. */
export async function checkCommand(args: string[], io: Io): Promise<number> {
  let parsed
  try {
    parsed = parseArgs({
      args,
      allowPositionals: true,
      options: {
        config: { type: 'string' },
        format: { type: 'string', default: 'text' },
        report: { type: 'string', multiple: true },
        'from-ci': { type: 'boolean', default: false },
        quiet: { type: 'boolean', default: false },
        detach: { type: 'boolean', default: false },
        metrics: { type: 'string', multiple: true },
        baseline: { type: 'string', multiple: true },
        trigger: { type: 'string' },
        evidence: { type: 'string' },
        ratchet: { type: 'boolean', default: false },
        verbose: { type: 'boolean', default: false },
        'list-rules': { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
      },
    })
  } catch (error) {
    io.err(`${(error as Error).message}\n\n${CHECK_USAGE}`)
    return 2
  }
  const { values, positionals } = parsed
  if (values.help) { io.out(CHECK_USAGE); return 0 }
  if (values['list-rules']) {
    for (const rule of [...FOLDER_RULES, ...CHECK_RULES, GOAL_RULE]) io.out(`${rule.id.padEnd(30)} ${rule.severity.padEnd(8)} ${rule.description}`)
    io.out('\nMetrics for goals (in percent):')
    for (const metric of CHECK_METRICS) io.out(`${metric.id.padEnd(30)} ${(metric.tests ? 'evidence' : '').padEnd(8)} ${metric.description}`)
    return 0
  }
  const fromCi = values['from-ci']
  if (positionals.length > 1 || !['text', 'json', 'github'].includes(values.format) || (fromCi && values.report?.length)
    || (values.evidence && !values.report?.length && !fromCi && !values.metrics?.length)) {
    io.err(CHECK_USAGE)
    return 2
  }

  if (values.detach) {
    if (!io.background) { io.err('radical check --detach: nothing here can start a command in the background.'); return 2 }
    io.background(['check', ...args.filter((a) => a !== '--detach')])
    return 0
  }

  const folder = positionals[0] ?? '.'
  let root: string
  let files
  try {
    root = await realpath(resolve(io.cwd, folder))
    if (!(await stat(root)).isDirectory()) throw new Error('not a directory')
    files = await new MdFolderSession(diskFolderStorage(root), { writeCache: false }).readAll()
  } catch (error) {
    io.err(`Cannot read the model folder ${folder}: ${(error as Error).message}`)
    return 2
  }

  // The model's own check.json, unless --config names another.
  const configPath = values.config ? resolve(io.cwd, values.config) : join(root, CHECK_CONFIG_FILE)
  let config: CheckConfig = {}
  try {
    config = parseCheckConfig(await readFile(configPath, 'utf8'))
  } catch (error) {
    const missing = (error as NodeJS.ErrnoException).code === 'ENOENT'
    if (!missing || values.config || values.ratchet) {
      io.err(missing ? `No config at ${configPath}.` : `Cannot read the config ${configPath}: ${(error as Error).message}`)
      return 2
    }
  }

  let tests: TestCase[] | undefined
  // Results that are not this run's: from CI, or kept from a later commit.
  let testsReadAt: string | undefined
  let keep: { reports: string[]; ci?: CiSource; commit?: string } | undefined
  if (fromCi) {
    const say = (text: string) => { if (!values.quiet) io.err(text) }
    const resultsPath = join(root, TEST_RESULTS_FILE)
    const existing = await readFile(resultsPath, 'utf8').then(parseTestResults, () => null)
    const gh = io.gh ?? ghCli(io.env ?? process.env)
    let got
    try {
      got = await withFetchLock(root, async () => {
        const source = await findCiRuns(root, gh, config.ci?.artifacts)
        if (await readLater(root, existing, source.commit)) return { source, kept: existing! }
        if (sameRuns(existing, source)) return { source, cases: existing!.cases, reports: existing!.reports }
        return { source, ...await downloadCiReports(root, gh, source) }
      })
    } catch (error) {
      say(`radical check --from-ci: ${error instanceof CiError ? error.message : (error as Error).message}`)
      return 2
    }
    if (!got) {
      say('radical check --from-ci: another fetch for this folder is running.')
      return 2
    }
    const { source } = got
    const runs = `run${source.runs.length > 1 ? 's' : ''} ${source.runs.map((r) => r.id).join(', ')}${source.runs[0]?.pr ? ` (pull request #${source.runs[0].pr})` : ''}`
    if (got.kept) {
      tests = got.kept.cases
      testsReadAt = got.kept.readAt
      say(`Kept the test results read with --report at ${got.kept.commit!.slice(0, 7)}: CI's (${runs}) are of ${source.commit.slice(0, 7)}, before it.`)
    } else {
      tests = got.cases!
      testsReadAt = testsRanAt({ version: 1, readAt: new Date().toISOString(), reports: [], cases: [], ci: source })
      keep = { reports: got.reports!, ci: source, commit: (await headOf(root)) ?? undefined }
      say(`Test results of CI ${runs} for ${source.commit.slice(0, 7)}${source.behind ? `, ${source.behind} commit${source.behind > 1 ? 's' : ''} before HEAD` : ''}.`)
    }
  } else if (values.report?.length) {
    tests = []
    let reports: string[]
    try {
      reports = await reportFiles(values.report, io.cwd)
    } catch (error) {
      io.err((error as Error).message)
      return 2
    }
    for (const report of reports) {
      try {
        const cases = parseTestReport(await readFile(resolve(io.cwd, report), 'utf8'), report)
        // A report that names no test (another kind of XML, a run that
        // found nothing) is not what --report was meant to read.
        if (!cases.length) throw new Error('it holds no test case')
        tests.push(...cases)
      } catch (error) {
        io.err(`Cannot read the test report ${report}: ${(error as Error).message}`)
        return 2
      }
    }
  }

  // What radical sense kept, with the files --metrics names added.
  const storePath = join(root, MEASUREMENTS_FILE)
  const stored = await readFile(storePath, 'utf8').then(parseMeasurementStore, () => null)
  let measurements: Measurement[] | undefined = stored ?? undefined
  if (values.metrics?.length) {
    const read: Measurement[] = []
    try {
      for (const file of await reportFiles(values.metrics, io.cwd, /\.json$/i, 'measurement')) read.push(...parseMetricsFile(await readFile(resolve(io.cwd, file), 'utf8'), file))
    } catch (error) {
      io.err((error as NodeJS.ErrnoException).code === 'ENOENT' ? `Cannot read the measurements ${(error as NodeJS.ErrnoException).path}: no such file.` : (error as Error).message)
      return 2
    }
    measurements = mergeMeasurements(stored ?? [], read)
    await writeBeside(storePath, serializeMeasurementStore(measurements))
  }

  // The reviews of manual fitness functions, kept in git beside the model.
  const reviewsText = await readFile(join(root, REVIEWS_FILE), 'utf8').catch(() => null)
  if (reviewsText !== null) {
    try {
      measurements = [...(measurements ?? []), ...reviewMeasurements(parseReviewsFile(reviewsText))]
    } catch (error) {
      io.err(`Cannot read ${REVIEWS_FILE}: ${(error as Error).message}`)
      return 2
    }
  }

  // Earlier measurements, for conditions against a baseline; not kept.
  let baseline: Measurement[] | undefined
  if (values.baseline?.length) {
    baseline = []
    try {
      for (const file of await reportFiles(values.baseline, io.cwd, /\.json$/i, 'baseline')) baseline.push(...parseMetricsFile(await readFile(resolve(io.cwd, file), 'utf8'), file))
    } catch (error) {
      io.err((error as NodeJS.ErrnoException).code === 'ENOENT' ? `Cannot read the baseline ${(error as NodeJS.ErrnoException).path}: no such file.` : (error as Error).message)
      return 2
    }
  }

  const result = runCheck(files, config, { ...(tests ? { tests } : {}), ...(testsReadAt ? { testsReadAt } : {}), ...(measurements ? { measurements } : {}), ...(baseline ? { baseline } : {}), ...(values.trigger ? { trigger: values.trigger } : {}), concerns: concernPacks() })
  if (tests && (keep || !fromCi)) {
    // For Studio, which works out from them what the tests say about the
    // model while it is edited; with the commit they were read at, so
    // results of CI never replace those of a later one.
    await writeBeside(join(root, TEST_RESULTS_FILE), serializeTestResults(tests, keep?.reports ?? values.report ?? [], new Date(),
      keep ?? { commit: (await headOf(root)) ?? undefined }))
  }
  if (values.evidence && result.evidence) await writeBeside(resolve(io.cwd, values.evidence), JSON.stringify(result.evidence, null, 2) + '\n')
  const options = { folder, verbose: values.verbose }
  if (!values.quiet) io.out(values.format === 'json' ? JSON.stringify(result, null, 2)
    : values.format === 'github' ? formatCheckGithub(result, options)
      : formatCheckText(result, options))

  if (values.ratchet) {
    const { config: next, lowered } = ratchetConfig(config, result)
    if (lowered.length) {
      await writeFile(configPath, JSON.stringify(next, null, 2) + '\n')
      // To stderr: stdout may be the JSON result.
      if (!values.quiet) io.err(`Ratchet: ${lowered.map((l) => `${l.id} ${l.from} → ${l.to}`).join(', ')} (written to ${configPath}).`)
    }
  }
  return result.ok ? 0 : 1
}

/** The report files `paths` name: a file as it is, a directory's .json and
 *  .xml files (or those `pattern` matches). A path that is not there is
 *  passed on, and fails to read; a directory with no report in it throws. */
async function reportFiles(paths: string[], cwd: string, pattern = /\.(json|xml)$/i, what = 'report'): Promise<string[]> {
  const files: string[] = []
  for (const path of paths) {
    const isDir = await stat(resolve(cwd, path)).then((s) => s.isDirectory(), () => false)
    if (!isDir) { files.push(path); continue }
    const names = (await readdir(resolve(cwd, path))).filter((name) => pattern.test(name)).sort()
    if (!names.length) throw new Error(what === 'report' ? `The report directory ${path} holds no .json or .xml report.` : `The ${what} directory ${path} holds no .json file.`)
    files.push(...names.map((name) => join(path, name)))
  }
  return files
}

/** Writes a file beside the model, making its directory. In a model
 *  folder's .radical directory, Studio's place for what is not the model, it
 *  also writes the .gitignore that keeps that directory out of version control. */
export async function writeBeside(path: string, content: string): Promise<void> {
  const dir = dirname(path)
  await mkdir(dir, { recursive: true })
  if (basename(dir) === SELECTION_DIR) {
    await writeFile(join(dir, '.gitignore'), SELECTION_GITIGNORE_CONTENT, { flag: 'wx' }).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'EEXIST') throw error
    })
  }
  await writeFile(path, content)
}

/** The Hub's concern packs, for concern-unaddressed: from the copy the build
 *  puts beside the bundle (tsup.config.ts), or from source where
 *  @radical/hub-catalogue keeps them. */
function concernPacks() {
  const bundled = join(dirname(fileURLToPath(import.meta.url)), 'hub-catalogue')
  return concernPacksOf(readCatalogue(existsSync(bundled) ? bundled : CATALOGUE_DIR))
}
