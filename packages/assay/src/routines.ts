// ─── Radical Assay: the stored routines a database's scripts create ─────────
//
// Procedures, functions, packages and triggers are code that runs inside the
// database: a legacy system's business rules often live there. Each script's
// CREATE statements are read in the dialect they are written in: Oracle's
// PL/SQL (a package's spec and body, each member as package.member, a
// trigger on its table; scripts of .sql, .pks, .pkb, .prc, .fnc, .trg, …),
// SQL Server's T-SQL (CREATE PROC, up to GO), PostgreSQL's functions (the
// body between $$ and a trigger EXECUTE FUNCTION names) and MySQL's (between
// DELIMITER changes). Each routine's body says which tables it reads and
// writes and which routines it calls; domain.ts keeps those the repository
// declares.

import type { RoutineCallFact, RoutineFact, Unit } from './facts'
import { withoutVbComments } from './code'
import { GENERATED, RepoFiles, TEST_FILE, lineAt, owner, shownOnly, withoutComments } from './files'

export type ReadRoutine = Omit<RoutineFact, 'id' | 'unit'>

/** A script's comments and strings blanked in one pass, its lines kept: a string may hold "--" or run over several lines,
 *  and Oracle's q'[…]' may hold quotes. A string keeps its quotes. */
export const withoutSqlCommentsOrStrings = (sql: string): string =>
  sql.replace(/\b[qQ]'(?:\[[\s\S]*?\]|\{[\s\S]*?\}|\([\s\S]*?\)|<[\s\S]*?>|([^\s'])[\s\S]*?\1)'|'(?:[^']|'')*'|--[^\n]*|\/\*[\s\S]*?\*\/|(?<=^|[ \t,(])#[^\n'"]*$/gm, (m) =>
    m.startsWith("'") || /^[qQ]'/.test(m) ? `'${m.slice(1, -1).replace(/[^\n]/g, ' ')}'` : m.replace(/[^\n]/g, ' '))

/** A database object's name as written: quoted or bracketed, with a schema or database before it. */
const NAME = String.raw`(?:[\`"[]?\w+[\`"\]]?\s*\.\s*)?[\`"[]?([A-Za-z_][\w$#]*)[\`"\]]?`
const bare = (name: string): string => name.replace(/[`"[\]]/g, '').split('.').pop()!.toLowerCase()

/** The dialect a script is written in, from what only that dialect writes. */
export function dialectOf(sql: string): string | undefined {
  if (/\bcreate\s+(?:or\s+replace\s+)?(?:(?:non)?editionable\s+)?package\b|\bvarchar2\b|\bnumber\s*\(\s*\d|\bpls_integer\b|\bsysdate\b|^\s*\/\s*$|\bnvl\s*\(/im.test(sql)) return 'Oracle'
  if (/^\s*GO\s*$|\bnvarchar\b|\[dbo\]|\bIDENTITY\s*\(|\bcreate\s+(?:or\s+alter\s+)?proc\b/im.test(sql)) return 'SQL Server'
  // (MySQL's DELIMITER $$ before PostgreSQL's $$.)
  if (/^\s*DELIMITER\s+\S+|`|\bENGINE\s*=|\bAUTO_INCREMENT\b/im.test(sql)) return 'MySQL'
  if (/\blanguage\s+'?plpgsql'?|\$\w*\$|\bSERIAL\b|::\w/i.test(sql)) return 'PostgreSQL'
  return undefined
}

/** A component's script, its markup blanked (lines kept); with `expressions`, Svelte's {…} in the markup kept too. */
function scriptOf(component: string, expressions: boolean): string {
  return component.replace(/<script\b[^>]*>[\s\S]*?<\/script>|[^<]+|</g, (m) => {
    if (m.startsWith('<script')) return m
    if (!expressions) return m.replace(/[^\n]/g, ' ')
    let depth = 0
    let out = ''
    for (const c of m) {
      if (c === '{') depth++
      out += depth > 0 || c === '\n' ? c : ' '
      if (c === '}' && depth > 0) depth--
    }
    return out
  })
}

/** What a routine's body touches: tables written (INSERT, UPDATE, DELETE, MERGE), tables read (FROM, JOIN), and names
 *  called (a call with parentheses or an EXEC, CALL or PERFORM), each lower-case and without its schema. */
export function bodyUses(body: string): { reads: string[]; writes: string[]; calls: string[] } {
  const writes = new Set<string>()
  const reads = new Set<string>()
  const calls = new Set<string>()
  for (const m of body.matchAll(new RegExp(String.raw`\b(?:insert\s+(?:all\s+)?into|update|delete\s+from|delete|merge\s+into)\s+${NAME}`, 'gi'))) writes.add(bare(m[1]))
  for (const m of body.matchAll(new RegExp(String.raw`\b(?:from|join)\s+${NAME}`, 'gi'))) {
    const before = body.slice(Math.max(0, m.index! - 8), m.index!)
    if (!/delete\s*$/i.test(before)) reads.add(bare(m[1]))
  }
  for (const m of body.matchAll(/\b(?:exec(?:ute)?|call|perform)\s+(?:[`"[]?\w+[`"\]]?\s*\.\s*)?([`"[]?[A-Za-z_][\w$#]*[`"\]]?(?:\s*\.\s*[A-Za-z_][\w$#]*)?)/gi)) calls.add(m[1].replace(/[`"[\]\s]/g, '').toLowerCase())
  for (const m of body.matchAll(/\b([A-Za-z_][\w$#]*(?:\.[A-Za-z_][\w$#]*)?)\s*\(/g)) calls.add(m[1].toLowerCase())
  // (PL/SQL calls a procedure without parentheses too, as a statement of its own: add_page;)
  for (const m of body.matchAll(/^\s*([A-Za-z_][\w$#]*(?:\.[A-Za-z_][\w$#]*)?)\s*;/gm)) calls.add(m[1].toLowerCase())
  for (const t of ['dual']) reads.delete(t)
  return { reads: [...reads], writes: [...writes], calls: [...calls] }
}

/** A package's members: the procedures and functions at its top level, the ones declared inside a member left out.
 *  Blocks open at a subprogram's IS or AS, at DECLARE, at a BEGIN of no subprogram's, and at CASE; END closes one,
 *  END IF and END LOOP none. */
function packageMembers(body: string): Array<{ index: number; kind: string; name: string }> {
  const members: Array<{ index: number; kind: string; name: string }> = []
  const stack: Array<{ begun: boolean }> = []
  let header: { index: number; kind: string; name: string; depth: number } | undefined
  // (The word after a PROCEDURE, a FUNCTION or an END is its name, or END's IF, LOOP or CASE.)
  const tokens = [...body.matchAll(/\b(?:(procedure|function|end)\b(?:\s+(?!end\b)([A-Za-z_][\w$#]*))?|(is|as|begin|declare|case)\b)|;/gi)]
  for (const t of tokens) {
    const word = (t[1] ?? t[3] ?? ';').toLowerCase()
    if (word === 'procedure' || word === 'function') { if (!header && t[2]) header = { index: t.index!, kind: word, name: t[2].toLowerCase(), depth: stack.length } }
    else if (word === 'is' || word === 'as' || word === ';') {
      if (!header) continue
      if (header.depth === 0) members.push(header)
      if (word !== ';') stack.push({ begun: false })
      header = undefined
    } else if (word === 'begin') {
      const top = stack[stack.length - 1]
      if (top && !top.begun) top.begun = true
      else stack.push({ begun: true })
    } else if (word === 'declare') stack.push({ begun: false })
    else if (word === 'case') { if (!/\bend\s*$/i.test(body.slice(Math.max(0, t.index! - 6), t.index!))) stack.push({ begun: true }) }
    else if (word === 'end' && !/^(if|loop)$/i.test(t[2] ?? '')) stack.pop()
  }
  return members
}

/** A routine's statement within what follows its CREATE: to the close of a PostgreSQL body ($$ … $$), else to Oracle's
 *  / line or SQL Server's GO (a REVOKE ON PROCEDURE tic_open() after it is no call). */
function statementOf(text: string): string {
  // (AS $$ or DO $$ opens one; Oracle's $$NO_OP is a conditional compilation flag.)
  const open = /\b(?:as|do)\s+(\$\w*\$)/i.exec(text)
  if (open) {
    const close = text.indexOf(open[1], open.index + open[0].length)
    if (close >= 0) return text.slice(0, close + open[1].length)
  }
  const end = /^[ \t]*(?:\/|GO)[ \t]*$/im.exec(text)
  return end ? text.slice(0, end.index) : text
}

const CREATE = new RegExp(String.raw`\bcreate\s+(?:or\s+(?:replace|alter)\s+)?(?:definer\s*=\s*\S+\s+)?(?:(?:non)?editionable\s+)?(package\s+body|package|procedure|proc|function|trigger)\s+(?:if\s+not\s+exists\s+)?(${NAME})`, 'gi')

/** The routines a script creates, each with its line and what its body touches. */
export function readRoutines(sql: string, file: string): ReadRoutine[] {
  const dialect = dialectOf(sql)
  const out: ReadRoutine[] = []
  const starts = [...sql.matchAll(CREATE)]
  // Each statement runs to the next CREATE of any kind (a table, a view, another routine), or to the end.
  const next = [...sql.matchAll(/\bcreate\s+(?:or\s+(?:replace|alter)\s+)?/gi)].map((m) => m.index!)
  for (const m of starts) {
    const kindWord = m[1].toLowerCase().replace(/\s+/g, ' ')
    const name = bare(m[3])
    const end = next.find((i) => i > m.index!) ?? sql.length
    const body = statementOf(sql.slice(m.index! + m[0].length, end))
    const line = lineAt(sql, m.index!)
    const evidence = { file, line }
    if (kindWord === 'package' || kindWord === 'package body') {
      if (!out.some((r) => r.name === name && r.kind === 'package')) out.push({ name, kind: 'package', ...(dialect ? { dialect } : {}), evidence })
      // Its members: each procedure or function the spec declares or the body defines, its body to the next member.
      const members = packageMembers(body)
      for (const [i, member] of members.entries()) {
        const memberName = `${name}.${member.name}`
        const memberBody = body.slice(member.index!, members[i + 1]?.index ?? body.length)
        const known = out.find((r) => r.name === memberName)
        const uses = kindWord === 'package body' ? bodyUses(memberBody.replace(/^\s*\w+\s+\w+/, '')) : undefined
        if (known) { if (uses) Object.assign(known, uses, { evidence: { file, line: lineAt(sql, m.index! + m[0].length + member.index!) } }); continue }
        out.push({ name: memberName, kind: member.kind === 'function' ? 'function' : 'procedure', ...(dialect ? { dialect } : {}), ...(uses ?? {}), evidence: { file, line: lineAt(sql, m.index! + m[0].length + member.index!) } })
      }
      continue
    }
    const kind = kindWord === 'proc' ? 'procedure' : (kindWord as RoutineFact['kind'])
    const uses = bodyUses(body)
    const table = kind === 'trigger' ? new RegExp(String.raw`\bon\s+${NAME}`, 'i').exec(body)?.[1] : undefined
    // A PostgreSQL trigger runs the function it names.
    const runs = kind === 'trigger' ? /\bexecute\s+(?:function|procedure)\s+(?:\w+\.)?(\w+)/i.exec(body)?.[1]?.toLowerCase() : undefined
    if (runs && !uses.calls.includes(runs)) uses.calls.push(runs)
    if (out.some((r) => r.name === name && r.kind === kind)) continue
    out.push({ name, kind, ...(dialect ? { dialect } : {}), ...(table ? { table: bare(table) } : {}), ...uses, evidence })
  }
  return out
}

// ─── The code's calls of stored routines ─────────────────────────────────────

/** A routine's name as code writes it, lower-case: pkg.proc, a schema's prefix off where three parts name it. */
const routineName = (name: string): string => {
  const parts = name.replace(/[`"[\]\s]/g, '').toLowerCase().split('.').filter(Boolean)
  return (parts.length > 2 ? parts.slice(-2) : parts).join('.')
}
/** A database's script. */
const SQL_FILE = /\.(sql|pks|pkb|pls|plb|pck|spc|bdy|prc|fnc|trg|tps|tpb|ddl)$/i

/** An argument's code, up to the comma or parenthesis closing it (one level of parentheses inside: getPkgName()). */
const ARG1 = String.raw`((?:"[^"\n]*"|[^(),"\n]|\([^()\n]*\))+?)`

/** Top-level parts of an expression split at a separator outside strings and parentheses. */
function parts(expr: string, separator: string): string[] {
  const out: string[] = []
  let depth = 0
  let quoted = false
  let start = 0
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i]
    if (c === '"' && expr[i - 1] !== '\\') quoted = !quoted
    else if (!quoted && c === '(') depth++
    else if (!quoted && c === ')') depth--
    else if (!quoted && depth === 0 && c === separator) { out.push(expr.slice(start, i)); start = i + 1 }
  }
  return [...out, expr.slice(start)]
}

/** The string an expression of code holds, where its parts are known: a literal, a variable or constant, a getter of a
 *  field (pkgCfg.getPkgName() → pkgName), a + b, Joiner.on(".").join(a, b), String.format("%s.%s", a, b). */
export function stringValue(expr: string, env: Map<string, string>): string | undefined {
  const e = expr.trim()
  const literal = /^"([^"\\]*)"$/.exec(e)
  if (literal) return literal[1]
  const joiner = /^Joiner\.on\(\s*"([^"]*)"\s*\)\.join\(([\s\S]*)\)$/.exec(e)
  if (joiner) { const values = parts(joiner[2], ',').map((x) => stringValue(x, env)); return values.every((v) => v !== undefined) ? values.join(joiner[1]) : undefined }
  const format = /^String\.format\(\s*"([^"]*)"\s*,([\s\S]*)\)$/.exec(e)
  if (format) {
    const values = parts(format[2], ',').map((x) => stringValue(x, env))
    if (values.some((v) => v === undefined)) return undefined
    let n = 0
    return format[1].replace(/%s/g, () => values[n++] ?? '')
  }
  const concat = parts(e, '+')
  if (concat.length > 1) { const values = concat.map((x) => stringValue(x, env)); return values.every((v) => v !== undefined) ? values.join('') : undefined }
  const name = /^(?:[A-Za-z_]\w*\.)*([A-Za-z_]\w*)(\(\s*\))?$/.exec(e)
  if (!name) return undefined
  if (name[2]) { const field = /^get([A-Z]\w*)$/.exec(name[1]); return env.get(name[1]) ?? (field ? env.get(field[1][0].toLowerCase() + field[1].slice(1)) : undefined) }
  return env.get(name[1])
}

/** The strings a file's code holds by name: its variables and constants (String name = <expr>;), in order. */
function fileStrings(text: string, repository: Map<string, string>): Map<string, string> {
  const env = new Map(repository)
  const twice = new Set<string>()
  for (const m of text.matchAll(/\b(?:String|string|var|val|const)\s+([A-Za-z_]\w*)\s*(?::\s*String\s*)?=\s*([^;\n]+)/g)) {
    const value = stringValue(m[2].replace(/;\s*$/, ''), env)
    if (value === undefined) continue
    if (env.has(m[1]) && env.get(m[1]) !== value && !repository.has(m[1])) twice.add(m[1])
    env.set(m[1], value)
  }
  for (const name of twice) env.delete(name)
  return env
}

const ROUTINE = String.raw`([\`"[]?[A-Za-z_][\w$#]*[\`"\]]?(?:\s*\.\s*[\`"[]?[A-Za-z_][\w$#]*[\`"\]]?){0,2})`

/** The stored routines a source file's code calls, each with its line and how. */
export function routineCallsIn(text: string, constants: Map<string, string> = new Map(), file?: string): Array<{ routine: string; via: string; index: number }> {
  const out: Array<{ routine: string; via: string; index: number }> = []
  const add = (name: string | undefined, via: string, index: number): void => { if (name) out.push({ routine: routineName(name), via, index }) }
  // A name as a string, or as code holding one: a constant, a variable, a getter of a configured field, a concatenation.
  const env = fileStrings(text, constants)
  const value = (expr: string | undefined): string | undefined => (expr === undefined ? undefined : stringValue(expr, env))
  // A named stored procedure query names its procedure (@NamedStoredProcedureQuery(name = …, procedureName = …)).
  const named = (expr: string | undefined): string | undefined => { const name = value(expr); return name === undefined ? undefined : env.get(`@named:${name}`) }
  // JDBC's and ODBC's call escape, a PL/SQL block, EXEC or CALL in a string of SQL.
  for (const m of text.matchAll(new RegExp(String.raw`\{\s*(?:\?\s*=\s*)?call\s+${ROUTINE}`, 'gi'))) add(m[1], 'JDBC', m.index!)
  for (const m of text.matchAll(new RegExp(String.raw`["'\`][ \t]*begin\s+(?:(?::\w+|\?)\s*:=\s*)?${ROUTINE}\s*[(;]`, 'gi'))) add(m[1], 'PL/SQL block', m.index!)
  // (CALL with its parentheses next to the name, EXEC before its parameters or the string's end: "Call us" and
  // "Call failed (%1)" are no calls;
  // the statement on the quote's line: a string's closing quote before a line of code is none.)
  for (const m of text.matchAll(new RegExp(String.raw`["'\`][ \t]*call[ \t]+${ROUTINE}\(`, 'gi'))) add(m[1], 'SQL', m.index!)
  for (const m of text.matchAll(new RegExp(String.raw`["'\`][ \t]*exec(?:ute)?[ \t]+(?:@\w+[ \t]*=[ \t]*)?${ROUTINE}[ \t]*(?=["'\`;]|[ \t]+[@:?'"]|\(|$)`, 'gim'))) add(m[1], 'SQL', m.index!)
  // Spring's SimpleJdbcCall: withProcedureName or withFunctionName, in the package withCatalogName names.
  for (const m of text.matchAll(new RegExp(String.raw`\.with(?:Procedure|Function)Name\(\s*${ARG1}\s*\)`, 'g'))) {
    const name = value(m[1])
    if (!name) continue
    const statement = text.slice(Math.max(0, text.lastIndexOf(';', m.index!) + 1), text.indexOf(';', m.index!) + 1 || text.length)
    const catalog = new RegExp(String.raw`\.withCatalogName\(\s*${ARG1}\s*\)`).exec(statement)
    const pkg = catalog ? value(catalog[1]) : undefined
    add(pkg ? `${pkg}.${name}` : name, 'Spring SimpleJdbcCall', m.index!)
  }
  // Spring's StoredProcedure: a subclass naming its procedure through setSql or its constructor.
  if (/\bextends\s+StoredProcedure\b/.test(text)) {
    for (const m of text.matchAll(new RegExp(String.raw`\bsetSql\(\s*${ARG1}\s*\)|\bsuper\(\s*[^,()]+,\s*${ARG1}\s*[,)]`, 'g'))) add(value(m[1] ?? m[2]), 'Spring StoredProcedure', m.index!)
  }
  // JPA: @Procedure (by its procedure, or by the name of a named query), a named stored procedure query's procedure,
  // createStoredProcedureQuery and createNamedStoredProcedureQuery.
  for (const m of text.matchAll(new RegExp(String.raw`@Procedure\(\s*(?:(procedureName|value|name)\s*=\s*)?${ARG1}\s*[,)]|\bprocedureName\s*=\s*${ARG1}\s*[,)]|\bcreateStoredProcedureQuery\(\s*${ARG1}\s*[,)]|\bcreateNamedStoredProcedureQuery\(\s*${ARG1}\s*\)`, 'g'))) {
    add(m[2] !== undefined ? (m[1] === 'name' ? named(m[2]) : value(m[2])) : m[3] !== undefined ? value(m[3]) : m[4] !== undefined ? value(m[4]) : named(m[5]), 'JPA', m.index!)
  }
  // ADO.NET and Dapper: the command text or the query's first string, where the command is a stored procedure.
  for (const m of text.matchAll(/\bCommandType\.StoredProcedure\b|\badCmdStoredProc\b/g)) {
    // The command's name stands before its type: in the command's text, its constructor, or the query's first argument.
    const before = text.slice(Math.max(0, m.index! - 600), m.index!)
    const found = [...before.matchAll(new RegExp(String.raw`\bCommandText\s*=\s*${ARG1}\s*[;\n]|\bnew\s+\w*Command\(\s*${ARG1}\s*[,)]|\b(?:Query|Execute|QueryFirst|QuerySingle|QueryMultiple)\w*(?:<[^>]*>)?\(\s*(?:\w+\s*,\s*)?${ARG1}\s*[,)]`, 'g'))].pop()
    if (found) add(value(found[1] ?? found[2] ?? found[3]), m[0] === 'adCmdStoredProc' ? 'ADO' : 'ADO.NET', m.index!)
  }
  // A function a query selects (SELECT f($1), FROM f()), PostgreSQL's way of calling one: a call only where the
  // repository creates a routine of that name (extract.ts), count( and now( being the database's own.
  for (const q of text.matchAll(/(["'`])[ \t]*select\b((?:(?!\1)[^\\\n]|\\.)*)\1/gi)) {
    // (A page's example query a player runs, or the text it shows, is no call of the page's.)
    if (file && shownOnly(text, q.index!, file)) continue
    for (const f of q[2].matchAll(/\b([A-Za-z_][\w$#]*(?:\.[A-Za-z_][\w$#]*)?)\s*\(/g)) add(f[1], 'SQL function', q.index! + q[0].indexOf(q[2]) + f.index!)
  }
  // Python's DB-API: cursor.callproc, cx_Oracle's and python-oracledb's callfunc.
  for (const m of text.matchAll(/\.call(?:proc|func)\(\s*['"]([\w$#.]+)['"]/g)) add(m[1], 'DB-API', m.index!)
  // One call once: a call escape inside a string is also a string's CALL.
  const seen = new Set<string>()
  return out.filter((c) => { const key = `${c.routine}@${c.index}`; if (seen.has(key) || out.some((o) => o !== c && o.routine === c.routine && Math.abs(o.index - c.index) < 3 && o.via !== c.via && c.via === 'SQL')) return false; seen.add(key); return true })
}

/** The routine calls of a repository's units' code, tests aside. */
export function readRoutineCalls(files: RepoFiles, repo: string, units: Unit[]): RoutineCallFact[] {
  const out: RoutineCallFact[] = []
  // (A MyBatis mapper's XML holds its CALLABLE statements: {call pkg.proc(#{id})}.)
  const sources = files.list.filter((f) => /\.(java|kt|cs|vb|bas|cls|frm|py|[cm]?[jt]sx?|svelte|vue|go|php|rb|xml)$/i.test(f) && !TEST_FILE.test(f) && !GENERATED.test(f))
  // The repository's string constants in Java, Kotlin and C# (a name used twice with two values names neither).
  const constants = new Map<string, string>()
  const twice = new Set<string>()
  for (const file of sources.filter((f) => /\.(java|kt|cs)$/i.test(f))) {
    for (const m of files.read(file).matchAll(/\b(?:String|string|val)\s+([A-Z][A-Z0-9_]*)\s*(?::\s*String\s*)?=\s*"([\w$#.]+)"/g)) {
      if (constants.has(m[1]) && constants.get(m[1]) !== m[2]) twice.add(m[1])
      constants.set(m[1], m[2])
    }
  }
  for (const name of twice) constants.delete(name)
  // Spring's configured fields (@Value("${pkg.name}") String pkgName) hold their properties' values, and a named stored
  // procedure query its procedure.
  const properties = new Map<string, string>()
  for (const file of files.list.filter((f) => /\.properties$/.test(f) && !TEST_FILE.test(f) && !/(^|\/)src\/test\//.test(f))) {
    for (const m of files.read(file).matchAll(/^\s*([\w.-]+)\s*[=:]\s*([\w$#.]+)\s*$/gm)) if (!properties.has(m[1])) properties.set(m[1], m[2])
  }
  for (const file of sources.filter((f) => /\.(java|kt)$/i.test(f))) {
    const text = withoutComments(files.read(file))
    for (const m of text.matchAll(/@Value\(\s*"\$\{([\w.-]+)(?::([\w$#.]*))?\}"\s*\)\s*(?:(?:private|protected|public|final|static)\s+)*(?:String\s+|lateinit\s+var\s+|var\s+|val\s+)?(\w+)/g)) {
      const configured = properties.get(m[1]) ?? m[2]
      if (configured) constants.set(m[3], configured)
    }
    for (const m of text.matchAll(/@NamedStoredProcedureQuery\s*\(([^)]*(?:\([^)]*\)[^)]*)*)\)/g)) {
      const name = /\bname\s*=\s*"([^"]+)"/.exec(m[1])?.[1]
      const procedure = /\bprocedureName\s*=\s*"([^"]+)"/.exec(m[1])?.[1]
      if (name && procedure) constants.set(`@named:${name}`, procedure)
    }
  }
  // A database project's scripts (a demo, an installer, another schema's) calling a routine: a call only where another
  // unit creates a routine of that name (extract.ts), to_char( and nvl( being the database's own.
  for (const unit of units.filter((u) => u.stack === 'sql')) {
    const prefix = unit.path === '.' ? '' : `${unit.path}/`
    for (const file of files.list.filter((f) => f.startsWith(prefix) && SQL_FILE.test(f) && owner(units, f) === unit && !TEST_FILE.test(f))) {
      const text = withoutSqlCommentsOrStrings(files.read(file))
      // (PL/SQL calls a procedure without parentheses too: pdf.add_page;)
      for (const m of text.matchAll(/\b([A-Za-z_][\w$#]*(?:\.[A-Za-z_][\w$#]*)?)\s*\(|\b([A-Za-z_][\w$#]*\.[A-Za-z_][\w$#]*)\s*;/g)) {
        const routine = routineName(m[1] ?? m[2])
        const id = `${repo}:routine-call:${unit.path}:${routine}`
        if (!out.some((x) => x.id === id)) out.push({ id, unit: unit.id, routine, via: 'SQL script', evidence: { file, line: lineAt(text, m.index!) } })
      }
    }
  }
  for (const file of sources) {
    const unit = owner(units, file)
    if (!unit) continue
    // (VB's comments start with a quote, as a string of another language does.)
    // (A Svelte or Vue component's markup only shows SQL, sql="SELECT attack(…)": its script runs it, and so do a
    // Svelte component's expressions in braces, onclick={() => quick(`SELECT refuel_ship(${id})`)}.)
    const raw = files.read(file)
    const code = /\.(svelte|vue)$/i.test(file) ? scriptOf(raw, /\.svelte$/i.test(file)) : raw
    const text = /\.(vb|bas|cls|frm)$/i.test(file) ? withoutVbComments(code) : /\.(java|kt|cs|[cm]?[jt]sx?|svelte|vue|go|php)$/i.test(file) ? withoutComments(code) : code
    if (!/call|exec|begin|select|Procedure|StoredProc|callproc|callfunc/i.test(text) || (/\.xml$/i.test(file) && !/\{\s*(?:\?\s*=\s*)?call\s/i.test(text))) continue
    for (const c of routineCallsIn(text, constants, file)) {
      const id = `${repo}:routine-call:${unit.path}:${c.routine}`
      if (!out.some((x) => x.id === id)) out.push({ id, unit: unit.id, routine: c.routine, via: c.via, evidence: { file, line: lineAt(text, c.index) } })
    }
  }
  return out
}
