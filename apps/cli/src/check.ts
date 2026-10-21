import { mkdir, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { CHECK_CONFIG_FILE, CHECK_METRICS, CHECK_RULES, FOLDER_RULES, GOAL_RULE, TEST_RESULTS_FILE, formatCheckGithub, formatCheckText, parseCheckConfig, parseTestReport, ratchetConfig, runCheck, serializeTestResults, type CheckConfig, type TestCase } from '@radical/common/check'
import { MdFolderSession } from '@radical/common/formats/mdFolderSync'
import { SELECTION_DIR, SELECTION_GITIGNORE_CONTENT } from '@radical/common/formats/canvasSelection'
import { diskFolderStorage } from '@radical/node-files/diskFolderStorage'

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
  --evidence <file>   with --report: write what the reports say about each
                      scenario, fitness function, requirement and ADR as JSON
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
    for (const metric of CHECK_METRICS) io.out(`${metric.id.padEnd(30)} ${(metric.tests ? 'reports' : '').padEnd(8)} ${metric.description}`)
    return 0
  }
  if (positionals.length > 1 || !['text', 'json', 'github'].includes(values.format) || (values.evidence && !values.report?.length)) {
    io.err(CHECK_USAGE)
    return 2
  }

  const folder = positionals[0] ?? '.'
  let root: string
  let files
  try {
    root = await realpath(resolve(io.cwd, folder))
    if (!(await stat(root)).isDirectory()) throw new Error('not a directory')
    files = await new MdFolderSession(diskFolderStorage(root)).readAll()
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
  if (values.report?.length) {
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

  const result = runCheck(files, config, tests ? { tests } : {})
  if (tests) {
    // For Studio, which works out from them what the tests say about the
    // model while it is edited.
    await writeBeside(join(root, TEST_RESULTS_FILE), serializeTestResults(tests, values.report ?? []))
  }
  if (values.evidence && result.evidence) await writeBeside(resolve(io.cwd, values.evidence), JSON.stringify(result.evidence, null, 2) + '\n')
  const options = { folder, verbose: values.verbose }
  io.out(values.format === 'json' ? JSON.stringify(result, null, 2)
    : values.format === 'github' ? formatCheckGithub(result, options)
      : formatCheckText(result, options))

  if (values.ratchet) {
    const { config: next, lowered } = ratchetConfig(config, result)
    if (lowered.length) {
      await writeFile(configPath, JSON.stringify(next, null, 2) + '\n')
      // To stderr: stdout may be the JSON result.
      io.err(`Ratchet: ${lowered.map((l) => `${l.id} ${l.from} → ${l.to}`).join(', ')} (written to ${configPath}).`)
    }
  }
  return result.ok ? 0 : 1
}

/** The report files `paths` name: a file as it is, a directory's .json and
 *  .xml files. A path that is not there is passed on, and fails to read; a
 *  directory with no report in it throws. */
async function reportFiles(paths: string[], cwd: string): Promise<string[]> {
  const files: string[] = []
  for (const path of paths) {
    const isDir = await stat(resolve(cwd, path)).then((s) => s.isDirectory(), () => false)
    if (!isDir) { files.push(path); continue }
    const names = (await readdir(resolve(cwd, path))).filter((name) => /\.(json|xml)$/i.test(name)).sort()
    if (!names.length) throw new Error(`The report directory ${path} holds no .json or .xml report.`)
    files.push(...names.map((name) => join(path, name)))
  }
  return files
}

/** Writes a file beside the model, making its directory. In a model
 *  folder's .radical directory, Studio's place for what is not the model, it
 *  also writes the .gitignore that keeps that directory out of version control. */
async function writeBeside(path: string, content: string): Promise<void> {
  const dir = dirname(path)
  await mkdir(dir, { recursive: true })
  if (basename(dir) === SELECTION_DIR) {
    await writeFile(join(dir, '.gitignore'), SELECTION_GITIGNORE_CONTENT, { flag: 'wx' }).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'EEXIST') throw error
    })
  }
  await writeFile(path, content)
}
