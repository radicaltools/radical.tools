// ─── Radical Assay: reading a repository's facts ─────────────────────────────
//
// Reads one repository the same way every time and changes nothing in it
// (but its facts file, which the caller writes): its units in every stack
// (stacks.ts), what its deployment and configuration say of how it runs
// (runtime.ts), what its code says (code.ts), the operations of its OpenAPI
// descriptions, the tests its reports name and its documents (sources.ts). Every fact cites its file and
// line. Anything that cannot be read becomes a note: one broken manifest
// never hides the rest.

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'
import { load } from './yaml'
import { parseTestReport } from '@radical/common/check'
import { readCode } from './code'
import { readDomain, type AccessReader } from './domain'
export type { AccessReader, AccessSchema } from './domain'
import { readEntries } from './entries'
import { readForms } from './forms'
import { emptyFacts, type ApiFact, type RepositoryFacts, type TestFact, type Unit } from './facts'
import { GIT, RepoFiles, lineOf, owner, posix } from './files'
import { readMessages } from './messages'
import { readRuntime } from './runtime'
import { readDocuments } from './sources'
import { readStacks } from './stacks'

export { urlPathOf } from './code'

export interface ExtractOptions {
  /** Test reports (Vitest, Jest or Playwright JSON, JUnit XML), files or
   *  directories, from the repository's root or absolute. Default: the
   *  repository's reports/ when it has one. */
  reports?: string[]
  /** Reads an Access file's schema (the MCP server and the bench give mdb-reader's); none: Access files are noted, not read. */
  access?: AccessReader
}

const METHODS = new Set(['get', 'put', 'post', 'delete', 'patch', 'head', 'options', 'trace'])

/** The path part of a server's url ("https://x/api/v1" → "/api/v1"), none for "/". */
function basePath(url: string): string {
  const path = url.replace(/^[a-z]+:\/\/[^/]*/i, '').replace(/\{[^}]*\}/g, '').replace(/\/+$/, '')
  return path.startsWith('/') ? path : ''
}

/** The operations of an OpenAPI (or Swagger) description: only a path item's own method keys. */
function openApiOperations(text: string, file: string): Array<{ method: string; path: string; base: string; line: number }> {
  const doc = (file.endsWith('.json') ? JSON.parse(text) : load(text)) as { servers?: Array<{ url?: string }>; basePath?: string; paths?: Record<string, Record<string, unknown> | null> }
  if (!doc || typeof doc !== 'object') return []
  const base = doc.servers?.[0]?.url ? basePath(doc.servers[0].url) : doc.basePath ? basePath(doc.basePath) : ''
  const ops: Array<{ method: string; path: string; base: string; line: number }> = []
  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    if (!path.startsWith('/') || !item || typeof item !== 'object') continue
    // The path's line, quoted or not; its operations' lines below it.
    const at = Math.max(text.indexOf(`"${path}"`), text.indexOf(`'${path}'`), text.search(new RegExp(`^\\s*${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:`, 'm')))
    for (const method of Object.keys(item)) {
      if (!METHODS.has(method.toLowerCase())) continue
      const line = at < 0 ? 1 : lineOf(text, new RegExp(`["']?${method}["']?\\s*:`), at)
      ops.push({ method: method.toUpperCase(), path: `${base}${path}`, base, line })
    }
  }
  return ops
}

/** The repository's facts. */
export function extractRepository(dir: string, options: ExtractOptions = {}): RepositoryFacts {
  const given = resolve(dir)
  // Named by the folder given, as the run names it; read through its real folder.
  const repo = basename(given)
  const root = realpathSync(given)
  const facts = emptyFacts(repo, given)
  // Only a repository's own: a folder of code inside another repository (a .zip file's, unpacked) has none.
  if (existsSync(join(root, '.git'))) {
    try {
      const commit = execFileSync('git', [...GIT, 'rev-parse', 'HEAD'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
      if (commit) facts.commit = commit
    } catch {
      // A repository with no commit yet.
    }
  }
  const files = new RepoFiles(root)
  if (files.nested.length) facts.notes.push(`${files.nested.length} repositor${files.nested.length === 1 ? 'y' : 'ies'} inside this folder of code left out (${files.nested.slice(0, 5).join(', ')}${files.nested.length > 5 ? ', …' : ''}): give them on their own, or the folder that holds them directly`)
  if (files.more) facts.notes.push(`${files.more} files left out: a folder of code is read up to its first 200000 files`)

  const stacks = readStacks(files, repo)
  facts.units = stacks.units
  facts.dependencies = stacks.dependencies
  facts.groups = stacks.groups
  facts.notes.push(...stacks.notes)
  if (!facts.units.length) facts.notes.push('no unit of a stack Assay reads (npm, Maven, Gradle, Go, .NET, Python, VB6, a Dockerfile): cite the code instead')

  const runtime = readRuntime(files, repo, facts.units)
  facts.services = runtime.services
  facts.addresses = runtime.addresses
  facts.databases = runtime.databases
  facts.notes.push(...runtime.notes)

  // OpenAPI descriptions, a test's or fixture's aside; one that belongs to no unit is a note.
  for (const file of files.list.filter((f) => /\.(ya?ml|json)$/i.test(f) && !/(^|\/)(tests?|__tests__|fixtures?|testdata)\//i.test(f))) {
    const text = files.read(file)
    if (!/^\s*["']?(openapi|swagger)["']?\s*:/m.test(text.slice(0, 4000))) continue
    const unit = owner(facts.units, file)
    try {
      const ops = openApiOperations(text, file)
      if (!unit) { if (ops.length) facts.notes.push(`${file} describes ${ops.length} operations but belongs to no unit`); continue }
      for (const op of ops) {
        const id = `${repo}:api:${unit.path}:${op.method} ${op.path}`
        if (!facts.apis.some((a) => a.id === id)) facts.apis.push({ id, unit: unit.id, protocol: 'http', method: op.method, path: op.path, ...(op.base ? { base: op.base } : {}), evidence: { file, line: op.line } } as ApiFact)
      }
    } catch (error) {
      facts.notes.push(`${file} looks like an OpenAPI description but does not read: ${(error as Error).message.split('\n')[0]}`)
    }
  }

  const code = readCode(files, repo, facts.units)
  facts.urls = code.urls
  facts.clients = code.clients
  facts.apis.push(...code.apis)
  facts.addresses.push(...code.addresses)
  facts.databases.push(...code.databases)
  facts.notes.push(...code.notes)
  // The tables its schemas and ORM classes declare, with those its code names (a schema in no unit's folder is that of the
  // units using the database it creates, by their code or the services running them); its statuses; where its code is entered.
  const domain = readDomain(files, repo, facts.units, code.tables, facts.databases, options.access, facts.dependencies)
  facts.notes.push(...domain.notes)
  facts.tables = domain.tables
  facts.states = domain.states
  // A database a schema creates, unless a connection string of the unit already names it; one of its engine the unit
  // names with neither a name nor a server (filled in at run time) is that one.
  for (const db of domain.databases) {
    if (facts.databases.some((d) => d.unit === db.unit && d.name?.toLowerCase() === db.name?.toLowerCase())) continue
    facts.databases = facts.databases.filter((d) => !(d.unit === db.unit && d.engine === db.engine && !d.name && !d.server))
    facts.databases.push(db)
  }
  facts.entries = readEntries(files, repo, facts.units)
  // The messages its units publish and consume, which link.ts joins by their channel.
  facts.messages = readMessages(files, repo, facts.units)
  // A desktop application's forms are its screens, read from their files.
  facts.screens = readForms(files, repo, facts.units)

  facts.tests = readTests(root, repo, files, facts.units, options.reports, facts.notes)
  facts.documents = readDocuments(files, repo)
  return facts
}

function reportFiles(root: string, given: string[] | undefined, notes: string[]): string[] {
  const entries = given ?? (existsSync(join(root, 'reports')) ? ['reports'] : [])
  const out: string[] = []
  for (const entry of entries) {
    const path = isAbsolute(entry) ? entry : join(root, entry)
    if (!existsSync(path)) { notes.push(`report ${entry} does not exist`); continue }
    if (statSync(path).isDirectory()) {
      for (const f of readdirSync(path).sort()) if (/\.(json|xml)$/i.test(f)) out.push(join(path, f))
    } else {
      out.push(path)
    }
  }
  return out
}

/** Tests, by the id .radical/radical.json verifies binds: the test file from
 *  the repository's root, then the describe blocks and the title. A test two
 *  reports name failed when either says so. */
function readTests(root: string, repo: string, files: RepoFiles, units: Unit[], reports: string[] | undefined, notes: string[]): TestFact[] {
  const byId = new Map<string, TestFact>()
  const byName = new Map<string, string[]>()
  for (const f of files.list) {
    const name = f.slice(f.lastIndexOf('/') + 1)
    byName.set(name, [...(byName.get(name) ?? []), f])
  }
  for (const report of reportFiles(root, reports, notes)) {
    let cases
    try {
      cases = parseTestReport(readFileSync(report, 'utf8').replace(/^﻿/, ''), posix(relative(root, report)))
    } catch (error) {
      notes.push((error as Error).message)
      continue
    }
    for (const c of cases) {
      const file = repositoryPath(root, c.file, files, byName, posix(relative(root, report)))
      if (!file) continue
      const test = `${file} › ${c.title.join(' › ')}`
      const id = `${repo}:test:${test}`
      const known = byId.get(id)
      if (known) { if (c.status === 'failed') known.status = 'failed'; continue }
      const text = files.read(file)
      const title = c.title[c.title.length - 1] ?? ''
      // The title as a string literal first, so "adds" is not found in "adds twice".
      const quoted = title ? [`'${title}'`, `"${title}"`, `\`${title}\``].map((q) => text.indexOf(q)).filter((i) => i >= 0)[0] : undefined
      const line = quoted !== undefined ? text.slice(0, quoted).split('\n').length : title ? lineOf(text, title) : 1
      const unit = owner(units, file)
      // A test that passes without checking anything rests no scenario.
      const empty = quoted !== undefined && /\.[cm]?[jt]sx?$/.test(file) && checksNothing(text, quoted)
      byId.set(id, { id, ...(unit ? { unit: unit.id } : {}), test, status: c.status, ...(empty ? { checksNothing: true } : {}), evidence: { file, line } })
    }
  }
  return [...byId.values()]
}

/** A report's file name as a path from the repository's root: as given when
 *  it is one, inside the repository when absolute, else the one file of the
 *  repository it is the end of (CI's absolute paths, Playwright's paths from
 *  its config's folder, Windows separators). Null when it names none. */
function repositoryPath(root: string, file: string, files: RepoFiles, byName: Map<string, string[]>, report: string): string | null {
  const name = file.replace(/\\/g, '/').replace(/^\.\//, '')
  if (isAbsolute(file) || /^[A-Za-z]:\//.test(name)) {
    const real = existsSync(file) ? realpathSync(file) : file
    const rel = posix(relative(root, real))
    if (!rel.startsWith('..') && files.has(rel)) return rel
  } else {
    if (files.has(name)) return name
    const beside = posix(join(report.includes('/') ? report.slice(0, report.lastIndexOf('/')) : '.', name))
    if (files.has(beside)) return beside
  }
  const base = name.slice(name.lastIndexOf('/') + 1)
  const ends = (byName.get(base) ?? []).filter((f) => name.endsWith(`/${f}`) || f.endsWith(`/${name}`) || f === name)
  return ends.length === 1 ? ends[0] : null
}

/** An assertion in a JavaScript test: expect, assert, should, a node:test or AVA check. */
const ASSERTS = /\b(expect|assert\w*|should|strictEqual|deepEqual|deepStrictEqual|throws|rejects)\b|\bt\.(is|not|true|false|deepEqual|throws|snapshot)\b|\.(toBe|toEqual|toMatch|toHave\w*|toThrow\w*|toContain)\b/

/** Whether the test whose title is at `at` in `text` has an empty body or one that asserts nothing. */
export function checksNothing(text: string, at: number): boolean {
  // The function after the title: its body from the first { past the arrow or the parameters.
  const head = /^\s*(['"`])(?:\\.|(?!\1).)*\1\s*,\s*(?:async\s*)?(?:function\s*\w*\s*)?(?:\([^)]*\)|\w+)\s*(?:=>)?\s*\{/.exec(text.slice(at))
  if (!head) return false
  const start = at + head[0].length
  let depth = 1
  let quote = ''
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue }
    if (c === '"' || c === "'" || c === '`') quote = c
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) {
      // An assertion on a constant (expect(1).toBe(1)) checks nothing either.
      const body = text.slice(start, i).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '').replace(/\bexpect\(\s*(?:-?\d[\d.]*|true|false|null|undefined|'[^']*'|"[^"]*")\s*\)(?:\.\w+)*\([^)]*\)/g, '')
      return !body.trim() || !ASSERTS.test(body)
    }
  }
  return false
}
