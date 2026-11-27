import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, realpath, rename, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { CHECK_CONFIG_FILE, CHECK_METRICS, CI_FETCH_FILE, serializeCiFetch, type CiFetch, CHECK_RULES, FOLDER_RULES, GOAL_RULE, MEASUREMENTS_FILE, REVIEWS_FILE, TEST_RESULTS_FILE, formatCheckGithub, formatCheckText, formatTrace, mergeMeasurements, parseCheckConfig, parseMeasurementStore, parseMetricsFile, parseReviewsFile, parseTestReport, parseTestResults, plainRuleText, adoptBaselines, existingCodeCheckConfig, ratchetConfig, reviewMeasurements, runCheck, serializeCheckConfig, serializeMeasurementStore, serializeTestResults, splitTestId, testsRanAt, traceOf, withBoundTests, withEarlierResults, type CheckConfig, type CiSource, type KeptCases, type Measurement, type RepositoryMapping, type TestCase } from '@radical/common/check'
import { MdFolderSession } from '@radical/common/formats/mdFolderSync'
import { DEPS_FILE } from '@radical/common/federation'
import { STATE_DIR, SELECTION_GITIGNORE_CONTENT } from '@radical/common/formats/canvasSelection'
import { diskFolderStorage } from '@radical/node-files/diskFolderStorage'
import { readEditorStateFile } from '@radical/node-files/selectionFile'
import { CATALOGUE_DIR, concernPacksOf, readCatalogue } from '@radical/hub-catalogue'
import { CiError, downloadCiReports, findCiRuns, ghCli, headOf, readLater, sameRuns, withFetchLock, type Gh } from './ciResults'
import { composeFolder, describeDeps, federationOthers } from './federation'
import { repositorySensors } from './repositorySensors'
import { REVIEWS_FILE as REPOSITORY_REVIEWS, mappingRoot, missingCodePaths, readRepositoryMapping } from '@radical/node-files/repositoryLayout'
import { modelFolderArg } from './modelFolder'
import { deserializeFromMdFolder } from '@radical/common/formats/mdFolder'
import { readModelAtCommit, resolveGitBase } from '@radical/node-files/gitModel'

export const CHECK_USAGE = `Usage: radical check [folder] [options]

Checks a Radical Markdown model folder: its files, its metamodel, and that it
is complete (requirements have scenarios, accepted ADRs fitness functions, …).
In a repository whose .radical/radical.json names a model in a repository of
its own ("model": { "repo": … }), it judges that repository's part of the model.

  folder              the model folder (default: the working directory)
  --config <file>     rule settings (default: check.json in the model folder,
                      when there is one)
  --format <format>   text (default), json, or github (annotations for Actions)
  --report <path>     a test report (Vitest or Jest JSON, Playwright JSON, JUnit
                      XML), or a directory of them (.json and .xml files); repeat
                      for more. The tests that scenarios and fitness functions
                      name are looked up in them. The test cases read are kept
                      in the model folder's .state/test-results.json for Studio
  --from-ci           read the test reports of CI instead: those of the latest
                      completed runs of the nearest commit in HEAD's history
                      that CI ran (a commit merged from a pull request stands
                      for the pull request's head), through the GitHub CLI
                      (gh, signed in). The artifacts read are check.json's
                      "ci": { "artifacts": [<name>, …] }, or every artifact of
                      the run. They are kept for Studio as --report keeps
                      them, with the commit and runs they come from, unless
                      the results there were read with --report at that
                      commit or a later one. The radical-metrics/1 files in
                      the artifacts (radical sense --out) are added to the
                      measurements, as --metrics adds them. What it found,
                      or why it found nothing, is kept in the folder's
                      .state/ci-fetch.json, with --quiet too, for Studio and
                      radical setup --status. CI has to keep the reports as
                      artifacts of the run. radical hooks install fetches
                      them after a checkout, a commit, a pull and a rebase
  --no-keep           read the reports and measurements given and judge with
                      them, but keep nothing beside the model: what Studio
                      shows stays as it was (a check used as a gate, a test
                      of the gate). --evidence, --ratchet and --adopt still
                      write the file they name
  --quiet             print nothing (the git hooks fetch with --from-ci --quiet)
  --detach            start this check in the background and return at once
                      (the git hooks, which git waits for)
  --metrics <path>    a radical-metrics/1 file (radical sense --out), or a
                      directory of them (.json files); repeat for more. They
                      are added to what radical sense keeps in the model
                      folder's .state/measurements.json, which is read
                      without --metrics too, and the metric conditions of
                      scenarios and fitness functions are evaluated against
                      the latest measurement each matches. The reviews
                      radical sense review keeps in the repository's
                      .radical/reviews.json (and a model folder's
                      reviews.json from before) are read as measurements too
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
                      do not run and keep their baselines). Where only this
                      repository's part of a model is judged, it lowers no
                      baseline of the model's check.json (exit 2): only one
                      --config names. With --alone or --trigger, which leave
                      part of the model out, it lowers none (exit 2)
  --adopt             take the baselines of this first run into check.json
                      once: each rule that finds something gets its count as
                      max, each measured metric its share as the goal, and
                      "adopt": true goes. Only for a check.json that waits for
                      them (radical setup and Assay write one for existing
                      code), or none (it writes one with every rule an error);
                      from then on only --ratchet lowers them. Give the test
                      reports and measurements too, or the rules that read
                      them get no baseline
  --alone             check without the models deps.json names; with a
                      deps.json the model is checked composed with them, at
                      their pinned refs (radical federation --help)
  --trace <id>        print every verification path through one element (a
                      need, requirement, scenario, ADR or fitness function):
                      from its need or ADR to the tests and metric conditions
                      that check it, each with its status and why a test
                      failed, instead of the check's findings. Without
                      --report or --from-ci it reads the test results kept
                      beside the model. With --format json, the paths as JSON.
                      With deps.json, also an element of a model it depends
                      on (a scenario of theirs this repository's tests check)
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
  /** Stops a command that runs until stopped. */
  signal?: AbortSignal
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
        'no-keep': { type: 'boolean', default: false },
        quiet: { type: 'boolean', default: false },
        detach: { type: 'boolean', default: false },
        metrics: { type: 'string', multiple: true },
        baseline: { type: 'string', multiple: true },
        trigger: { type: 'string' },
        evidence: { type: 'string' },
        trace: { type: 'string' },
        ratchet: { type: 'boolean', default: false },
        adopt: { type: 'boolean', default: false },
        alone: { type: 'boolean', default: false },
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
    for (const rule of [...FOLDER_RULES, ...CHECK_RULES, GOAL_RULE]) io.out(`${rule.id.padEnd(30)} ${((rule as { off?: true }).off ? 'off' : rule.severity).padEnd(8)} ${plainRuleText(rule.description)}`)
    io.out('\nMetrics for goals (in percent):')
    for (const metric of CHECK_METRICS) io.out(`${metric.id.padEnd(30)} ${(metric.tests ? 'evidence' : '').padEnd(8)} ${metric.description}`)
    return 0
  }
  const fromCi = values['from-ci']
  // Nothing kept beside the model: what Studio shows stays as it was.
  const keepBeside = !values['no-keep']
  if (positionals.length > 1 || !['text', 'json', 'github'].includes(values.format) || (fromCi && values.report?.length)
    || (values.evidence && !values.report?.length && !fromCi && !values.metrics?.length)
    || (values.trace !== undefined && (!values.trace.trim() || values.format === 'github' || values.ratchet || values.adopt))) {
    io.err(CHECK_USAGE)
    return 2
  }

  // A baseline is the whole model's: a check that leaves part of it out
  // (the models deps.json names, the conditions of other events) finds less.
  const partial = values.alone ? '--alone' : values.trigger !== undefined ? '--trigger' : null
  if (values.adopt && (values.ratchet || partial)) {
    io.err(`radical check --adopt: ${values.ratchet ? 'takes the first baselines; --ratchet lowers them later, not in the same run' : `with ${partial} the check leaves part of the model out, and a baseline counts the whole model`}.`)
    return 2
  }
  if (values.ratchet && partial) {
    io.err(`radical check --ratchet: with ${partial} the check leaves part of the model out (${partial === '--alone' ? 'the models deps.json names' : 'the metric conditions of other events'}), and a baseline counts the whole model. Ratchet with a check of all of it.`)
    return 2
  }

  if (values.detach) {
    if (!io.background) { io.err('radical check --detach: nothing here can start a command in the background.'); return 2 }
    io.background(['check', ...args.filter((a) => a !== '--detach')])
    return 0
  }

  const folder = await modelFolderArg(positionals[0], io.cwd)
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
    // A model without check.json adopts the gate for existing code.
    if (values.adopt) config = existingCodeCheckConfig()
  }

  // Where the repository builds the model's elements, and which of those
  // paths it does not have.
  let repository: RepositoryMapping | null
  // The folder the mapping's paths, and its tests' files, are from.
  let mappedFrom = root
  try {
    const mapping = await readRepositoryMapping(root)
    if (mapping) mappedFrom = mapping.root
    repository = mapping && {
      file: relative(io.cwd, mapping.file),
      ...(mapping.model ? { model: mapping.model } : {}),
      implements: mapping.implements.map((entry) => ({ ...entry, missing: entry.paths.filter((path) => !existsSync(resolve(mapping.root, path))) })),
      verifies: mapping.verifies,
      ...(mapping.tests ? { tests: mapping.tests } : {}),
      ...(mapping.ci ? { ci: mapping.ci } : {}),
    }
  } catch (error) {
    io.err(`Cannot read the repository's mapping: ${(error as Error).message}`)
    return 2
  }
  // The model's check.json holds the whole model's baselines: the part this
  // repository judges must not lower them (a config of its own may).
  if (values.ratchet && repository?.model && !relative(root, await realpath(dirname(configPath)).catch(() => dirname(configPath))).startsWith('..')) {
    io.err(`radical check --ratchet: ${configPath} holds the baselines of the whole model of ${repository.model.repo}, and this repository judges only its part of it. Ratchet in the model's repository, or name a config of this repository's own with --config.`)
    return 2
  }
  let tests: TestCase[] | undefined
  // Results that are not this run's: from CI, or kept from a later commit.
  let testsReadAt: string | undefined
  let keep: { reports: string[]; ci?: CiSource; commit?: string } | undefined
  // What a run of some test files leaves of the results kept before it.
  let keptCases: KeptCases | undefined
  // The measurements in CI's artifacts, added to those kept.
  let ciMeasurements: Measurement[] = []
  if (fromCi) {
    const say = (text: string) => { if (!values.quiet) io.err(text) }
    const existing = parseTestResults(await readEditorStateFile(root, TEST_RESULTS_FILE) ?? '')
    const gh = io.gh ?? ghCli(io.env ?? process.env)
    const head = (await headOf(root)) ?? undefined
    // What this fetch found, kept also when it found nothing: the git hooks
    // run it with their output closed.
    const record = async (fetch: Omit<CiFetch, 'version' | 'at' | 'head'>): Promise<void> => {
      if (keepBeside) await writeBeside(join(root, CI_FETCH_FILE), serializeCiFetch({ at: new Date().toISOString(), ...(head ? { head } : {}), ...fetch }))
    }
    let got
    try {
      got = await withFetchLock(root, async () => {
        // CI's artifacts: the repository's .radical/radical.json says, else check.json.
        const source = await findCiRuns(root, gh, repository?.ci?.artifacts ?? config.ci?.artifacts)
        if (await readLater(root, existing, source.commit)) return { source, kept: existing! }
        if (sameRuns(existing, source)) return { source: { ...source, measurements: existing!.ci!.measurements }, same: true, cases: existing!.cases, reports: existing!.reports, measurements: [] }
        const read = await downloadCiReports(root, gh, source)
        return { source: { ...source, measurements: read.measurements.length }, ...read }
      })
    } catch (error) {
      const message = error instanceof CiError ? error.message : (error as Error).message
      await record({ outcome: 'failed', message: `radical check --from-ci: ${message}` }).catch(() => {})
      say(`radical check --from-ci: ${message}`)
      return 2
    }
    if (!got) {
      say('radical check --from-ci: another fetch for this folder is running.')
      return 2
    }
    const { source } = got
    const runs = `run${source.runs.length > 1 ? 's' : ''} ${source.runs.map((r) => r.id).join(', ')}${source.runs[0]?.pr ? ` (pull request #${source.runs[0].pr})` : ''}`
    const from = { commit: source.commit, runs: source.runs.map((r) => ({ id: r.id, url: r.url })) }
    const behind = source.behind ? `, ${source.behind} commit${source.behind > 1 ? 's' : ''} before HEAD` : ''
    if (got.kept) {
      tests = got.kept.cases
      testsReadAt = got.kept.readAt
      const message = `Kept the test results read with --report at ${got.kept.commit!.slice(0, 7)}: CI's (${runs}) are of ${source.commit.slice(0, 7)}, before it.`
      await record({ outcome: 'kept', message, ...from })
      say(message)
    } else {
      ciMeasurements = got.measurements!
      const measured = ciMeasurements.length ? `; ${ciMeasurements.length} measurement${ciMeasurements.length === 1 ? '' : 's'}` : ''
      if (got.cases!.length) {
        tests = got.cases!
        testsReadAt = testsRanAt({ version: 1, readAt: new Date().toISOString(), reports: [], cases: [], ci: source })
        keep = { reports: got.reports!, ci: source, commit: head }
        const message = `${got.same ? 'The same test results of CI' : 'Test results of CI'} ${runs} for ${source.commit.slice(0, 7)}${behind}${measured}.`
        await record({ outcome: got.same ? 'same' : 'read', message, ...from, tests: tests.length, ...(got.same ? {} : { measurements: ciMeasurements.length }) })
        say(message)
      } else {
        // Measurements only: the test results kept stay as they were.
        const message = `The artifacts of CI ${runs} for ${source.commit.slice(0, 7)}${behind} hold no test report${measured}.`
        await record({ outcome: 'read', message, ...from, tests: 0, measurements: ciMeasurements.length })
        say(message)
      }
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
    // A run of some test files replaces their results and leaves what the
    // results kept beside the model say of the others: the tests it did not
    // run keep the outcome they had (CI, with nothing kept, reads only its
    // own reports).
    const merged = withEarlierResults(tests, parseTestResults(await readEditorStateFile(root, TEST_RESULTS_FILE) ?? ''))
    if (merged.kept) {
      tests = merged.cases
      keptCases = merged.kept
      if (!values.quiet) io.err(`Kept the results of ${merged.kept.cases} test${merged.kept.cases === 1 ? '' : 's'} in ${merged.kept.files} file${merged.kept.files === 1 ? '' : 's'} the reports here do not have, read since ${merged.kept.since.slice(0, 10)}.`)
    }
  }

  // A path asked for without reports: the results the last check kept.
  let fromKept = false
  if (values.trace && !tests) {
    const keptResults = parseTestResults(await readEditorStateFile(root, TEST_RESULTS_FILE) ?? '')
    if (keptResults) { tests = keptResults.cases; testsReadAt = testsRanAt(keptResults); fromKept = true }
  }

  // What radical sense kept, with the files --metrics names added.
  const kept = await readEditorStateFile(root, MEASUREMENTS_FILE)
  const stored = kept === null ? null : parseMeasurementStore(kept)
  let measurements: Measurement[] | undefined = stored ?? undefined
  const read: Measurement[] = [...ciMeasurements]
  if (values.metrics?.length) {
    try {
      for (const file of await reportFiles(values.metrics, io.cwd, /\.json$/i, 'measurement')) read.push(...parseMetricsFile(await readFile(resolve(io.cwd, file), 'utf8'), file))
    } catch (error) {
      io.err((error as NodeJS.ErrnoException).code === 'ENOENT' ? `Cannot read the measurements ${(error as NodeJS.ErrnoException).path}: no such file.` : (error as Error).message)
      return 2
    }
  }
  if (read.length) {
    measurements = mergeMeasurements(stored ?? [], read)
    if (keepBeside) await writeBeside(join(root, MEASUREMENTS_FILE), serializeMeasurementStore(measurements))
  }

  // The reviews of manual fitness functions, kept in git beside the model.
  // The reviews of manual fitness functions: the repository's
  // .radical/reviews.json, and the model folder's while it is not moved.
  for (const [where, path] of [[REPOSITORY_REVIEWS, join(await mappingRoot(root), REPOSITORY_REVIEWS)], [REVIEWS_FILE, join(root, REVIEWS_FILE)]]) {
    const reviewsText = await readFile(path, 'utf8').catch(() => null)
    if (reviewsText === null) continue
    try {
      measurements = [...(measurements ?? []), ...reviewMeasurements(parseReviewsFile(reviewsText))]
    } catch (error) {
      io.err(`Cannot read ${where}: ${(error as Error).message}`)
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

  // With deps.json: checked with the models it depends on, so its relations
  // to their elements hold, and one to an element none has is an error.
  let federation
  try {
    federation = values.alone ? null : await composeFolder(root)
  } catch (error) {
    io.err(`Cannot compose the federation of ${folder}: ${(error as Error).message}`)
    return 2
  }
  const others = federation ? federationOthers(files, federation.fetched) : undefined
  // The repository's own sensors, which a measure line may name too.
  let sensors
  try {
    const found = await repositorySensors(root)
    sensors = found ? { file: relative(io.cwd, found.file), names: Object.keys(found.sensors) } : null
  } catch (error) {
    io.err(`Cannot read the repository's sensors: ${(error as Error).message}`)
    return 2
  }
  // Code paths the model's descriptions name that the repository lacks.
  let missingPaths: Record<string, string[]> = {}
  try { missingPaths = await missingCodePaths(await mappingRoot(root), deserializeFromMdFolder(files).data.nodes) } catch { /* the folder's own rules say what is wrong */ }
  // The sources of the tests .radical/radical.json binds, for scenario-value-untested.
  const testSources = repository?.verifies?.length ? await boundTestSources(mappedFrom, repository.verifies) : undefined
  // The model at the base (where the branch left the default branch), for need-answer-changed.
  const baseNodes = await baseModelNodes(root)
  const checkOptions = { sensors, repository, missingPaths, ...(testSources ? { testSources } : {}), ...(baseNodes ? { baseNodes } : {}), ...(tests ? { tests } : {}), ...(testsReadAt ? { testsReadAt } : {}), ...(measurements ? { measurements } : {}), ...(baseline ? { baseline } : {}), ...(values.trigger ? { trigger: values.trigger } : {}), concerns: concernPacks(), ...(others ? { others } : {}) }
  let result = runCheck(files, config, checkOptions)
  if (values.adopt) {
    let adopted
    try { adopted = adoptBaselines(config, result) } catch (error) {
      io.err(`radical check --adopt: ${(error as Error).message}.`)
      return 2
    }
    await writeFile(configPath, serializeCheckConfig(adopted.config))
    result = runCheck(files, adopted.config, checkOptions)
    // To stderr: stdout may be the JSON result.
    if (!values.quiet) {
      io.err(`Adopted the first run's baselines into ${configPath}: ${adopted.baselines.length ? adopted.baselines.map((b) => `${b.id} max ${b.max}`).join(', ') : 'no rule found anything'}; goals ${adopted.goals.length ? adopted.goals.map((g) => `${g.id} ${g.min}%`).join(', ') : 'none measured'}. From now on only --ratchet lowers them. Commit it.`)
      if (adopted.notRun.length) io.err(`Not run, so no baseline taken (give the test reports with --report, the measurements with --metrics): ${adopted.notRun.join(', ')}.`)
    }
  }
  if (tests && keepBeside && !fromKept && (keep || !fromCi)) {
    // For Studio, which works out from them what the tests say about the
    // model while it is edited; with the commit they were read at, so
    // results of CI never replace those of a later one.
    await writeBeside(join(root, TEST_RESULTS_FILE), serializeTestResults(tests, keep?.reports ?? values.report ?? [], new Date(),
      keep ?? { commit: (await headOf(root)) ?? undefined, ...(keptCases ? { kept: keptCases } : {}) }))
  }
  if (values.evidence && result.evidence) await writeBeside(resolve(io.cwd, values.evidence), JSON.stringify(result.evidence, null, 2) + '\n')
  if (values.trace) {
    // With the models it depends on: a path may go through their elements
    // (a scenario of theirs this repository's tests check).
    const own = deserializeFromMdFolder(files).data
    const nodes = [...own.nodes, ...others?.nodes ?? []]
    const relations = [...own.relations, ...others?.relations ?? []]
    // With the tests the repository binds, listed before any results too.
    const byId = Object.fromEntries(withBoundTests(nodes, repository?.verifies).map((n) => [n.id, n]))
    if (!byId[values.trace]) { io.err(`radical check --trace: no element ${values.trace} in ${folder}${others?.nodes.length ? ' or the models it depends on' : ''}.`); return 2 }
    const trace = traceOf({ nodes: byId, relations: Object.fromEntries(relations.map((r) => [r.id, r])), evidence: result.evidence, cases: tests }, values.trace)
    if (!values.quiet) io.out(values.format === 'json' ? JSON.stringify(trace, null, 2) : formatTrace(trace, byId))
    return 0
  }
  const options = { folder, verbose: values.verbose }
  if (repository?.model && values.format !== 'json' && !values.quiet) io.out(`Judged this repository's part of the model of ${repository.model.repo}.`)
  if (federation && values.format !== 'json' && !values.quiet) {
    io.out(`Checked with ${describeDeps(federation.fetched) || 'no other model'} (${DEPS_FILE}).`)
    for (const note of federation.notes) io.out(`Note: ${note}`)
  }
  const json = federation
    ? { ...result, federation: federation.fetched.map(({ name, ref, commit, via }) => ({ name, ref, commit, ...(via ? { via } : {}) })), ...(federation.notes.length ? { federationNotes: federation.notes } : {}) }
    : result
  if (!values.quiet) io.out(values.format === 'json' ? JSON.stringify(json, null, 2)
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
  if (basename(dir) === STATE_DIR) {
    await writeFile(join(dir, '.gitignore'), SELECTION_GITIGNORE_CONTENT, { flag: 'wx' }).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'EEXIST') throw error
    })
  }
  // Whole or not at all: Studio reads these files while they are written.
  const partial = join(dir, `.${basename(path)}.${process.pid}.tmp`)
  await writeFile(partial, content)
  await rename(partial, path)
}

/** The Hub's concern packs, for concern-unaddressed: from the copy the build
 *  puts beside the bundle (tsup.config.ts), or from source where
 *  @radical/hub-catalogue keeps them. */
function concernPacks() {
  const bundled = join(dirname(fileURLToPath(import.meta.url)), 'hub-catalogue')
  return concernPacksOf(readCatalogue(existsSync(bundled) ? bundled : CATALOGUE_DIR))
}

/** By bound test id, the file of the test (fixtures sit beside the test, not
 *  in it); tests whose file the repository lacks are left out. */
async function boundTestSources(root: string, verifies: Array<{ tests: string[] }>): Promise<Record<string, string>> {
  const files = new Map<string, string | null>()
  const sources: Record<string, string> = {}
  for (const id of new Set(verifies.flatMap((v) => v.tests))) {
    const { file } = splitTestId(id)
    if (!files.has(file)) {
      const path = resolve(root, file)
      files.set(file, path.startsWith(resolve(root)) && existsSync(path) && (await stat(path)).isFile() ? await readFile(path, 'utf8') : null)
    }
    const text = files.get(file)
    if (text != null) sources[id] = text
  }
  return sources
}

/** The model's elements at its git base (the merge base with the default
 *  branch); undefined out of git, or when the folder held no model then. */
async function baseModelNodes(folder: string): Promise<ReturnType<typeof deserializeFromMdFolder>['data']['nodes'] | undefined> {
  try {
    const files = await readModelAtCommit(folder, (await resolveGitBase(folder)).commit)
    return Object.keys(files).length ? deserializeFromMdFolder(files).data.nodes : undefined
  } catch {
    return undefined
  }
}
