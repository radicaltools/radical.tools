// ─── Radical Assay: the tables Laravel's migrations leave ────────────────────
//
// A Laravel application keeps its schema in database/migrations, one class a
// file, run in the order of their names (a timestamp first). Each migration's
// up() creates tables (Schema::create), changes them (Schema::table), renames
// (Schema::rename) and drops them (Schema::drop, dropIfExists); what is left
// after the last one is the schema. down() undoes up() and is not read.

import { lineAt } from './files'
import type { TableFact } from './facts'

type Column = NonNullable<TableFact['columns']>[number]
type Reference = NonNullable<TableFact['references']>[number]

export interface MigratedTable {
  table: string
  columns: Column[]
  references: Reference[]
  evidence: { file: string; line: number }
}

/** The text between the brace at `open` and the one that closes it, strings aside. */
function braced(text: string, open: number): { body: string; start: number } | null {
  let depth = 0
  let quote = ''
  for (let i = open; i < text.length; i++) {
    const c = text[i]
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue }
    if (c === "'" || c === '"') quote = c
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) return { body: text.slice(open + 1, i), start: open + 1 }
  }
  return null
}

/** Methods of a Blueprint that add no column of their own name. */
const NOT_COLUMNS = new Set(['index', 'unique', 'primary', 'foreign', 'fulltext', 'spatialIndex', 'dropColumn', 'dropColumns', 'dropIndex', 'dropUnique', 'dropPrimary', 'dropForeign', 'dropTimestamps', 'dropSoftDeletes', 'renameColumn', 'renameIndex', 'engine', 'charset', 'collation', 'comment', 'temporary', 'dropIfExists', 'drop', 'rename'])
/** Methods that add columns of fixed names. */
const FIXED: Record<string, string[]> = { id: ['id'], timestamps: ['created_at', 'updated_at'], timestampsTz: ['created_at', 'updated_at'], nullableTimestamps: ['created_at', 'updated_at'], softDeletes: ['deleted_at'], softDeletesTz: ['deleted_at'], rememberToken: ['remember_token'] }

/** user_id → users: the table Laravel's constrained() guesses from a column. */
const guessed = (column: string): string => {
  const base = column.replace(/_id$/, '')
  return /(s|x|z|ch|sh)$/.test(base) ? `${base}es` : /[^aeiou]y$/.test(base) ? `${base.slice(0, -1)}ies` : `${base}s`
}

/** What a Blueprint closure's body does to a table: the columns it adds and drops, the foreign keys it adds. */
function blueprint(body: string, at: number, text: string, t: MigratedTable): void {
  for (const m of body.matchAll(/\$\w+->(\w+)\(\s*(?:'([^']+)'|"([^"]+)"|\[([^\]]*)\])?([^;]*);/g)) {
    const [method, name, list, rest] = [m[1], m[2] ?? m[3], m[4], m[5]]
    const line = lineAt(text, at + m.index!)
    const has = (column: string): boolean => t.columns.some((c) => c.name === column)
    const add = (column: string, type?: string): void => { if (!has(column)) t.columns.push({ name: column, ...(type ? { type } : {}), ...(/->nullable\(/.test(rest) ? {} : { notNull: true }), line }) }
    if (method === 'dropColumn' || method === 'dropColumns') {
      const gone = name ? [name] : [...(list ?? '').matchAll(/'([^']+)'|"([^"]+)"/g)].map((x) => x[1] ?? x[2])
      t.columns = t.columns.filter((c) => !gone.includes(c.name))
      continue
    }
    if (method === 'renameColumn' && name) {
      const to = /^\s*,\s*['"]([^'"]+)['"]/.exec(rest)?.[1]
      const c = t.columns.find((x) => x.name === name)
      if (c && to) c.name = to
      continue
    }
    if (method === 'foreign' && name) {
      const on = /->on\(\s*['"]([^'"]+)['"]/.exec(rest)?.[1]
      if (on) t.references.push({ column: name, table: on, line })
      continue
    }
    if (FIXED[method]) { for (const c of FIXED[method]) add(c, method === 'id' ? 'bigIncrements' : 'timestamp'); continue }
    if (/^(nullable)?(uuid|ulid)?morphs$/i.test(method) && name) { add(`${name}_id`); add(`${name}_type`, 'string'); continue }
    if (!name || NOT_COLUMNS.has(method) || /^drop/.test(method)) continue
    add(name, method)
    // foreignId('user_id')->constrained() or ->constrained('users'), ->references('id')->on('users').
    const constrained = /->constrained\(\s*(?:['"]([^'"]+)['"])?/.exec(rest)
    const on = /->on\(\s*['"]([^'"]+)['"]/.exec(rest)?.[1]
    if (constrained) t.references.push({ column: name, table: constrained[1] ?? guessed(name), line })
    else if (on) t.references.push({ column: name, table: on, line })
  }
}

/** The tables Laravel's migrations leave, each with its columns and foreign keys, from the files given in any order. */
export function laravelMigrations(migrations: Array<{ file: string; text: string }>): MigratedTable[] {
  const tables = new Map<string, MigratedTable>()
  for (const { file, text } of [...migrations].sort((a, b) => a.file.localeCompare(b.file))) {
    const up = /function\s+up\s*\([^)]*\)\s*(?::\s*\w+\s*)?\{/.exec(text)
    if (!up) continue
    const body = braced(text, up.index + up[0].length - 1)
    if (!body) continue
    for (const m of body.body.matchAll(/Schema::(?:connection\([^)]*\)->)?(create|table|rename|drop|dropIfExists)\(\s*['"]([^'"]+)['"](?:\s*,\s*['"]([^'"]+)['"])?/g)) {
      const [kind, name, to] = [m[1], m[2], m[3]]
      const at = body.start + m.index!
      if (kind === 'drop' || kind === 'dropIfExists') { tables.delete(name); continue }
      if (kind === 'rename') {
        const t = tables.get(name)
        if (t && to) { tables.delete(name); t.table = to; tables.set(to, t) }
        continue
      }
      const t = kind === 'create' ? { table: name, columns: [], references: [], evidence: { file, line: lineAt(text, at) } } : tables.get(name)
      if (!t) continue
      if (kind === 'create') tables.set(name, t)
      // The closure that follows: function (Blueprint $table) { … } or fn (Blueprint $table) => …;
      const open = text.indexOf('{', at + m[0].length)
      const arrow = /^[^{;]*?\bfn\s*\([^)]*\)\s*=>/.exec(text.slice(at + m[0].length))
      if (arrow) {
        const from = at + m[0].length + arrow[0].length
        const end = text.indexOf(';', from)
        blueprint(text.slice(from, end + 1), from, text, t)
      } else if (open >= 0) {
        const closure = braced(text, open)
        if (closure) blueprint(closure.body, closure.start, text, t)
      }
    }
  }
  return [...tables.values()]
}
