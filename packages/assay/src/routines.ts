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
import { GENERATED, RepoFiles, TEST_FILE, lineAt, owner } from './files'

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
  if (/\blanguage\s+'?plpgsql'?|\$\$|\$function\$|\bSERIAL\b|::\w/i.test(sql)) return 'PostgreSQL'
  return undefined
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
    const body = sql.slice(m.index! + m[0].length, end)
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

/** A routine's name in code: a string, or a constant (upper case) that holds one. */
const ARG = String.raw`(?:"([\w$#.[\]]+)"|((?:[A-Za-z_]\w*\.)*[A-Z][A-Z0-9_]*)\b)`
const ROUTINE = String.raw`([\`"[]?[A-Za-z_][\w$#]*[\`"\]]?(?:\s*\.\s*[\`"[]?[A-Za-z_][\w$#]*[\`"\]]?){0,2})`

/** The stored routines a source file's code calls, each with its line and how. */
export function routineCallsIn(text: string, constants: Map<string, string> = new Map()): Array<{ routine: string; via: string; index: number }> {
  const out: Array<{ routine: string; via: string; index: number }> = []
  const add = (name: string, via: string, index: number): void => { out.push({ routine: routineName(name), via, index }) }
  // A name as a string or as a constant holding one (IConstants.F_GET_EMPLOYEE).
  const value = (literal: string | undefined, constant: string | undefined): string | undefined => literal ?? (constant ? constants.get(constant.split('.').pop()!) : undefined)
  // JDBC's and ODBC's call escape, a PL/SQL block, EXEC or CALL in a string of SQL.
  for (const m of text.matchAll(new RegExp(String.raw`\{\s*(?:\?\s*=\s*)?call\s+${ROUTINE}`, 'gi'))) add(m[1], 'JDBC', m.index!)
  for (const m of text.matchAll(new RegExp(String.raw`["'\`][ \t]*begin\s+(?::\w+\s*:=\s*)?${ROUTINE}\s*[(;]`, 'gi'))) add(m[1], 'PL/SQL block', m.index!)
  // (CALL with its parentheses next to the name, EXEC before its parameters or the string's end: "Call us" and
  // "Call failed (%1)" are no calls;
  // the statement on the quote's line: a string's closing quote before a line of code is none.)
  for (const m of text.matchAll(new RegExp(String.raw`["'\`][ \t]*call[ \t]+${ROUTINE}\(`, 'gi'))) add(m[1], 'SQL', m.index!)
  for (const m of text.matchAll(new RegExp(String.raw`["'\`][ \t]*exec(?:ute)?[ \t]+(?:@\w+[ \t]*=[ \t]*)?${ROUTINE}[ \t]*(?=["'\`;]|[ \t]+[@:?'"]|\(|$)`, 'gim'))) add(m[1], 'SQL', m.index!)
  // Spring's SimpleJdbcCall: withProcedureName or withFunctionName, in the package withCatalogName names.
  for (const m of text.matchAll(new RegExp(String.raw`\.with(?:Procedure|Function)Name\(\s*${ARG}\s*\)`, 'g'))) {
    const name = value(m[1], m[2])
    if (!name) continue
    const statement = text.slice(Math.max(0, text.lastIndexOf(';', m.index!) + 1), text.indexOf(';', m.index!) + 1 || text.length)
    const catalog = new RegExp(String.raw`\.withCatalogName\(\s*${ARG}\s*\)`).exec(statement)
    const pkg = catalog ? value(catalog[1], catalog[2]) : undefined
    add(pkg ? `${pkg}.${name}` : name, 'Spring SimpleJdbcCall', m.index!)
  }
  // JPA: @Procedure, a named stored procedure query, createStoredProcedureQuery.
  for (const m of text.matchAll(new RegExp(String.raw`@Procedure\(\s*(?:(?:procedureName|value|name)\s*=\s*)?${ARG}|\bprocedureName\s*=\s*${ARG}|\bcreateStoredProcedureQuery\(\s*${ARG}`, 'g'))) {
    const name = value(m[1], m[2]) ?? value(m[3], m[4]) ?? value(m[5], m[6])
    if (name) add(name, 'JPA', m.index!)
  }
  // ADO.NET and Dapper: the command text or the query's first string, where the command is a stored procedure.
  for (const m of text.matchAll(/\bCommandType\.StoredProcedure\b|\badCmdStoredProc\b/g)) {
    // The command's name stands before its type: in the command's text, its constructor, or the query's first argument.
    const before = text.slice(Math.max(0, m.index! - 600), m.index!)
    const named = [...before.matchAll(new RegExp(String.raw`\bCommandText\s*=\s*${ARG}|\bnew\s+\w*Command\(\s*${ARG}|\b(?:Query|Execute|QueryFirst|QuerySingle|QueryMultiple)\w*(?:<[^>]*>)?\(\s*(?:\w+\s*,\s*)?${ARG}`, 'g'))].pop()
    const name = named ? value(named[1], named[2]) ?? value(named[3], named[4]) ?? value(named[5], named[6]) : undefined
    if (name) add(name, m[0] === 'adCmdStoredProc' ? 'ADO' : 'ADO.NET', m.index!)
  }
  // A function a query selects (SELECT f($1), FROM f()), PostgreSQL's way of calling one: a call only where the
  // repository creates a routine of that name (extract.ts), count( and now( being the database's own.
  for (const q of text.matchAll(/(["'`])[ \t]*select\b((?:(?!\1)[^\\\n]|\\.)*)\1/gi)) {
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
    const text = /\.(vb|bas|cls|frm)$/i.test(file) ? withoutVbComments(files.read(file)) : files.read(file)
    if (!/call|exec|begin|select|Procedure|StoredProc|callproc|callfunc/i.test(text) || (/\.xml$/i.test(file) && !/\{\s*(?:\?\s*=\s*)?call\s/i.test(text))) continue
    for (const c of routineCallsIn(text, constants)) {
      const id = `${repo}:routine-call:${unit.path}:${c.routine}`
      if (!out.some((x) => x.id === id)) out.push({ id, unit: unit.id, routine: c.routine, via: c.via, evidence: { file, line: lineAt(text, c.index) } })
    }
  }
  return out
}
