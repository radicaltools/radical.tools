// ─── Radical Assay: what a unit keeps ────────────────────────────────────────
//
// The tables a unit's SQL creates or alters and its ORM classes map (JPA,
// Entity Framework Core, Django, SQLAlchemy, TypeORM, Prisma), each with its
// columns and foreign keys, and the values its statuses take (an enum named
// for one, a CHECK … IN list, an SQL ENUM) with the lines of code that set
// each value (ADR Assay writes the domain, processes and lifecycles it
// reads). A table an ORM class maps is the table its SQL names: one fact,
// its id the table's name.

import { extname } from 'node:path'
import type { StateFact, TableFact, Unit } from './facts'
import { GENERATED, RepoFiles, TEST_FILE, escapeRe, lineAt, owner } from './files'
import { withoutVbComments } from './code'

type Column = NonNullable<TableFact['columns']>[number]
type Reference = NonNullable<TableFact['references']>[number]

/** A table as a schema or an ORM class declares it, before its references to classes are resolved. */
interface Declared {
  unit: Unit
  table: string
  /** The class that maps it, which another class's reference names. */
  className?: string
  declared: string
  columns: Column[]
  /** A reference names a table, or (ORM) a class whose table is found once every class is read. */
  references: Array<Reference & { className?: string }>
  evidence: { file: string; line: number }
}

/** A status's or state's name: OrderStatus, order_state, PHASE. */
const STATUS_NAME = /(status|state|phase|stage|lifecycle)(es|s)?(_?(code|cd|type|enum))?$/i
const isStatus = (name: string): boolean => STATUS_NAME.test(name) && !/^(is|has)[A-Z_]/.test(name)

const unquote = (name: string): string => name.replace(/^[`"[]|[`"\]]$/g, '')
/** schema.table → table. */
const bare = (name: string): string => unquote(name.split('.').pop() ?? name)
/** OrderItem → order_item. */
const snake = (name: string): string => name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2').toLowerCase()
const quoted = (text: string): string[] => [...text.matchAll(/'((?:[^']|'')*)'|"([^"]*)"/g)].map((m) => (m[1] ?? m[2]).replace(/''/g, "'"))

/** The text between the bracket at `open` and the one that closes it, quotes aside; null when it never closes. */
function enclosed(text: string, open: number, pair = '()'): { body: string; start: number } | null {
  let depth = 0
  let quote = ''
  for (let i = open; i < text.length; i++) {
    const c = text[i]
    if (quote) { if (c === quote) quote = ''; continue }
    if (c === "'" || c === '"' || c === '`') quote = c
    else if (c === pair[0]) depth++
    else if (c === pair[1] && --depth === 0) return { body: text.slice(open + 1, i), start: open + 1 }
  }
  return null
}

/** The parts of a list at its top level, each with where it starts. */
function topLevel(body: string, separator = ','): Array<{ text: string; at: number }> {
  const out: Array<{ text: string; at: number }> = []
  let depth = 0
  let quote = ''
  let start = 0
  for (let i = 0; i <= body.length; i++) {
    const c = body[i]
    if (quote) { if (c === quote) quote = ''; continue }
    if (c === "'" || c === '"' || c === '`') quote = c
    else if (c === '(' || c === '{' || c === '[') depth++
    else if (c === ')' || c === '}' || c === ']') depth--
    else if ((c === separator && depth === 0) || i === body.length) {
      const text = body.slice(start, i)
      const lead = text.length - text.trimStart().length
      if (text.trim()) out.push({ text: text.trim(), at: start + lead })
      start = i + 1
    }
  }
  return out
}

/** SQL without its comments (--, # in MySQL, /* … *\/), its lines kept. */
const withoutSqlComments = (sql: string): string => sql.replace(/--[^\n]*|(^|[ \t,(])#[^\n'"]*$/gm, (m) => ' '.repeat(m.length)).replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))

const SQL_NAME = '[`"[]?(?:\\w+[`"\\]]?\\.)?[`"[]?([A-Za-z_][\\w$]*)[`"\\]]?'
const NOT_COLUMNS = /^(constraint|primary|unique|key|index|fulltext|spatial|exclude|period|like)\b/i

export interface SchemaState { name: string; values: string[]; initial?: string; table?: string; column?: string; file: string; line: number }

/** The tables an SQL file creates and alters, with their columns, foreign keys and the values a status column takes. */
export function readSchema(sql: string, file: string): { tables: Array<Omit<Declared, 'unit'>>; states: SchemaState[] } {
  const text = withoutSqlComments(sql)
  const tables: Array<Omit<Declared, 'unit'>> = []
  const states: SchemaState[] = []
  // PostgreSQL: CREATE TYPE order_status AS ENUM ('new', 'paid').
  const types = new Map<string, SchemaState>()
  for (const m of text.matchAll(new RegExp(`\\bcreate\\s+type\\s+${SQL_NAME}\\s+as\\s+enum\\s*\\(([^)]*)\\)`, 'gi'))) {
    const values = quoted(m[2])
    if (values.length < 2) continue
    types.set(m[1].toLowerCase(), { name: m[1], values, file, line: lineAt(text, m.index!) })
  }
  for (const m of text.matchAll(new RegExp(`\\bcreate\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?${SQL_NAME}\\s*\\(`, 'gi'))) {
    const table = m[1]
    const open = m.index! + m[0].length - 1
    const body = enclosed(text, open)
    const declared: Omit<Declared, 'unit'> = { table, declared: 'SQL', columns: [], references: [], evidence: { file, line: lineAt(text, m.index!) } }
    tables.push(declared)
    if (!body) continue
    for (const item of topLevel(body.body)) {
      const line = lineAt(text, body.start + item.at)
      const fk = new RegExp(`^(?:constraint\\s+\\S+\\s+)?foreign\\s+key\\s*\\(([^)]*)\\)\\s*references\\s+${SQL_NAME}`, 'i').exec(item.text)
      if (fk) { declared.references.push({ column: unquote(fk[1].split(',')[0].trim()), table: fk[2], line }); continue }
      const check = /^(?:constraint\s+\S+\s+)?check\s*\(\s*[`"[]?(\w+)[`"\]]?\s+in\s*\(([^)]*)\)/i.exec(item.text)
      if (check) {
        if (isStatus(check[1]) && quoted(check[2]).length >= 2) states.push({ name: check[1], values: quoted(check[2]), table, column: check[1], file, line })
        continue
      }
      if (NOT_COLUMNS.test(item.text)) continue
      const column = /^([`"[]?[A-Za-z_][\w$]*[`"\]]?)\s+([A-Za-z_][\w.]*(?:\s*\([^)]*\))?(?:\s+varying(?:\s*\(\d+\))?)?)?/.exec(item.text)
      if (!column) continue
      const name = unquote(column[1])
      const type = column[2]?.replace(/\s+/g, ' ')
      declared.columns.push({ name, ...(type ? { type: /^enum\b/i.test(type) ? 'ENUM' : type } : {}), ...(/\bnot\s+null\b|\bprimary\s+key\b/i.test(item.text) ? { notNull: true } : {}), line })
      const ref = new RegExp(`\\breferences\\s+${SQL_NAME}`, 'i').exec(item.text)
      if (ref) declared.references.push({ column: name, table: ref[1], line })
      // A status column's values: an inline CHECK … IN, a MySQL ENUM, or a type created as an enum.
      const inline = /\bcheck\s*\(\s*[`"[]?\w+[`"\]]?\s+in\s*\(([^)]*)\)/i.exec(item.text)?.[1] ?? (/^enum\s*\(/i.test(type ?? '') ? /\(([^)]*)\)/.exec(item.text.slice(column[1].length))?.[1] : undefined)
      const initial = /\bdefault\s+'([^']*)'/i.exec(item.text)?.[1]
      if (inline && isStatus(name) && quoted(inline).length >= 2) states.push({ name, values: quoted(inline), ...(initial ? { initial } : {}), table, column: name, file, line })
      const enumType = type && types.get(bare(type).toLowerCase())
      if (enumType) { enumType.table = table; enumType.column = name }
    }
  }
  for (const m of text.matchAll(new RegExp(`\\balter\\s+table\\s+(?:only\\s+)?(?:if\\s+exists\\s+)?${SQL_NAME}\\s+add\\s+(?:constraint\\s+\\S+\\s+)?foreign\\s+key\\s*\\(([^)]*)\\)\\s*references\\s+${SQL_NAME}`, 'gi'))) {
    const line = lineAt(text, m.index!)
    const reference = { column: unquote(m[2].split(',')[0].trim()), table: m[3], line }
    const known = tables.find((t) => t.table.toLowerCase() === m[1].toLowerCase())
    if (known) known.references.push(reference)
    else tables.push({ table: m[1], declared: 'SQL', columns: [], references: [reference], evidence: { file, line } })
  }
  for (const t of types.values()) if (isStatus(t.name)) states.push(t)
  return { tables, states }
}

// ── ORM classes ──────────────────────────────────────────────────────────────

/** Code without its comments (// and /* … *\/), its lines kept. */
const withoutComments = (code: string): string =>
  code.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:"'])\/\/[^\n]*/g, (m, lead: string) => lead + ' '.repeat(m.length - lead.length))

/** A class's body in braces, after `from`. */
function classBody(text: string, from: number): { body: string; start: number } | null {
  const open = text.indexOf('{', from)
  return open < 0 ? null : enclosed(text, open, '{}')
}

/** The lines of a body at its own level (no nested braces), each with its offset. */
function ownLines(body: string): Array<{ text: string; at: number }> {
  const out: Array<{ text: string; at: number }> = []
  let depth = 0
  let at = 0
  for (const line of body.split('\n')) {
    if (depth === 0) out.push({ text: line, at })
    for (const c of line) { if (c === '{') depth++; else if (c === '}') depth-- }
    at += line.length + 1
  }
  return out
}

const COLLECTION = /^(List|Set|Collection|ICollection|IList|IEnumerable|HashSet|Array|Iterable|IReadOnlyCollection|IReadOnlyList)\b|\[\]$/

function jpa(text: string, file: string): Array<Omit<Declared, 'unit'>> {
  const out: Array<Omit<Declared, 'unit'>> = []
  for (const m of text.matchAll(/@Entity\b(?:\s*\([^)]*\))?/g)) {
    const cls = /\bclass\s+(\w+)/.exec(text.slice(m.index!))
    if (!cls) continue
    const head = text.slice(m.index!, m.index! + cls.index)
    const named = /@Table\s*\(\s*(?:name\s*=\s*)?"([^"]+)"/.exec(head)?.[1] ?? /@Table\s*\([^)]*\bname\s*=\s*"([^"]+)"/.exec(text.slice(Math.max(0, m.index! - 400), m.index! + cls.index))?.[1]
    const at = m.index! + cls.index
    const declared: Omit<Declared, 'unit'> = { table: named ?? snake(cls[1]), className: cls[1], declared: 'JPA', columns: [], references: [], evidence: { file, line: lineAt(text, at) } }
    out.push(declared)
    const body = classBody(text, at)
    if (!body) continue
    let annotations = ''
    for (const l of ownLines(body.body)) {
      const line = l.text.trim()
      if (!line) continue
      // Annotations on lines of their own come before the field they annotate.
      const lead = /^((?:@[\w.]+(?:\s*\((?:[^()]|\([^()]*\))*\))?\s*)+)/.exec(line)?.[1] ?? ''
      annotations += ` ${lead}`
      const rest = line.slice(lead.length).trim()
      if (!rest) continue
      const field = /^(?:(?:private|protected|public|final|transient)\s+)*([\w.]+(?:<[^;=]*>)?(?:\[\])?)\s+(\w+)\s*(?:=[^;]*)?;$/.exec(rest)
      const kotlin = /^(?:(?:private|protected|public|lateinit|override)\s+)*va[lr]\s+(\w+)\s*:\s*([\w.]+(?:<[^=]*>)?\??)/.exec(rest)
      const given = annotations
      annotations = ''
      if ((!field && !kotlin) || /\bstatic\b/.test(rest) || /@Transient\b|@OneToMany\b|@ManyToMany\b|@ElementCollection\b/.test(given)) continue
      const [type, name] = field ? [field[1], field[2]] : [kotlin![2].replace(/\?$/, ''), kotlin![1]]
      const line_ = lineAt(text, body.start + l.at)
      if (/@(ManyToOne|OneToOne)\b/.test(given)) {
        const column = /@JoinColumn\s*\([^)]*\bname\s*=\s*"([^"]+)"/.exec(given)?.[1] ?? `${snake(name)}_id`
        if (!/@OneToOne\s*\([^)]*mappedBy/.test(given)) declared.references.push({ column, table: '', className: type, line: line_ })
        continue
      }
      if (COLLECTION.test(type)) continue
      declared.columns.push({ name: /@Column\s*\([^)]*\bname\s*=\s*"([^"]+)"/.exec(given)?.[1] ?? name, type, line: line_ })
    }
  }
  return out
}

const CS_SIMPLE = /^(int|long|short|byte|string|decimal|double|float|bool|char|Guid|DateTime|DateTimeOffset|DateOnly|TimeOnly|TimeSpan|Int\d+|UInt\d+|String|Decimal|Boolean|byte\[\])\??$/

/** Entity Framework Core: the classes a DbContext's DbSets name (or [Table] marks), their tables by the DbSet's name. */
function efCore(files: RepoFiles, sources: string[]): Array<Omit<Declared, 'unit'>> {
  const sets = new Map<string, string>()
  const tables = new Map<string, string>()
  for (const f of sources.filter((x) => x.endsWith('.cs'))) {
    const text = files.read(f)
    for (const m of text.matchAll(/\bDbSet<(\w+)>\s+(\w+)/g)) sets.set(m[1], m[2])
    for (const m of text.matchAll(/\bEntity<(\w+)>\(\)\s*\.ToTable\(\s*"([^"]+)"/g)) tables.set(m[1], m[2])
  }
  const out: Array<Omit<Declared, 'unit'>> = []
  for (const f of sources.filter((x) => x.endsWith('.cs'))) {
    const text = withoutComments(files.read(f))
    for (const m of text.matchAll(/(\[Table\(\s*"([^"]+)"[^\]]*\]\s*)?(?:(?:public|internal|sealed|partial|abstract)\s+)*class\s+(\w+)/g)) {
      const name = m[3]
      if (!sets.has(name) && !m[2]) continue
      const declared: Omit<Declared, 'unit'> = { table: m[2] ?? tables.get(name) ?? sets.get(name)!, className: name, declared: 'Entity Framework Core', columns: [], references: [], evidence: { file: f, line: lineAt(text, m.index! + (m[1]?.length ?? 0)) } }
      out.push(declared)
      const body = classBody(text, m.index! + m[0].length)
      if (!body) continue
      const props = [...body.body.matchAll(/(\[[^\]]*\]\s*)*\bpublic\s+(?:virtual\s+|required\s+)*([\w.]+(?:<[^>]*>)?\??)\s+(\w+)\s*\{\s*get;/g)]
      for (const p of props) {
        const [type, prop] = [p[2], p[3]]
        const line = lineAt(text, body.start + p.index! + (p[1]?.length ?? 0))
        if (COLLECTION.test(type)) continue
        const target = type.replace(/\?$/, '')
        if (sets.has(target) || (!CS_SIMPLE.test(type) && /\[ForeignKey\(/.test(p[1] ?? ''))) {
          const column = /\[ForeignKey\(\s*"(\w+)"/.exec(p[1] ?? '')?.[1] ?? `${prop}Id`
          declared.references.push({ column, table: '', className: target, line })
          continue
        }
        declared.columns.push({ name: prop, type, line })
      }
    }
  }
  return out
}

/** Python classes: Django models and SQLAlchemy's declarative classes. */
function python(text: string, file: string): Array<Omit<Declared, 'unit'>> {
  const out: Array<Omit<Declared, 'unit'>> = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const head = /^(\s*)class\s+(\w+)\s*\(([^)]*)\)\s*:/.exec(lines[i])
    if (!head) continue
    const indent = head[1].length
    const body: Array<{ text: string; line: number }> = []
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim() && lines[j].length - lines[j].trimStart().length <= indent) break
      body.push({ text: lines[j], line: j + 1 })
    }
    const all = body.map((b) => b.text).join('\n')
    const django = /\bmodels\.Model\b|^\s*Model\s*$/.test(head[3]) && /=\s*models\.\w+Field\(|=\s*models\.ForeignKey\(/.test(all)
    const tablename = /^\s*__tablename__\s*=\s*['"](\w+)['"]/m.exec(all)?.[1]
    if (!django && !tablename) continue
    // Django names a model's table <app>_<model>, its app the folder of models.py.
    const app = file.split('/').slice(0, -1).filter((s) => s !== 'models').pop() ?? ''
    const table = tablename ?? /^\s*db_table\s*=\s*['"](\w+)['"]/m.exec(all)?.[1] ?? `${app ? `${app}_` : ''}${head[2].toLowerCase()}`
    const declared: Omit<Declared, 'unit'> = { table, className: head[2], declared: django ? 'Django' : 'SQLAlchemy', columns: [], references: [], evidence: { file, line: i + 1 } }
    out.push(declared)
    for (const b of body) {
      if (django) {
        const f = /^\s+(\w+)\s*=\s*models\.(\w+)\((.*)$/.exec(b.text)
        if (!f) continue
        if (/^(ForeignKey|OneToOneField)$/.test(f[2])) {
          const target = /^\s*['"]?(?:\w+\.)?(\w+)['"]?/.exec(f[3])?.[1] ?? ''
          declared.references.push({ column: `${f[1]}_id`, table: '', className: target === 'self' ? head[2] : target, line: b.line })
        } else if (f[2] !== 'ManyToManyField') {
          declared.columns.push({ name: f[1], type: /\bchoices\s*=\s*(\w+)\.choices/.exec(f[3])?.[1] ?? f[2], line: b.line })
        }
        continue
      }
      const c = /^\s+(\w+)\s*(?::\s*Mapped\[([^\]]*)\]\s*)?=\s*(?:\w+\.)?(Column|mapped_column|relationship)\((.*)$/.exec(b.text)
      if (!c || c[3] === 'relationship') continue
      const fk = /ForeignKey\(\s*['"](?:\w+\.)?(\w+)\.\w+['"]/.exec(c[4])
      if (fk) declared.references.push({ column: c[1], table: fk[1], line: b.line })
      const type = /^\s*(?:\w+\.)?(Enum)\(\s*(\w+)/.exec(c[4])?.[2] ?? /^\s*(?:\w+\.)?([A-Z]\w*)/.exec(c[4])?.[1] ?? c[2]
      declared.columns.push({ name: c[1], ...(type ? { type } : {}), line: b.line })
    }
  }
  return out
}

function typeOrm(text: string, file: string): Array<Omit<Declared, 'unit'>> {
  const out: Array<Omit<Declared, 'unit'>> = []
  for (const m of text.matchAll(/@Entity\(\s*(?:['"]([^'"]+)['"]|\{[^}]*\bname\s*:\s*['"]([^'"]+)['"][^}]*\})?\s*\)/g)) {
    const cls = /\bclass\s+(\w+)/.exec(text.slice(m.index!))
    if (!cls) continue
    const at = m.index! + cls.index
    const declared: Omit<Declared, 'unit'> = { table: m[1] ?? m[2] ?? snake(cls[1]), className: cls[1], declared: 'TypeORM', columns: [], references: [], evidence: { file, line: lineAt(text, at) } }
    out.push(declared)
    const body = classBody(text, at)
    if (!body) continue
    let decorators = ''
    for (const l of ownLines(body.body)) {
      const line = l.text.trim()
      const lead = /^((?:@\w+\((?:[^()]|\([^()]*\))*\)\s*)+)/.exec(line)?.[1] ?? ''
      decorators += ` ${lead}`
      const field = /^(?:(?:public|private|protected|readonly)\s+)*(\w+)[!?]?\s*:\s*([^;=]+)/.exec(line.slice(lead.length).trim())
      if (!field) continue
      const given = decorators
      decorators = ''
      const lineNo = lineAt(text, body.start + l.at)
      const ref = /@(ManyToOne|OneToOne)\(\s*\(\)\s*=>\s*(\w+)/.exec(given)
      if (ref) {
        if (ref[1] === 'ManyToOne' || /@JoinColumn\b/.test(given)) declared.references.push({ column: /@JoinColumn\(\s*\{[^}]*\bname\s*:\s*['"](\w+)['"]/.exec(given)?.[1] ?? `${field[1]}Id`, table: '', className: ref[2], line: lineNo })
        continue
      }
      if (!/@(Column|PrimaryGeneratedColumn|PrimaryColumn|CreateDateColumn|UpdateDateColumn)\b/.test(given)) continue
      declared.columns.push({ name: /@Column\(\s*\{[^}]*\bname\s*:\s*['"](\w+)['"]/.exec(given)?.[1] ?? field[1], type: field[2].trim(), line: lineNo })
    }
  }
  return out
}

const PRISMA_SCALAR = /^(String|Int|BigInt|Float|Decimal|Boolean|DateTime|Json|Bytes|Unsupported)$/

function prisma(text: string, file: string): { tables: Array<Omit<Declared, 'unit'>>; enums: Array<{ name: string; values: string[]; line: number }> } {
  const tables: Array<Omit<Declared, 'unit'>> = []
  const enums: Array<{ name: string; values: string[]; line: number }> = []
  const models = new Set([...text.matchAll(/^\s*model\s+(\w+)\s*\{/gm)].map((m) => m[1]))
  for (const m of text.matchAll(/^\s*enum\s+(\w+)\s*\{([^}]*)\}/gm)) {
    enums.push({ name: m[1], values: m[2].split('\n').map((l) => /^\s*(\w+)/.exec(l)?.[1]).filter((v): v is string => !!v), line: lineAt(text, m.index!) })
  }
  for (const m of text.matchAll(/^\s*model\s+(\w+)\s*\{([^}]*)\}/gm)) {
    const declared: Omit<Declared, 'unit'> = { table: /@@map\(\s*"([^"]+)"/.exec(m[2])?.[1] ?? m[1], className: m[1], declared: 'Prisma', columns: [], references: [], evidence: { file, line: lineAt(text, m.index!) } }
    tables.push(declared)
    const start = m.index! + m[0].indexOf('{') + 1
    let at = 0
    for (const line of m[2].split('\n')) {
      const f = /^\s*(\w+)\s+(\w+)(\[\])?(\?)?(.*)$/.exec(line)
      const lineNo = lineAt(text, start + at)
      at += line.length + 1
      if (!f || f[1].startsWith('@@')) continue
      if (models.has(f[2])) {
        const fields = /@relation\([^)]*\bfields\s*:\s*\[\s*(\w+)/.exec(f[5])
        if (fields && !f[3]) declared.references.push({ column: fields[1], table: '', className: f[2], line: lineNo })
        continue
      }
      if (f[3] && !PRISMA_SCALAR.test(f[2])) continue
      declared.columns.push({ name: /@map\(\s*"([^"]+)"/.exec(f[5])?.[1] ?? f[1], type: f[2], ...(f[4] ? {} : { notNull: true }), line: lineNo })
    }
  }
  return { tables, enums }
}

// ── statuses in code ─────────────────────────────────────────────────────────

interface CodeEnum { name: string; values: string[]; /** Each value's other spellings: the string an enum member stands for. */ aliases: Map<string, string[]>; file: string; line: number }

/** Enums and unions of strings named for a status: TypeScript, Java, Kotlin, C#, Python, VB6. */
function codeEnums(text: string, file: string): CodeEnum[] {
  const out: CodeEnum[] = []
  const ext = extname(file).toLowerCase()
  const add = (name: string, values: Array<{ value: string; alias?: string }>, index: number): void => {
    const unique = values.filter((v, i) => v.value && values.findIndex((x) => x.value === v.value) === i)
    if (!isStatus(name) || unique.length < 2) return
    out.push({ name, values: unique.map((v) => v.value), aliases: new Map(unique.filter((v) => v.alias).map((v) => [v.value, [v.alias!]])), file, line: lineAt(text, index) })
  }
  if (/\.[cm]?[jt]sx?$/.test(ext)) {
    for (const m of text.matchAll(/\btype\s+(\w+)\s*=\s*((?:\s*\|?\s*(?:'[^'\n]*'|"[^"\n]*"))+)/g)) add(m[1], quoted(m[2]).map((value) => ({ value })), m.index!)
  }
  if (/\.(ts|tsx|mts|cts|java|kt|cs)$/.test(ext)) {
    for (const m of text.matchAll(/\benum\s+(?:class\s+)?(\w+)\s*(?:\([^)]*\))?\s*(?::\s*[\w.]+\s*)?\{/g)) {
      const body = enclosed(text, m.index! + m[0].length - 1, '{}')
      if (!body) continue
      // Java: the constants come before the first ;, its fields and methods after.
      const constants = ext === '.java' || ext === '.kt' ? body.body.split(';')[0] : body.body
      add(m[1], topLevel(constants).map((c) => {
        const member = /^(?:@\w+(?:\([^)]*\))?\s*)*([A-Za-z_]\w*)\s*(?:\(([^)]*)\))?\s*(?:=\s*(.+))?$/s.exec(c.text)
        if (!member) return { value: '' }
        const alias = quoted(member[3] ?? member[2] ?? '')[0]
        return { value: member[1], ...(alias ? { alias } : {}) }
      }), m.index!)
    }
  }
  if (ext === '.py') {
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const head = /^(\s*)class\s+(\w+)\s*\(([^)]*(?:Enum|Choices|IntFlag)[^)]*)\)\s*:/.exec(lines[i])
      if (!head) continue
      const values: Array<{ value: string; alias?: string }> = []
      for (let j = i + 1; j < lines.length && (!lines[j].trim() || lines[j].length - lines[j].trimStart().length > head[1].length); j++) {
        const member = /^\s+([A-Za-z_]\w*)\s*=\s*(.+)$/.exec(lines[j])
        if (member && !/^_/.test(member[1])) values.push({ value: member[1], ...(quoted(member[2])[0] ? { alias: quoted(member[2])[0] } : {}) })
      }
      add(head[2], values, lines.slice(0, i).join('\n').length + 1)
    }
  }
  if (/\.(bas|cls|frm|ctl)$/.test(ext)) {
    for (const m of text.matchAll(/^\s*(?:(?:Public|Private|Friend)\s+)?Enum\s+(\w+)\s*$([\s\S]*?)^\s*End\s+Enum/gim)) {
      add(m[1], m[2].split('\n').map((l) => ({ value: /^\s*\[?([A-Za-z_]\w*)\]?/.exec(l)?.[1] ?? '' })), m.index!)
    }
  }
  return out
}

const BOOLEAN = /^(bool|boolean|bit|tinyint\s*\(\s*1\s*\)|BooleanField|NullBooleanField)$/i
const DATE = /^(date|datetime2?|smalldatetime|timestamp(tz)?|timestamp\s+with(out)?\s+time\s+zone|DateTime\??|DateTimeOffset\??|LocalDate(Time)?|Instant|Date|DateTimeField|DateField)$/i
/** Names of a condition a row is in: is_dead, has_paid, banned, deleted. */
const CONDITION = /^(is|has|was)_?[a-z]|^(deleted|banned|blocked|locked|closed|paid|archived|cancell?ed|approved|verified|suspended|dead|online|disabled|expired|completed|shipped|delivered|refunded|void(ed)?)$/i
/** A date an event stamps: a past participle and at, on, date or time (paid_at, PaidOn, shipped_date); not when a row was made or touched. */
const EVENT_DATE = /^(?!(created|updated|modified|inserted|changed|last|birth|dob))[a-z]*?(ed|paid|sent|sold|built|done|won|lost|made)_?(at|on|date|time)$/i
/** An SQL date type, nullable unless NOT NULL; an ORM's is nullable only when it says so (DateTime?). */
const SQL_DATE = /^(date|datetime2?|smalldatetime|timestamp(tz)?|timestamp\s+with(out)?\s+time\s+zone)$/

/** The value a flag column stands for (is_dead → dead, PaidOn → paid), or none when it is no flag. */
function flagValue(c: Column): string | undefined {
  const type = (c.type ?? '').replace(/\(.*$/, (m) => (/^\(\s*1\s*\)$/.test(m) ? m : '')).trim()
  const words = (s: string): string => s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').trim().toLowerCase()
  if ((BOOLEAN.test(type) || (/^(tinyint|int|integer|smallint|number)/i.test(type) && /^(is|has|was)_/i.test(c.name))) && CONDITION.test(c.name)) {
    return words(c.name.replace(/^(is|has|was)_?/i, '')) || undefined
  }
  if (DATE.test(type) && !c.notNull && (SQL_DATE.test(type.toLowerCase()) && (type === type.toUpperCase() || type === type.toLowerCase()) || /\?$/.test(type)) && EVENT_DATE.test(c.name)) return words(c.name.replace(/_?(at|on|date|time)$/i, '')) || undefined
  return undefined
}

/** A line that sets a status: an assignment to a status, a setter, an UPDATE … SET, a VB recordset field. */
const SETTER = /\b\w*(?:status|state|phase|stage)\w*\s*(?:=(?![=>])|:(?!:))|\bset\w*(?:status|state|phase|stage)\s*\(|\(\s*"\w*(?:status|state|phase|stage)\w*"\s*\)\s*=(?!=)/i
/** A line that compares, filters or declares rather than sets. */
const NOT_SETTING = /[=!]==?|\b(?:if|else\s*if|when|case|switch|where|filter|find\w*|select|type|enum|interface|class|return)\b|^\s*(?:export\s+)?(?:const|let|var|readonly|public|private|protected)?\s*\w+\s*:\s*\w+\s*[;,]?\s*$/i
const SQL_SET = /\bupdate\b[\s\S]*?\bset\b[\s\S]*?\b(\w*(?:status|state|phase|stage)\w*)\s*=\s*(?:'([^']*)'|"([^"]*)")/i

const SOURCE = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts|java|kt|cs|py|go|rb|php|bas|cls|frm|ctl|vb)$/i
/** At most this many lines are kept per value, and per state. */
const SETS_PER_VALUE = 8
const SETS = 60

export interface DomainFacts {
  tables: TableFact[]
  states: StateFact[]
}

/** The tables of the repository's schemas and ORM classes, merged with those its code names (`named`), and its statuses. */
export function readDomain(files: RepoFiles, repo: string, units: Unit[], named: TableFact[]): DomainFacts {
  const declared: Declared[] = []
  const schemaStates: Array<SchemaState & { unit: Unit }> = []
  const prismaEnums: Array<CodeEnum & { unit: Unit }> = []
  const enums: Array<CodeEnum & { unit: Unit }> = []
  const own = (file: string): Unit | undefined => (GENERATED.test(file) ? undefined : owner(units, file))
  for (const file of files.list.filter((f) => /\.sql$/i.test(f) && !/(^|\/)(tests?|__tests__|e2e|testdata)\//i.test(f))) {
    const unit = own(file)
    if (!unit) continue
    const schema = readSchema(files.read(file), file)
    declared.push(...schema.tables.map((t) => ({ ...t, unit })))
    schemaStates.push(...schema.states.map((s) => ({ ...s, unit })))
  }
  const sources = files.list.filter((f) => SOURCE.test(f) && !TEST_FILE.test(f) && !!own(f))
  for (const file of sources) {
    const unit = own(file)!
    const raw = files.read(file)
    if (!raw) continue
    const ext = extname(file).toLowerCase()
    const vb = /^\.(bas|cls|frm|ctl|vb)$/.test(ext)
    const text = vb ? withoutVbComments(raw) : ext === '.py' ? raw : withoutComments(raw)
    if ((ext === '.java' || ext === '.kt') && /@Entity\b/.test(text)) declared.push(...jpa(text, file).map((t) => ({ ...t, unit })))
    if (ext === '.py' && /\bmodels\.Model\b|__tablename__/.test(text)) declared.push(...python(text, file).map((t) => ({ ...t, unit })))
    if (/\.[cm]?tsx?$/.test(ext) && /@Entity\(/.test(text)) declared.push(...typeOrm(text, file).map((t) => ({ ...t, unit })))
    enums.push(...codeEnums(text, file).map((e) => ({ ...e, unit })))
  }
  const csharp = sources.filter((f) => f.endsWith('.cs'))
  if (csharp.length) for (const t of efCore(files, csharp)) { const unit = own(t.evidence.file); if (unit) declared.push({ ...t, unit }) }
  for (const file of files.named(/\.prisma$/)) {
    const unit = own(file)
    if (!unit) continue
    const read = prisma(files.read(file), file)
    declared.push(...read.tables.map((t) => ({ ...t, unit })))
    prismaEnums.push(...read.enums.map((e) => ({ name: e.name, values: e.values, aliases: new Map<string, string[]>(), file, line: e.line, unit })))
  }

  // A class's reference names the table its class maps: of its own unit first, else of the repository.
  const classTable = (className: string, unit: Unit): string => {
    const of = declared.filter((d) => d.className === className)
    return (of.find((d) => d.unit === unit) ?? of[0])?.table ?? snake(className)
  }
  const tables = new Map<string, TableFact>(named.map((t) => [t.id, { ...t, inCode: true }]))
  for (const d of declared) {
    const id = `${repo}:table:${d.unit.path}:${bare(d.table).toLowerCase()}`
    const references = d.references.map(({ className, ...r }) => ({ ...r, table: bare(className ? classTable(className, d.unit) : r.table) }))
    const known = tables.get(id)
    if (known) {
      // A table named in code and declared here, or declared twice (SQL and an ORM class): one fact, with what each says.
      const was = known.declared
      if (d.declared !== 'SQL') known.inCode = true
      known.declared = was && !was.split(', ').includes(d.declared) ? `${was}, ${d.declared}` : was ?? d.declared
      // Where it is declared says more than where its code names it.
      if (!was) known.evidence = d.evidence
      if (!known.columns?.length) known.columns = d.columns
      known.references = [...(known.references ?? []), ...references.filter((r) => !known.references?.some((k) => k.table === r.table && k.column === r.column))]
    } else {
      tables.set(id, { id, unit: d.unit.id, table: bare(d.table), ...(d.declared !== 'SQL' ? { inCode: true } : {}), declared: d.declared, columns: d.columns, references, evidence: d.evidence })
    }
  }

  // Statuses: their values, and the column whose values they are.
  const states: StateFact[] = []
  const columns = [...tables.values()].flatMap((t) => (t.columns ?? []).map((c) => ({ table: t.table, column: c })))
  for (const s of schemaStates) {
    states.push({ id: `${repo}:state:${s.unit.path}:${(s.table ? `${s.table}.${s.column}` : s.name).toLowerCase()}`, unit: s.unit.id, name: s.name, values: s.values, ...(s.initial ? { initial: s.initial } : {}), ...(s.table ? { table: s.table, column: s.column } : {}), sets: [], evidence: { file: s.file, line: s.line } })
  }
  const aliasesOf = new Map<string, Map<string, string[]>>()
  for (const e of [...prismaEnums, ...enums.filter((x) => isStatus(x.name))]) {
    const id = `${repo}:state:${e.unit.path}:${e.name.toLowerCase()}`
    if (states.some((s) => s.id === id)) continue
    const typed = columns.find((c) => c.column.type?.replace(/[?<>[\]]/g, '') === e.name)
    states.push({ id, unit: e.unit.id, name: e.name, values: e.values, ...(typed ? { table: typed.table, column: typed.column.name } : {}), sets: [], evidence: { file: e.file, line: e.line } })
    aliasesOf.set(id, e.aliases)
  }
  // A lifecycle kept in flags: boolean columns named for a condition, nullable dates named for an event.
  const flagsOf = new Map<string, Array<{ column: string; value: string }>>()
  for (const t of tables.values()) {
    const flags = (t.columns ?? []).map((c) => ({ column: c.name, value: flagValue(c) })).filter((f): f is { column: string; value: string } => !!f.value)
    if (!flags.length) continue
    const unit = units.find((u) => u.id === t.unit)!
    const id = `${repo}:state:${unit.path}:${t.table.toLowerCase()}.flags`
    states.push({ id, unit: t.unit, name: `${t.table} flags`, values: flags.flatMap((f) => [f.value, `not ${f.value}`]), table: t.table, flags: flags.map((f) => ({ ...f, line: t.columns!.find((c) => c.name === f.column)!.line })), sets: [], evidence: { file: t.evidence.file, line: t.columns!.find((c) => c.name === flags[0].column)!.line } })
    flagsOf.set(id, flags)
  }
  if (states.length) {
    // Where each value is set, in any unit's code: an enum by its name and member, any status by its string,
    // a flag by its column set (1, true, now) or cleared (0, false, null).
    const tokens = states.map((s) => ({
      state: s,
      values: flagsOf.has(s.id) ? flagsOf.get(s.id)!.flatMap((f) => [
        { value: f.value, re: new RegExp(`\\b${escapeRe(f.column)}\\b["'\\])]*\\s*=\\s*(?:-?1\\b|true\\b|now\\b|now\\s*\\(|getdate\\s*\\(|current_timestamp|sysdate|new\\s+date|datetime\\.(?:utc)?now|date\\s*\\(|instant\\.now|localdatetime\\.now|timezone\\.now|datetime\\.(?:utc)?now\\()`, 'i') },
        { value: `not ${f.value}`, re: new RegExp(`\\b${escapeRe(f.column)}\\b["'\\])]*\\s*=\\s*(?:0\\b|false\\b|null\\b|nothing\\b|none\\b)`, 'i') },
      ]) : s.values.map((value) => {
        const spellings = [value, ...(aliasesOf.get(s.id)?.get(value) ?? [])]
        const member = aliasesOf.has(s.id) ? `\\b${escapeRe(s.name)}\\.${escapeRe(value)}\\b|` : ''
        return { value, re: new RegExp(`${member}(['"])(?:${spellings.map(escapeRe).join('|')})\\1`, aliasesOf.has(s.id) ? '' : 'i') }
      }),
    }))
    for (const file of [...sources, ...files.list.filter((f) => /\.sql$/i.test(f) && !TEST_FILE.test(f))]) {
      const unit = own(file)
      if (!unit) continue
      const raw = files.read(file)
      const vb = /\.(bas|cls|frm|ctl|vb)$/i.test(file)
      const lines = (vb ? withoutVbComments(raw) : raw).split('\n')
      lines.forEach((line, i) => {
        const sql = SQL_SET.exec(line)
        // An UPDATE's assignments, before its WHERE; elsewhere a line that sets rather than compares.
        const assigned = /\bupdate\b[\s\S]*?\bset\b([\s\S]*?)(?:\bwhere\b|$)/i.exec(line)?.[1]
        const setting = !NOT_SETTING.test(line)
        if (!sql && !assigned && (!SETTER.test(line) || !setting) && !(setting && /=/.test(line))) return
        for (const { state, values } of tokens) {
          if (state.sets.length >= SETS) continue
          if (state.evidence.file === file && state.evidence.line === i + 1) continue
          const flags = flagsOf.has(state.id)
          if (flags ? !assigned && !setting : !sql && (!SETTER.test(line) || !setting)) continue
          for (const { value, re } of values) {
            if (!re.test(flags ? assigned ?? line : sql ? `'${sql[2] ?? sql[3]}'` : line)) continue
            if (state.sets.filter((x) => x.value === value).length >= SETS_PER_VALUE) continue
            state.sets.push({ value, unit: unit.id, file, line: i + 1 })
          }
        }
      })
    }
  }
  return { tables: [...tables.values()], states }
}
