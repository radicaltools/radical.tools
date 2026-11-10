// ─── Radical Assay: the tests a database's code declares ─────────────────────
//
// A database's tests are seldom run where Assay reads them, so a test its code
// declares is a fact, not run until a report says otherwise (ADR Database tests
// declared in code are facts not run): a utPLSQL --%test procedure of a --%suite
// package, a pgTAP assertion of a test script, a pgTAP test function runtests()
// runs. Their ids are their files and titles, as their runners name them:
// utPLSQL's suite, contexts and test, each by its description or else its name;
// a pgTAP assertion by its description, else #n, its number in the script as
// TAP counts it; a test function by its name.

import type { RoutineFact, TableFact, TestFact, TestFramework, Unit } from './facts'
import { RepoFiles, owner } from './files'

/** A database test as its code declares it, before it has a unit. */
interface Declared { file: string; titles: string[]; line: number; skipped: boolean; framework: TestFramework }

const SQL_FILE = /\.(sql|pks|pkb|pkg|pck|spc|pls|plb|pg|pgsql)$/i

/** The tests of utPLSQL suites a file declares: a package spec annotated --%suite, its --%context blocks and --%test procedures. */
export function utplsqlTests(text: string, file: string): Declared[] {
  const out: Declared[] = []
  // (A suite a body builds in a string, execute immediate q'[create package … --%suite …]', is no suite of the file's.)
  const lines = stringsBlanked(text).split('\n')
  let suite: { titles: string[]; skipped: boolean } | undefined
  const contexts: Array<{ title: string; skipped: boolean }> = []
  let pending: string[] = []
  let packageName: string | undefined
  let unnamed = 0
  const argOf = (annotation: string, line: string): string | undefined => new RegExp(`--\\s*%${annotation}\\s*\\((.*)\\)\\s*$`, 'i').exec(line)?.[1].trim()
  lines.forEach((line, i) => {
    const spec = /^\s*create\s+(?:or\s+replace\s+)?(?:(?:non)?editionable\s+)?package\s+(?!body\b)(?:"?\w+"?\.)?"?(\w+)"?/i.exec(line)
    if (spec) { packageName = spec[1].toLowerCase(); suite = undefined; contexts.length = 0; pending = []; unnamed = 0; return }
    if (/^\s*end\b[^;]*;/i.test(line) && !/^\s*end\s+(if|loop|case)\b/i.test(line)) { packageName = undefined; suite = undefined; return }
    if (!packageName) return
    const annotation = /^\s*--\s*%(\w+)/.exec(line)?.[1].toLowerCase()
    if (annotation === 'suite') { suite = { titles: [argOf('suite', line) || packageName], skipped: false }; pending = []; return }
    if (!suite) return
    // (--%displayname names the suite, a context or a test, as older suites do: -- %test with -- %displayname(…).)
    if (annotation === 'displayname' && !pending.some((p) => /--\s*%test\b/i.test(p))) {
      const name = argOf('displayname', line)
      // (A context's own --%context(name) comes first: --%displayname only names one that has none.)
      if (name) { if (!contexts.length) suite.titles = [name]; else if (/^context_\d+$/.test(contexts[contexts.length - 1].title)) contexts[contexts.length - 1].title = name }
      return
    }
    if (annotation === 'context') {
      unnamed++
      contexts.push({ title: argOf('context', line) || `context_${unnamed}`, skipped: false })
      pending = []
      return
    }
    if (annotation === 'name' && contexts.length && !argOf('context', line)) {
      const name = argOf('name', line)
      const top = contexts[contexts.length - 1]
      if (name && /^context_\d+$/.test(top.title)) top.title = name
      return
    }
    if (annotation === 'endcontext') { contexts.pop(); pending = []; return }
    if (annotation) { pending.push(line); return }
    // A blank line between annotations and what follows them ends a package's own annotations (--%disabled of the suite).
    if (!line.trim()) {
      if (pending.some((p) => /--\s*%disabled\b/i.test(p)) && !pending.some((p) => /--\s*%test\b/i.test(p))) {
        if (contexts.length) contexts[contexts.length - 1].skipped = true
        else suite.skipped = true
      }
      if (!pending.some((p) => /--\s*%test\b/i.test(p))) pending = []
      return
    }
    const proc = /^\s*procedure\s+"?(\w+)"?/i.exec(line)
    if (proc) {
      const test = pending.find((p) => /--\s*%test\b/i.test(p))
      if (test) {
        out.push({
          file,
          titles: [...suite.titles, ...contexts.map((c) => c.title), argOf('test', test) || pending.map((p) => argOf('displayname', p)).find((x) => !!x) || proc[1].toLowerCase()],
          line: lines.slice(0, i + 1).lastIndexOf(test) + 1,
          skipped: suite.skipped || contexts.some((c) => c.skipped) || pending.some((p) => /--\s*%disabled\b/i.test(p)),
          framework: 'utplsql',
        })
      }
      pending = []
    }
  })
  return out
}

/** SQL with its strings' text blanked ('…', Oracle's q'[…]'), its comments and lines kept: annotations stay, a
 *  package a string holds goes. */
function stringsBlanked(sql: string): string {
  let out = ''
  let i = 0
  const blank = (t: string): string => t.replace(/[^\n]/g, ' ')
  while (i < sql.length) {
    if (sql.startsWith('--', i)) { const end = sql.indexOf('\n', i); const to = end < 0 ? sql.length : end; out += sql.slice(i, to); i = to; continue }
    if (sql.startsWith('/*', i)) { const end = sql.indexOf('*/', i + 2); const to = end < 0 ? sql.length : end + 2; out += sql.slice(i, to); i = to; continue }
    const q = /^[qQ]'(.)/.exec(sql.slice(i, i + 3))
    if (q) {
      const close = ({ '[': ']', '{': '}', '(': ')', '<': '>' } as Record<string, string>)[q[1]] ?? q[1]
      const end = sql.indexOf(`${close}'`, i + 3)
      const to = end < 0 ? sql.length : end + 2
      out += `q'${blank(sql.slice(i + 2, to - 1))}'`; i = to; continue
    }
    if (sql[i] === "'") {
      let j = i + 1
      while (j < sql.length && !(sql[j] === "'" && sql[j + 1] !== "'")) j += sql[j] === "'" ? 2 : 1
      out += `'${blank(sql.slice(i + 1, j))}'`; i = j + 1; continue
    }
    out += sql[i]; i++
  }
  return out
}

/** pgTAP's functions that report a test, and how many arguments each takes before its optional description. */
const REQUIRED: Record<string, number> = {
  ok: 1, is: 2, isnt: 2, matches: 2, imatches: 2, doesnt_match: 2, doesnt_imatch: 2, alike: 2, ialike: 2, unalike: 2, unialike: 2,
  cmp_ok: 3, pass: 0, fail: 0, isa_ok: 2, throws_like: 2, throws_ilike: 2, throws_matching: 2, throws_imatching: 2, lives_ok: 1,
  performs_ok: 2, performs_within: 3, results_eq: 2, results_ne: 2, set_eq: 2, set_ne: 2, set_has: 2, set_hasnt: 2, bag_eq: 2, bag_ne: 2,
  bag_has: 2, bag_hasnt: 2, is_empty: 1, isnt_empty: 1, row_eq: 2, skip: 0,
}
const STRUCTURE = /^(has|hasnt)_\w+$|^col_\w+$|^\w+_are$|^(is|isnt)_\w+$|^\w+_(owner|privs)_is$|^function_(lang_is|returns)$|^(fk_ok|index_is_type|index_is_unique|index_is_primary|trigger_is|domain_type_is|domain_type_isnt|cast_context_is|language_is_trusted|policy_cmd_is|enum_has_labels|rule_is_instead|rule_is_on|volatility_is|throws_ok)$/
/** Structure tests whose shortest form ends with a value they check, by that form's number of arguments. */
const VALUE_LAST: Record<string, number> = { col_default_is: 3, col_type_is: 3 }
/** pgTAP's functions that report nothing: the plan, diagnostics, the TODO markers. */
const NO_TEST = /^(plan|no_plan|finish|diag|note|todo|todo_start|todo_end|in_todo|runtests|do_tap|explain)$/

/** The top-level arguments of a call whose text starts after its opening parenthesis: their texts, and where the call ends. */
function argumentsOf(text: string, from: number): { args: string[]; end: number } {
  const args: string[] = []
  let depth = 0
  let start = from
  let i = from
  while (i < text.length) {
    const c = text[i]
    if (c === "'") { i++; while (i < text.length && !(text[i] === "'" && text[i + 1] !== "'")) i += text[i] === "'" ? 2 : 1; i++; continue }
    if (c === '$') {
      const tag = /^\$\w*\$/.exec(text.slice(i))?.[0]
      if (tag) { const close = text.indexOf(tag, i + tag.length); i = close < 0 ? text.length : close + tag.length; continue }
    }
    if (c === '(' || c === '[') depth++
    else if (c === ')' || c === ']') {
      if (depth === 0) { args.push(text.slice(start, i).trim()); return { args: args.filter((a, k) => a || k > 0), end: i } }
      depth--
    } else if (c === ',' && depth === 0) { args.push(text.slice(start, i).trim()); start = i + 1 }
    i++
  }
  return { args, end: text.length }
}

/** A string literal's text: 'it''s', E'…', $$…$$; undefined for anything else. */
function literal(arg: string): string | undefined {
  const quoted = /^([Ee]?)'((?:[^']|'')*)'(?:\s*::\s*\w+)?$/s.exec(arg)
  // (E'…' takes backslash escapes: E'fo\\no' is fo\no.)
  if (quoted) return quoted[1] ? quoted[2].replace(/''/g, "'").replace(/\\(.)/g, (_, c: string) => ({ n: '\n', t: '\t', r: '\r' } as Record<string, string>)[c] ?? c) : quoted[2].replace(/''/g, "'")
  const dollar = /^(\$\w*\$)([\s\S]*)\1$/.exec(arg)
  return dollar?.[2]
}

/** A type's name, which a structure test takes and no description is (col_type_is(t, c, 'timestamp with time zone')). */
const TYPE_NAME = /^(setof\s+\w+|timestamp\s+with(out)?\s+time\s+zone|time\s+with(out)?\s+time\s+zone|double\s+precision|character\s+varying(\(\d+\))?|bit\s+varying(\(\d+\))?|\w+(\s*\[\])+)$/i

/** The description pgTAP's `fn` reports for these arguments, when its call gives one: a literal's text, or the text of an
 *  expression that builds it ('User "pgxn" should have EXECUTE priv on ' || f). */
function descriptionOf(fn: string, args: string[]): string | undefined {
  const arg = args.length ? args[args.length - 1] : undefined
  const built = arg !== undefined && /\|\|/.test(arg) && /'[^']*\s[^']*'/.test(arg) ? arg.replace(/\s+/g, ' ') : undefined
  const last = arg !== undefined ? literal(arg) ?? built : undefined
  if (last === undefined || TYPE_NAME.test(last.trim())) return undefined
  if (fn === 'throws_ok') {
    // throws_ok(sql, errcode, errmsg[, description]) or throws_ok(sql, errmsg[, description]).
    if (args.length >= 4) return last
    if (args.length === 3) return /^'?[0-9A-Z]{5}'?$|^-?\d+$/.test(args[1].replace(/::\w+$/, '').trim()) ? undefined : last
    return undefined
  }
  if (fn in REQUIRED) return args.length > REQUIRED[fn] ? last : undefined
  // A structure test whose last argument may be a value it checks: col_default_is(table, column, default).
  if (fn in VALUE_LAST && args.length <= VALUE_LAST[fn]) return undefined
  // A structure test's names are words; its description is a sentence.
  return /\s/.test(last) ? last : undefined
}

/** Whether `fn` is one of pgTAP's tests. */
// (PostgreSQL's own has_table_privilege() and its kind are no tests.)
const isAssertion = (fn: string): boolean => !NO_TEST.test(fn) && !/_privilege$/.test(fn) && (fn in REQUIRED || STRUCTURE.test(fn))

/** SQL without its comments (a line's after --, a block's), its strings ('…', $tag$…$tag$) and lines kept. */
function withoutComments(sql: string): string {
  let out = ''
  let i = 0
  while (i < sql.length) {
    const c = sql[i]
    if (c === "'") {
      let j = i + 1
      while (j < sql.length && !(sql[j] === "'" && sql[j + 1] !== "'")) j += sql[j] === "'" ? 2 : 1
      out += sql.slice(i, j + 1); i = j + 1; continue
    }
    const tag = c === '$' ? /^\$\w*\$/.exec(sql.slice(i, i + 64))?.[0] : undefined
    if (tag) {
      const close = sql.indexOf(tag, i + tag.length)
      const end = close < 0 ? sql.length : close + tag.length
      out += sql.slice(i, end); i = end; continue
    }
    const comment = sql.startsWith('--', i) ? sql.indexOf('\n', i) : sql.startsWith('/*', i) ? sql.indexOf('*/', i) + 2 : -2
    if (comment !== -2) {
      const end = comment < 0 || comment === 1 ? sql.length : comment
      out += sql.slice(i, end).replace(/[^\n]/g, ' '); i = end; continue
    }
    out += c; i++
  }
  return out
}

/** The tests of a pgTAP file: its test functions (test…() returning SETOF TEXT, which runtests() runs), else each
 *  assertion its statements make, numbered as TAP counts them. */
export function pgtapTests(text: string, file: string): Declared[] {
  const lineAt = (i: number): number => text.slice(0, i).split('\n').length
  const out: Declared[] = []
  // (Comments read as nothing; a string keeps its text, -- in it too.)
  const code = withoutComments(text)
  const functions = [...code.matchAll(/\bcreate\s+(?:or\s+replace\s+)?function\s+(?:"?\w+"?\.)?"?(test\w*)"?\s*\([^)]*\)\s*returns\s+setof\s+text\b/gi)]
  for (const f of functions) out.push({ file, titles: [f[1]], line: lineAt(f.index!), skipped: false, framework: 'pgtap' })
  // The bodies of functions hold no test of the script's own.
  const bodies: Array<[number, number]> = []
  for (const m of code.matchAll(/\bas\s+(\$\w*\$)/gi)) {
    const close = code.indexOf(m[1], m.index! + m[0].length)
    bodies.push([m.index!, close < 0 ? code.length : close])
  }
  let n = 0
  for (const m of code.matchAll(/\b(?:select\s+(?:\*\s+from\s+)?|return\s+next\s+)(\w+)\s*\(/gi)) {
    const fn = m[1].toLowerCase()
    if (!isAssertion(fn) || bodies.some(([a, b]) => m.index! > a && m.index! < b)) continue
    const { args } = argumentsOf(code, m.index! + m[0].length)
    n++
    // (skip('why') reports a test skipped, its reason the title: a pending test's.)
    const why = fn === 'skip' ? args.map(literal).find((a) => a !== undefined && !/^\d+$/.test(a)) : undefined
    out.push({ file, titles: [why ?? descriptionOf(fn, args) ?? `#${n}`], line: lineAt(m.index!), skipped: fn === 'skip', framework: 'pgtap' })
  }
  return out
}

/** Whether a SQL file is a pgTAP test: it makes pgTAP's assertions and plans them, finishes, or runs test functions. */
const PGTAP = /\b(select\s+(\*\s+from\s+)?(plan|no_plan|finish|runtests)\s*\(|function\s+(?:"?\w+"?\.)?"?test\w*"?\s*\([^)]*\)\s*returns\s+setof\s+text\b)/i

/** A repository's database test code: the files of its pgTAP tests, and the packages utPLSQL's suites are, whose bodies
 *  test the code rather than being it. */
export function databaseTestCode(files: RepoFiles): { files: Set<string>; packages: Set<string> } {
  const out = { files: new Set<string>(), packages: new Set<string>() }
  for (const file of files.list.filter((f) => SQL_FILE.test(f))) {
    const text = files.read(file)
    // (A script may create the code and its suite together: only the suite's package is test code.)
    if (/--\s*%suite\b/i.test(text)) {
      for (const m of stringsBlanked(text).matchAll(/^\s*create\s+(?:or\s+replace\s+)?(?:(?:non)?editionable\s+)?package\s+(?!body\b)(?:"?\w+"?\.)?"?(\w+)"?[\s\S]*?(?=^\s*create\s|$(?![\s\S]))/gim)) {
        if (/--\s*%suite\b/i.test(m[0])) out.packages.add(m[1].toLowerCase())
      }
    } else if (PGTAP.test(text) && !/\bcreate\s+(?:or\s+replace\s+)?function\s+(?:\w+\.)?plan\s*\(/i.test(text)) out.files.add(file)
  }
  return out
}

/** The tests a repository's database code declares, each in the unit whose folder holds it, else the unit whose stored
 *  routines or tables it names the most; and the test framework of each unit they are in. */
export function readDatabaseTests(files: RepoFiles, repo: string, units: Unit[], routines: RoutineFact[], tables: TableFact[]): { tests: TestFact[]; frameworks: Map<string, TestFramework> } {
  const declared: Declared[] = []
  for (const file of files.list.filter((f) => SQL_FILE.test(f))) {
    const text = files.read(file)
    // (pgTAP's own install defines plan(); it is no test.)
    if (/--\s*%suite\b/i.test(text)) declared.push(...utplsqlTests(text, file))
    else if (PGTAP.test(text) && !/\bcreate\s+(?:or\s+replace\s+)?function\s+(?:\w+\.)?plan\s*\(/i.test(text)) declared.push(...pgtapTests(text, file))
  }
  const tests: TestFact[] = []
  const frameworks = new Map<string, TestFramework>()
  const sqlUnits = units.filter((u) => u.stack === 'sql')
  for (const d of declared) {
    let unit = owner(units, d.file)
    if (!unit || unit.kind === 'tests') {
      // The unit whose routines and tables its file names the most.
      const text = files.read(d.file).toLowerCase()
      const score = (u: Unit): number => routines.filter((r) => r.unit === u.id && text.includes(r.name.split('.')[0])).length
        + tables.filter((t) => t.unit === u.id && text.includes(t.table.toLowerCase())).length
      // (A database's units first: a database test is no test of an application's code.)
      const candidates = sqlUnits.length ? sqlUnits : units
      const best = [...candidates].sort((a, b) => score(b) - score(a))[0]
      // With nothing named (a view it tests), the database unit nearest it, else the one holding the most routines.
      const shared = (u: Unit): number => { const a = d.file.split('/'); const b = u.path.split('/'); let n = 0; while (n < b.length && a[n] === b[n]) n++; return n }
      const routinesOf = (u: Unit): number => routines.filter((r) => r.unit === u.id).length
      const nearest = [...sqlUnits].sort((a, b) => shared(b) - shared(a) || routinesOf(b) - routinesOf(a))[0]
      unit = best && score(best) > 0 ? best : nearest ?? unit
    }
    const test = `${d.file} › ${d.titles.join(' › ')}`
    const id = `${repo}:test:${test}`
    if (tests.some((t) => t.id === id)) continue
    tests.push({ id, ...(unit ? { unit: unit.id } : {}), test, status: d.skipped ? 'skipped' : 'not run', evidence: { file: d.file, line: d.line } })
    if (unit && !frameworks.has(unit.id)) frameworks.set(unit.id, d.framework)
  }
  return { tests, frameworks }
}
