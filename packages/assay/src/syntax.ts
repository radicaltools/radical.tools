// ─── Radical Assay: code read through its syntax tree ───────────────────────
//
// ADR Assay reads code through syntax trees: tree-sitter, run as WebAssembly
// (the runtime and grammars of @vscode/tree-sitter-wasm), tells a reader what
// a line is inside (a class, its annotations, a method, a comment, a string)
// where a regular expression sees only text. The grammars load once and
// asynchronously (prepareSyntax), before a repository is read; parsing is
// synchronous, so the readers stay so. A bundle (the CLI, the MCP server)
// ships the files in a tree-sitter folder beside it; elsewhere they come from
// the package.

import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Language, Node, Parser, Query, Tree } from '@vscode/tree-sitter-wasm'
import files from './grammars.json'

export type { Node, Tree }

/** The languages read through a tree and their grammars' files, and the runtime's files beside them (grammars.json,
 *  which the CLI's and the MCP server's builds copy beside their bundles). */
export const GRAMMARS = files.grammars
export type Grammar = keyof typeof GRAMMARS
export const RUNTIME = files.runtime

/** Where the runtime and the grammars are, and the runtime's file: a bundle's tree-sitter folder (the runtime named .cjs,
 *  as CommonJS beside an ES module), else the package's. */
function wasmDir(): { dir: string; runtime: string } {
  const beside = join(dirname(fileURLToPath(import.meta.url)), 'tree-sitter')
  const shipped = RUNTIME[0].replace(/\.js$/, '.cjs')
  if (existsSync(join(beside, shipped))) return { dir: beside, runtime: shipped }
  return { dir: dirname(createRequire(import.meta.url).resolve('@vscode/tree-sitter-wasm')), runtime: RUNTIME[0] }
}

interface Loaded { parser: Parser; languages: Map<Grammar, Language>; Query: typeof Query }
let loaded: Loaded | undefined
let loading: Promise<void> | undefined

/** Load the runtime and every grammar, once; a repository is read after it. */
export function prepareSyntax(): Promise<void> {
  loading ??= (async () => {
    const { dir, runtime: file } = wasmDir()
    const runtime = createRequire(import.meta.url)(join(dir, file)) as typeof import('@vscode/tree-sitter-wasm')
    await runtime.Parser.init({ locateFile: (name: string) => join(dir, name) })
    const languages = new Map<Grammar, Language>()
    for (const [name, file] of Object.entries(GRAMMARS) as Array<[Grammar, string]>) languages.set(name, await runtime.Language.load(join(dir, file)))
    loaded = { parser: new runtime.Parser(), languages, Query: runtime.Query }
  })()
  return loading
}

function ready(): Loaded {
  if (!loaded) throw new Error('Assay reads code through syntax trees: await prepareSyntax() before reading a repository')
  return loaded
}

/** The syntax tree of a file's text, in a grammar. */
export function parse(grammar: Grammar, text: string): Tree {
  const { parser, languages } = ready()
  parser.setLanguage(languages.get(grammar)!)
  const tree = parser.parse(text)
  if (!tree) throw new Error(`tree-sitter parsed nothing (${grammar})`)
  return tree
}

const queries = new Map<string, Query>()
/** A tree-sitter query in a grammar, compiled once. */
export function query(grammar: Grammar, source: string): Query {
  const key = `${grammar}\u0000${source}`
  let q = queries.get(key)
  if (!q) {
    const { languages, Query: Q } = ready()
    q = new Q(languages.get(grammar)!, source)
    queries.set(key, q)
  }
  return q
}

/** A string literal's text without its quotes (Java "…", C# "…", @"…", $"…"; escapes as written). */
export function literal(node: Node): string {
  return node.text.replace(/^[@$]*"/, '').replace(/"$/, '')
}

/** The children of a node of a type, named or by field. */
export const childrenOf = (node: Node, type: string): Node[] => node.namedChildren.filter((c): c is Node => !!c && c.type === type)

const STRING = /^(string_literal|verbatim_string_literal|raw_string_literal|text_block)$/

/** The text of a string literal: its content, quotes and prefixes off (Java "…" and """…""", C# "…", @"…", """…"""). */
function contentOf(node: Node): string {
  return node.text.replace(/^(?:[@$u8]*)("""+|")/, '').replace(/("""+|")(?:u8)?$/, '')
}

/** The strings of a file's code, each with the row (0-based) it starts on: a literal, or literals joined with + into
 *  one (a statement written over lines); a part of the join that is no literal stands as a space. Each part keeps its
 *  own line, so a line within the string is a line of the file. */
export function strings(grammar: Grammar, text: string): Array<{ text: string; row: number }> {
  const out: Array<{ text: string; row: number }> = []
  const parts = (node: Node): Node[] => node.type === 'binary_expression' && node.childForFieldName('operator')?.text === '+'
    ? [...parts(node.childForFieldName('left')!), ...parts(node.childForFieldName('right')!)]
    : node.type === 'parenthesized_expression' && node.namedChildren[0] ? parts(node.namedChildren[0]) : [node]
  const walk = (node: Node): void => {
    if (node.type === 'binary_expression' && node.childForFieldName('operator')?.text === '+') {
      const all = parts(node)
      if (all.some((p) => STRING.test(p.type))) {
        const row = all[0].startPosition.row
        let joined = ''
        let at = row
        for (const p of all) {
          // Lines hold: each part starts on its own row of the file.
          while (at < p.startPosition.row) { joined += '\n'; at++ }
          joined += STRING.test(p.type) ? contentOf(p) : ' '
          at = p.endPosition.row
        }
        out.push({ text: joined, row })
        return
      }
    }
    if (STRING.test(node.type)) { out.push({ text: contentOf(node), row: node.startPosition.row }); return }
    for (const child of node.namedChildren) if (child) walk(child)
  }
  walk(parse(grammar, text).rootNode)
  return out
}
