// ─── Radical Assay: the tables Rails' schema and Ecto's migrations leave ─────
//
// A Rails application keeps its schema as db/schema.rb, written after every
// migration: create_table "accounts" … do |t| with a column a line, and
// add_foreign_key "accounts", "families" at its end. An Elixir application
// keeps its migrations in priv/<repo>/migrations, one module a file, run in
// the order of their names (a timestamp first): create table(:teams),
// drop table(:x), rename table(:a), to: table(:b), and SQL it executes
// (CREATE TABLE, DROP TABLE, RENAME TABLE). What is left after the last one
// is the schema. down() undoes up() and is not read.

import { lineAt } from './files'
import type { MigratedTable } from './laravel'

/** Rails' db/schema.rb: its tables, their columns and the foreign keys add_foreign_key states. */
export function railsSchema(text: string, file: string): MigratedTable[] {
  const tables = new Map<string, MigratedTable>()
  for (const m of text.matchAll(/^\s*create_table\s+["'](\w+)["'][^\n]*\bdo\s*\|(\w+)\|([^]*?)^\s*end\b/gm)) {
    const t: MigratedTable = { table: m[1], columns: [], references: [], evidence: { file, line: lineAt(text, m.index!) } }
    const start = m.index! + m[0].indexOf(m[3])
    for (const c of m[3].matchAll(new RegExp(`^\\s*${m[2]}\\.(\\w+)\\s+["'](\\w+)["']`, 'gm'))) {
      if (c[1] === 'index') continue
      const reference = c[1] === 'references' || c[1] === 'belongs_to'
      t.columns.push({ name: reference ? `${c[2]}_id` : c[2], type: c[1], line: lineAt(text, start + c.index!) })
    }
    tables.set(m[1], t)
  }
  for (const m of text.matchAll(/^\s*add_foreign_key\s+["'](\w+)["']\s*,\s*["'](\w+)["']([^\n]*)/gm)) {
    const column = /\bcolumn:\s*["'](\w+)["']/.exec(m[3])?.[1]
    tables.get(m[1])?.references.push({ ...(column ? { column } : {}), table: m[2], line: lineAt(text, m.index!) })
  }
  return [...tables.values()]
}

/** A migration's text without its down function (def down do … end, def down, do: …). */
function withoutDown(text: string): string {
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)def\s+down\b(.*)$/.exec(lines[i])
    if (!m) continue
    if (!/\bdo\s*$/.test(m[2])) { lines[i] = ''; continue }
    for (let j = i; j < lines.length; j++) {
      const end = lines[j] === `${m[1]}end`
      lines[j] = ''
      if (end) { i = j; break }
    }
  }
  return lines.join('\n')
}

const NAME = String.raw`(?::(\w+)|"(\w+)")`

/** Ecto's migrations, in the order they run: the tables the last one leaves. */
export function ectoMigrations(migrations: Array<{ file: string; text: string }>): MigratedTable[] {
  const tables = new Map<string, MigratedTable>()
  const steps = new RegExp(String.raw`\b(create|create_if_not_exists|drop|drop_if_exists|rename|alter)\s*\(?\s*table\(\s*${NAME}[^\n;]*|\b(CREATE\s+(?:OR\s+REPLACE\s+)?TABLE(?:\s+IF\s+NOT\s+EXISTS)?|DROP\s+TABLE(?:\s+IF\s+EXISTS)?|RENAME\s+TABLE|ALTER\s+TABLE)\s+(?:\w+\.)?"?(\w+)"?((?:\s+ON\s+CLUSTER\s+\S+)?\s+(?:TO|RENAME\s+TO)\s+(?:\w+\.)?"?(\w+)"?)?`, 'gi')
  for (const { file, text: raw } of [...migrations].sort((a, b) => a.file.localeCompare(b.file))) {
    // execute up, down: the second statement undoes the first (lines hold); Oban's migrations create its tables.
    const text = withoutDown(raw)
      .replace(/(\bexecute\s*\(?\s*(?:"""[^]*?"""|"(?:[^"\\]|\\.)*"))(\s*,\s*(?:"""[^]*?"""|"(?:[^"\\]|\\.)*"))/g, (_, up: string, down: string) => up + down.replace(/[^\n]/g, ''))
      .replace(/\bOban\.Migrations?\.up\b/g, 'create table(:oban_jobs); create table(:oban_peers)')
    for (const m of text.matchAll(steps)) {
      const line = lineAt(text, m.index!)
      if (m[1]) {
        const name = m[2] ?? m[3]
        const kind = m[1].toLowerCase()
        if (kind.startsWith('drop')) tables.delete(name)
        else if (kind === 'rename') {
          const to = new RegExp(String.raw`\bto:\s*table\(\s*${NAME}`).exec(m[0])
          const t = tables.get(name)
          if (t && to) { tables.delete(name); t.table = to[1] ?? to[2]; tables.set(t.table, t) }
        } else if (kind.startsWith('create') && !tables.has(name)) tables.set(name, { table: name, columns: [], references: [], evidence: { file, line } })
        continue
      }
      const verb = m[4].toUpperCase()
      const name = m[5]
      if (verb.startsWith('CREATE')) { if (!tables.has(name)) tables.set(name, { table: name, columns: [], references: [], evidence: { file, line } }) }
      else if (verb.startsWith('DROP')) tables.delete(name)
      else if (m[7]) {
        const t = tables.get(name)
        if (t) { tables.delete(name); t.table = m[7]; tables.set(m[7], t) }
      }
    }
  }
  return [...tables.values()]
}
