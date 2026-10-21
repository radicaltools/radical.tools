/**
 * Structurizr DSL → radical.diagram DiagramData importer.
 *
 * Handles a practical subset of the Structurizr DSL:
 *   • person, softwareSystem, container, component elements, and elements
 *     of an archetype (`archetypes { application = container { … } }`)
 *   • group blocks  →  mapped to the 'group' node type, drawn on the views
 *     around what they hold, as Structurizr draws group boundaries
 *   • variable assignment:  varName = keyword "label" ...
 *   • flat and hierarchical identifiers (`!identifiers hierarchical`):
 *     `sys.container -> sys2.ctn`, a name relative to the block it is in,
 *     and `this`
 *   • description and technology given as strings or inside the element's
 *     block, text blocks ("""…""")
 *   • tags block and inline tag strings:
 *       - "External…" / "Existing…" → external: true
 *       - "Database" / "MS SQL db" / "Oracle db" → type: 'database'
 *   • relationships with optional label and technology strings, and a
 *     block of their own (tags, properties) that is skipped
 *   • enterprise blocks: their elements are part of the model
 *   • comments: line and block comments anywhere outside strings, # at the
 *     start of a line
 *   • views: system landscape, system context, container, component and
 *     dynamic views become Radical views (a dynamic one plays a sequence),
 *     laid out when first opened
 *
 * The result fits the metamodel the model will have (C4 unless told
 * otherwise): a group where a group has no place is left out (what it held
 * goes to its parent), and a relationship between types the metamodel does
 * not relate is left out. What the import could not read (deployment,
 * !include, extends, custom elements, view kinds Radical has not, …) or left
 * out is listed in `notRead`, for the user to be told.
 */

import type { C4Node, C4Relation, C4ElementType, DiagramSequence, DiagramView } from '../c4'
import { NODE_SIZES } from '../c4'
import type { Metamodel } from '../metamodel/types'
import { isPlacementAllowed, isRelationAllowed } from '../metamodel/lookup'
import { builtInC4Metamodel } from '../metamodel/presets/c4'

// ─── Public result type ───────────────────────────────────────────────────────

export interface StructurizrDslResult {
  nodes: C4Node[]
  relations: C4Relation[]
  /** The flows of the workspace's dynamic views. */
  sequences: DiagramSequence[]
  /** The workspace's views, in its order, with no places yet. */
  views: DiagramView[]
  /** Workspace name from the DSL (`workspace "Name"`, or `name "Name"` in
   *  its block), used as the document display name; empty when it gives
   *  none, for the caller to name the model after the file. */
  name: string
  /** What the import could not read or left out, one sentence each. */
  notRead: string[]
}

export interface StructurizrDslOptions {
  /** The metamodel the imported model will have; the built-in C4 one when
   *  not given (what a model saved without a metamodel opens with). */
  metamodel?: Metamodel
}

// ─── Tokenizer ────────────────────────────────────────────────────────────────

type TokKind = 'STR' | 'IDENT' | 'ARROW' | 'LBRACE' | 'RBRACE' | 'EQ' | 'DIRECTIVE' | 'EOF'
/** A token and the line it starts on; a DIRECTIVE (`!include …`) holds the
 *  rest of its line in `arg`. */
interface Tok { kind: TokKind; val: string; line: number; arg?: string }

/** A text block's lines without the indent they share, first and last
 *  blank lines dropped. */
function dedent(text: string): string {
  const lines = text.split('\n')
  while (lines.length && !lines[0].trim()) lines.shift()
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => /^[ \t]*/.exec(l)![0].length))
  return lines.map((l) => l.slice(Number.isFinite(indent) ? indent : 0).trimEnd()).join('\n')
}

function tokenize(src: string): Tok[] {
  // Comments are skipped as they come, outside strings: stripped from the
  // whole source first, the "//" of a URL in a string cut its line, the
  // string stayed open, and the rest of the workspace was lost.
  const s = src
  const out: Tok[] = []
  let i = 0
  let line = 1
  const push = (kind: TokKind, val: string, extra: Partial<Tok> = {}): void => { out.push({ kind, val, line, ...extra }) }
  /** Moves to `j`, counting the lines passed. */
  const advance = (j: number): void => {
    for (let k = i; k < j && k < s.length; k++) if (s[k] === '\n') line++
    i = j
  }

  while (i < s.length) {
    const c = s[i]

    if (/\s/.test(c)) { advance(i + 1); continue }

    // Line comment  // …,  # … at the start of a line (only there: a
    // colour in a style is #08427b), and block comment  /* … */
    if ((c === '/' && s[i + 1] === '/') || (c === '#' && /(^|\n)[ \t]*$/.test(s.slice(Math.max(0, i - 200), i)))) {
      while (i < s.length && s[i] !== '\n') i++
      continue
    }
    if (c === '/' && s[i + 1] === '*') {
      const end = s.indexOf('*/', i + 2)
      advance(end === -1 ? s.length : end + 2)
      continue
    }

    // Arrow  ->, and one of a relationship archetype  --sync->
    if (c === '-' && s[i + 1] === '>') {
      push('ARROW', '->'); advance(i + 2); continue
    }
    if (c === '-' && s[i + 1] === '-') {
      const m = /^--[A-Za-z0-9_.-]*?->/.exec(s.slice(i, i + 200))
      if (m) { push('ARROW', '->'); advance(i + m[0].length); continue }
    }

    // Text block  """ … """  (a description over several lines)
    if (s.startsWith('"""', i)) {
      const end = s.indexOf('"""', i + 3)
      const stop = end === -1 ? s.length : end
      push('STR', dedent(s.slice(i + 3, stop)))
      advance(end === -1 ? s.length : end + 3)
      continue
    }

    // String literal  "..."
    if (c === '"') {
      const startLine = line
      let j = i + 1
      let val = ''
      while (j < s.length && s[j] !== '"') {
        if (s[j] === '\\') { j++; val += s[j] ?? '' } else val += s[j]
        j++
      }
      advance(j + 1) // closing "
      out.push({ kind: 'STR', val, line: startLine }); continue
    }

    if (c === '{') { push('LBRACE', '{'); advance(i + 1); continue }
    if (c === '}') { push('RBRACE', '}'); advance(i + 1); continue }
    if (c === '=') { push('EQ',     '='); advance(i + 1); continue }
    // The wildcard of `include *`
    if (c === '*') { push('IDENT',  '*'); advance(i + 1); continue }

    // Directive  !include file, !identifiers hierarchical, !extend x { …:
    // the rest of the line is its argument (a path has no quotes), and a
    // brace that ends it opens its block.
    if (c === '!' && /[a-zA-Z]/.test(s[i + 1] ?? '')) {
      let j = i + 1
      while (j < s.length && /[a-zA-Z]/.test(s[j])) j++
      const name = s.slice(i, j)
      let end = s.indexOf('\n', j)
      if (end === -1) end = s.length
      let arg = s.slice(j, end).replace(/\s\/\/.*$/, '').trim()
      const block = arg.endsWith('{')
      if (block) arg = arg.slice(0, -1).trim()
      push('DIRECTIVE', name, { arg: arg.replace(/^"(.*)"$/, '$1') })
      if (block) push('LBRACE', '{')
      advance(end)
      continue
    }

    // Identifier — may contain dots (hierarchical paths like sys.container)
    if (/[a-zA-Z_]/.test(c)) {
      let j = i
      while (j < s.length && /[a-zA-Z0-9_\-.]/.test(s[j])) j++
      const val = s.slice(i, j)
      push('IDENT', val); advance(j)
      // `workspace extends <url or file>`: the rest up to the brace is one
      // argument (its "//" is no comment).
      const prev = out[out.length - 2]
      if (val.toLowerCase() === 'extends' && prev?.kind === 'IDENT' && prev.val.toLowerCase() === 'workspace') {
        let k = i
        while (k < s.length && s[k] !== '{' && s[k] !== '\n') k++
        push('STR', s.slice(i, k).trim().replace(/^"(.*)"$/, '$1'))
        advance(k)
      }
      continue
    }

    advance(i + 1) // skip unrecognised chars
  }

  out.push({ kind: 'EOF', val: '', line })
  return out
}

// ─── Parser ───────────────────────────────────────────────────────────────────

/** DSL element keywords (matched case-insensitively). */
const ELEMENT_KW = new Set(['person', 'softwaresystem', 'container', 'component', 'group'])

/** Body-level keywords that introduce a sub-block or inline value to skip. */
const SKIP_BODY_KW = new Set([
  'properties', 'url', 'metadata', 'perspective', 'perspectives',
])

/** The C4 level an element stands at, for what a view of it includes. */
type Level = 'person' | 'system' | 'container' | 'component'

function lc(s: string): string { return s.toLowerCase() }

/** "Existing System", "External Person": what C4 draws as outside the
 *  system being described. */
function isExternalTags(tags: string): boolean {
  return /external|existing/i.test(tags)
}

/** True when tag strings indicate this is a database element. */
function isDbTags(tags: string): boolean {
  const t = lc(tags)
  return (
    t.includes('database') ||
    / db(\b|$)/.test(t)   ||
    t.includes('ms sql')   ||
    t.includes('oracle db')
  )
}

interface Archetype { kw: string; tags: string; technology?: string; description?: string }

/** Where a statement stands: the element whose block it is in (none at the
 *  model's top), the identifier path relative names resolve against, and
 *  the element `this` and `-> x` mean. */
interface Scope { parentId: string | null; path: string[]; self: string | null }

interface PendingRel { src: string; tgt: string; path: string[]; self: string | null; label?: string; technology?: string }

interface ViewSpec {
  kind: 'landscape' | 'context' | 'container' | 'component' | 'dynamic'
  scope?: string
  key?: string
  title?: string
  include: string[]
  exclude: string[]
  steps: Array<{ src: string; tgt: string; description?: string }>
}

export function parseStructurizrDsl(src: string, options: StructurizrDslOptions = {}): StructurizrDslResult {
  const metamodel = options.metamodel ?? builtInC4Metamodel()
  const toks = tokenize(src)
  let p = 0

  const peek = (off = 0): Tok => toks[Math.min(p + off, toks.length - 1)]
  const eat  = (): Tok => { const t = toks[p]; if (p < toks.length - 1) p++; return t }

  let workspaceName = ''
  const nodes: C4Node[]     = []
  const relations: C4Relation[] = []
  const pending: PendingRel[] = []
  const viewSpecs: ViewSpec[] = []
  const archetypes = new Map<string, Archetype>()

  /** Full identifier path ("bank.api.email", case-folded) → node id. */
  const pathMap = new Map<string, string>()
  /** Bare identifier → node id; null when two elements have it. */
  const nameMap = new Map<string, string | null>()

  /** What could not be read, each said once, in the order met. */
  const notRead: string[] = []
  const skipped = (msg: string): void => { if (!notRead.includes(msg)) notRead.push(msg) }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Skip over a complete { ... } block (including nested braces). */
  function skipBlock(): void {
    if (peek().kind !== 'LBRACE') return
    eat()
    let depth = 1
    while (peek().kind !== 'EOF' && depth > 0) {
      const t = eat()
      if (t.kind === 'LBRACE') depth++
      else if (t.kind === 'RBRACE') depth--
    }
  }

  /** An unknown keyword with strings and identifiers on its line and then a
   *  block, as in `deploymentEnvironment "Live" { … }`: true when the
   *  block is there. */
  function namedBlockAhead(): boolean {
    const line = peek().line
    let k = 1
    while (peek(k).kind === 'STR' || (peek(k).kind === 'IDENT' && peek(k).line === line)) k++
    return peek(k).kind === 'LBRACE'
  }

  /** Consume consecutive STR tokens and return their values. */
  function consumeStrings(): string[] {
    const ss: string[] = []
    while (peek().kind === 'STR') ss.push(eat().val)
    return ss
  }

  /** The tokens left on a statement's line, up to a block. */
  function restOfLine(line: number): Tok[] {
    const out: Tok[] = []
    while (peek().kind !== 'EOF' && peek().kind !== 'LBRACE' && peek().kind !== 'RBRACE' && peek().line === line) out.push(eat())
    return out
  }

  /** Turn a hint string into a safe, lower-case, hyphen-separated id. */
  function mkId(hint: string): string {
    return hint.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'n'
  }

  /** Append a numeric suffix if `base` is already taken. */
  function uniqueId(base: string): string {
    if (!nodes.some(n => n.id === base)) return base
    let i = 2
    while (nodes.some(n => n.id === `${base}-${i}`)) i++
    return `${base}-${i}`
  }

  /** The element keyword a token names: a DSL one, or the one an archetype
   *  stands for. */
  function elementKeyword(t: Tok): string | null {
    if (t.kind !== 'IDENT') return null
    const k = lc(t.val)
    if (ELEMENT_KW.has(k)) return k
    return archetypes.get(k)?.kw ?? null
  }

  /** Infer the C4 node type from the DSL keyword and collected tag string. */
  function inferType(kw: string, tags: string): C4ElementType {
    if (kw === 'person')        return 'person'
    if (kw === 'softwaresystem') return 'system'
    if (kw === 'group')         return 'group'
    if (kw === 'component')     return 'component'
    if (kw === 'container' && isDbTags(tags)) return 'database'
    return 'container'
  }

  // ── Directives ───────────────────────────────────────────────────────────

  function directive(): void {
    const t = eat()
    const name = lc(t.val)
    const arg = t.arg ? ` ${t.arg}` : ''
    if (name === '!identifiers') { /* flat and hierarchical are both resolved */ }
    else if (name === '!include') skipped(`!include${arg}: the included file was not read; paste its content into the workspace to import it.`)
    else if (name === '!docs' || name === '!adrs') skipped(`${t.val}${arg}: documentation and decision records are not imported.`)
    else if (name === '!extend' || name === '!element' || name === '!elements' || name === '!relationship' || name === '!relationships') skipped(`${t.val} blocks: what they add to elements and relationships was not read.`)
    else if (name === '!const' || name === '!constant' || name === '!var') skipped(`${t.val}: constants and variables are not substituted into texts.`)
    else if (name === '!script' || name === '!plugin') skipped(`${t.val}: scripts and plugins are not run.`)
    if (peek().kind === 'LBRACE') skipBlock()
  }

  // ── Parse element body  { ... }  ─────────────────────────────────────────

  interface Body { tags: string; description?: string; technology?: string }

  function parseBody(scope: Scope): Body {
    eat() // consume opening {
    const body: Body = { tags: '' }

    while (peek().kind !== 'RBRACE' && peek().kind !== 'EOF') {
      const t = peek()

      if (t.kind === 'DIRECTIVE') { directive(); continue }

      // tags "t1" "t2" ...
      if (t.kind === 'IDENT' && lc(t.val) === 'tags') {
        eat()
        body.tags += ' ' + consumeStrings().join(' ')
        continue
      }
      // description "…" and technology "…" (given here, not as strings
      // after the name: they were skipped)
      if (t.kind === 'IDENT' && (lc(t.val) === 'description' || lc(t.val) === 'technology') && peek(1).kind === 'STR') {
        eat()
        const v = consumeStrings()[0]
        if (lc(t.val) === 'description') body.description = v
        else body.technology = v
        continue
      }

      // Skip known non-element sub-blocks / inline values
      if (t.kind === 'IDENT' && SKIP_BODY_KW.has(lc(t.val))) {
        eat()
        if (peek().kind === 'LBRACE') skipBlock()
        else consumeStrings()
        continue
      }

      if (statement(scope)) continue

      // Unknown IDENT followed by a block, with or without strings — skip
      if (t.kind === 'IDENT' && namedBlockAhead()) {
        eat(); restOfLine(t.line); skipBlock(); continue
      }

      eat() // skip anything else
    }

    if (peek().kind === 'RBRACE') eat() // consume closing }
    return body
  }

  /** An element, a relationship or an assignment of one, wherever elements
   *  may stand; false when the next token starts none of them. */
  function statement(scope: Scope): boolean {
    const t = peek()

    // Assignment:  varName = elementKeyword … | varName = a -> b …
    if (t.kind === 'IDENT' && peek(1).kind === 'EQ') {
      const vn = eat().val; eat() // consume varName and =
      if (elementKeyword(peek())) parseElement(scope, vn)
      else if (peek().kind === 'IDENT' && peek(1).kind === 'ARROW') parseRel(scope)
      else if (peek().kind === 'ARROW') parseRel(scope, true)
      else {
        const what = eat()
        const ss = consumeStrings()
        if (what.kind === 'IDENT' && lc(what.val) === 'element') skipped(`Custom elements ("${ss[0] ?? vn}") are not imported: Radical has no such element type.`)
        else if (what.kind === 'IDENT') skipped(`Elements of kind "${what.val}" (${vn}) are not imported: Radical has no such element type.`)
        if (peek().kind === 'LBRACE') skipBlock()
      }
      return true
    }

    // Anonymous element keyword
    if (elementKeyword(t)) { parseElement(scope, null); return true }

    // Relationship:  identifier -> identifier ...
    if (t.kind === 'IDENT' && peek(1).kind === 'ARROW') { parseRel(scope); return true }

    // Relationship from the element itself:  -> identifier ...
    if (t.kind === 'ARROW') { parseRel(scope, true); return true }

    // A custom element:  element "Name" …
    if (t.kind === 'IDENT' && lc(t.val) === 'element' && peek(1).kind === 'STR') {
      eat()
      const ss = consumeStrings()
      skipped(`Custom elements ("${ss[0]}") are not imported: Radical has no such element type.`)
      if (peek().kind === 'LBRACE') skipBlock()
      return true
    }
    return false
  }

  // ── Parse one element declaration ─────────────────────────────────────────

  function parseElement(scope: Scope, varName: string | null): void {
    const kwTok = eat()
    const kw = elementKeyword(kwTok)!
    const archetype = archetypes.get(lc(kwTok.val))
    const ss = consumeStrings() // collect all consecutive string args

    const label       = ss[0] || varName || kwTok.val
    let description = ss[1] || archetype?.description || ''

    // String arg positions differ by element type:
    //   person / softwareSystem : "name"  "desc"  "tags"
    //   container / component   : "name"  "desc"  "technology"  "tags"
    //   group                   : "name"
    let tech = '', inlineTags = archetype?.tags ?? ''
    if (kw === 'container' || kw === 'component') {
      tech       = ss[2] || archetype?.technology || ''
      inlineTags += ' ' + (ss[3] || '')
    } else if (kw !== 'group') {
      inlineTags += ' ' + (ss[2] || '')
    }

    const type     = inferType(kw, inlineTags)
    const base   = varName ? mkId(varName) : mkId(label)
    const nodeId = uniqueId(base)
    const size   = NODE_SIZES[type] ?? NODE_SIZES.container

    const node: C4Node = {
      id:          nodeId,
      type,
      label:       label || nodeId,
      parentId:    scope.parentId || undefined,
      collapsed:   false,
      x: 0, y: 0,
      width:  size.width,
      height: size.height,
    }
    nodes.push(node)

    // A group is no part of an identifier: what it holds is named as if it
    // stood where the group stands.
    const path = type === 'group' ? scope.path : [...scope.path, varName ?? `#${nodeId}`]
    if (varName) {
      const key = lc(varName)
      pathMap.set((type === 'group' ? [...scope.path, varName] : path).map(lc).join('.'), nodeId)
      nameMap.set(key, nameMap.has(key) ? null : nodeId)
    }

    let tags = inlineTags
    if (peek().kind === 'LBRACE') {
      const body = parseBody({ parentId: nodeId, path, self: type === 'group' ? scope.self : nodeId })
      tags += ' ' + body.tags
      if (body.description) description = body.description
      if (body.technology) tech = body.technology
    }
    if (description) node.description = description
    if (tech && type !== 'person' && type !== 'system' && type !== 'group') node.technology = tech
    if (node.type === 'container' && isDbTags(tags)) {
      node.type   = 'database'
      node.width  = NODE_SIZES.database.width
      node.height = NODE_SIZES.database.height
    }
    if (type !== 'group' && isExternalTags(tags)) node.external = true
  }

  // ── Parse a relationship ───────────────────────────────────────────────────

  /** A relationship; with `implied`, a `-> target …` line whose source is
   *  the element whose block holds it. Resolved once the whole model is
   *  read. */
  function parseRel(scope: Scope, implied = false): void {
    const srcRef = implied ? 'this' : eat().val // source identifier
    eat()                    // consume ->
    if (peek().kind !== 'IDENT') { consumeStrings(); skipBlock(); return }
    const tgtRef = eat().val // target identifier
    const ss     = consumeStrings()
    // Its own block (tags, properties): its closing brace closed the block
    // the relationship is in, and what followed was lost.
    skipBlock()
    pending.push({ src: srcRef, tgt: tgtRef, path: scope.path, self: scope.self, label: ss[0] || undefined, technology: ss[1] || undefined })
  }

  // ── archetypes { name = base { … } } ─────────────────────────────────────

  function parseArchetypes(): void {
    eat() // {
    while (peek().kind !== 'RBRACE' && peek().kind !== 'EOF') {
      if (peek().kind === 'IDENT' && peek(1).kind === 'EQ') {
        const name = lc(eat().val); eat()
        const baseTok = peek()
        const base = elementKeyword(baseTok)
        if (base && base !== 'group') {
          eat()
          const parent = archetypes.get(lc(baseTok.val))
          const arch: Archetype = { kw: base, tags: parent?.tags ?? '', technology: parent?.technology, description: parent?.description }
          if (peek().kind === 'LBRACE') {
            const body = parseBody({ parentId: null, path: [], self: null })
            arch.tags += ' ' + body.tags
            if (body.technology) arch.technology = body.technology
            if (body.description) arch.description = body.description
          }
          archetypes.set(name, arch)
          continue
        }
        // A relationship archetype (sync = -> { … }) or another kind.
        while (peek().kind !== 'LBRACE' && peek().kind !== 'RBRACE' && peek().kind !== 'EOF' && !(peek().kind === 'IDENT' && peek(1).kind === 'EQ')) eat()
        skipBlock()
        continue
      }
      eat()
    }
    if (peek().kind === 'RBRACE') eat()
  }

  // ── Parse the model block  model { ... }  ────────────────────────────────

  function parseModel(scope: Scope): void {
    eat() // consume opening {
    while (peek().kind !== 'RBRACE' && peek().kind !== 'EOF') {
      const t = peek()

      if (t.kind === 'DIRECTIVE') { directive(); continue }

      // properties { ... }
      if (t.kind === 'IDENT' && lc(t.val) === 'properties') {
        eat(); if (peek().kind === 'LBRACE') skipBlock(); continue
      }

      if (t.kind === 'IDENT' && lc(t.val) === 'archetypes' && peek(1).kind === 'LBRACE') {
        eat(); parseArchetypes(); continue
      }

      // enterprise "name" { ... }: its elements belong to the model. Its
      // closing brace closed the model, and what followed was lost.
      if (t.kind === 'IDENT' && lc(t.val) === 'enterprise' && namedBlockAhead()) {
        eat(); consumeStrings(); parseModel(scope); continue
      }

      if (t.kind === 'IDENT' && lc(t.val) === 'deploymentenvironment' && namedBlockAhead()) {
        eat()
        const ss = consumeStrings()
        skipped(`Deployment environment "${ss[0] ?? ''}": deployment nodes are not imported.`)
        skipBlock(); continue
      }

      if (statement(scope)) continue

      // Unknown IDENT with a block, with or without strings — skip
      if (t.kind === 'IDENT' && namedBlockAhead()) {
        eat(); restOfLine(t.line); skipBlock(); continue
      }

      eat() // skip anything else
    }

    if (peek().kind === 'RBRACE') eat()
  }

  // ── Parse the views block  views { ... }  ────────────────────────────────

  function parseViewBody(spec: ViewSpec): void {
    eat() // {
    let depth = 0 // parallel blocks of a dynamic view
    while (peek().kind !== 'EOF') {
      const t = peek()
      if (t.kind === 'RBRACE') {
        eat()
        if (depth === 0) return
        depth--
        continue
      }
      const word = t.kind === 'IDENT' ? lc(t.val) : ''
      if (word === 'include' || word === 'exclude') {
        eat()
        const args = restOfLine(t.line)
        if (args.some((a) => a.kind === 'ARROW' || a.kind === 'STR')) {
          skipped(`${t.val} expressions in view "${spec.title ?? spec.key ?? spec.kind}" (relationships, tags, types) were not read; the elements it names are.`)
        }
        for (const a of args) {
          if (a.kind !== 'IDENT') continue
          if (word === 'include') spec.include.push(a.val)
          else spec.exclude.push(a.val)
        }
        continue
      }
      if (word === 'title' && peek(1).kind === 'STR') { eat(); spec.title = eat().val; continue }
      if (spec.kind === 'dynamic' && t.kind === 'IDENT' && peek(1).kind === 'ARROW') {
        const from = eat().val; eat()
        if (peek().kind !== 'IDENT') continue
        const to = eat().val
        const ss = consumeStrings()
        spec.steps.push({ src: from, tgt: to, description: ss[0] })
        skipBlock()
        continue
      }
      // { … } of steps that run in parallel: their steps, in order.
      if (spec.kind === 'dynamic' && t.kind === 'LBRACE') { eat(); depth++; continue }
      if (t.kind === 'IDENT' && peek(1).kind === 'LBRACE') { eat(); skipBlock(); continue }
      if (t.kind === 'LBRACE') { skipBlock(); continue }
      eat() // autoLayout, description, default, …
    }
  }

  function parseViews(): void {
    eat() // {
    while (peek().kind !== 'RBRACE' && peek().kind !== 'EOF') {
      const t = peek()
      if (t.kind === 'DIRECTIVE') { directive(); continue }
      const word = t.kind === 'IDENT' ? lc(t.val) : ''
      const kind: ViewSpec['kind'] | null = word === 'systemlandscape' ? 'landscape'
        : word === 'systemcontext' ? 'context'
        : word === 'container' ? 'container'
        : word === 'component' ? 'component'
        : word === 'dynamic' ? 'dynamic'
        : null
      if (kind) {
        eat()
        const spec: ViewSpec = { kind, include: [], exclude: [], steps: [] }
        if (kind !== 'landscape' && peek().kind === 'IDENT') spec.scope = eat().val
        const ss = consumeStrings()
        spec.key = ss[0]
        if (peek().kind === 'LBRACE') parseViewBody(spec)
        viewSpecs.push(spec)
        continue
      }
      if (word === 'filtered' || word === 'deployment' || word === 'custom' || word === 'image') {
        eat()
        const args = restOfLine(t.line)
        const key = args.filter((a) => a.kind === 'STR').map((a) => a.val)
        const what = word === 'filtered' ? 'Filtered views' : word === 'deployment' ? 'Deployment views' : word === 'custom' ? 'Custom views' : 'Image views'
        const name = word === 'deployment' ? key[1] ?? key[0] : word === 'filtered' ? key[2] ?? key[0] : key[0]
        skipped(`${what} are not imported${name ? ` ("${name}")` : ''}.`)
        skipBlock()
        continue
      }
      // styles, themes, branding, terminology, configuration, properties
      if (t.kind === 'IDENT' && namedBlockAhead()) { eat(); restOfLine(t.line); skipBlock(); continue }
      eat()
    }
    if (peek().kind === 'RBRACE') eat()
  }

  // ── Top-level:  workspace "name" { model { ... } ... }  ──────────────────

  const root: Scope = { parentId: null, path: [], self: null }
  while (peek().kind !== 'EOF') {
    if (peek().kind === 'IDENT' && lc(peek().val) === 'workspace') {
      eat()
      if (peek().kind === 'IDENT' && lc(peek().val) === 'extends') {
        eat()
        const base = consumeStrings()[0] ?? ''
        skipped(`The workspace extends ${base || 'another workspace'}: only what it adds itself was read.`)
      }
      const wss = consumeStrings()
      if (wss[0]) workspaceName = wss[0]
      if (peek().kind !== 'LBRACE') break
      eat() // consume {

      while (peek().kind !== 'RBRACE' && peek().kind !== 'EOF') {
        const t = peek()
        if (t.kind === 'DIRECTIVE') { directive(); continue }
        if (t.kind === 'IDENT' && lc(t.val) === 'model' && peek(1).kind === 'LBRACE')  { eat(); parseModel(root); continue }
        if (t.kind === 'IDENT' && lc(t.val) === 'views' && peek(1).kind === 'LBRACE')  { eat(); parseViews(); continue }
        // name "…": the block's name, like the one after the keyword, was
        // ignored.
        if (t.kind === 'IDENT' && lc(t.val) === 'name' && peek(1).kind === 'STR') { eat(); workspaceName = eat().val; continue }
        // configuration, etc. — skip the whole block
        if (t.kind === 'IDENT' && namedBlockAhead()) { eat(); restOfLine(t.line); skipBlock(); continue }
        eat()
      }

      if (peek().kind === 'RBRACE') eat()
      break
    }
    eat()
  }

  // ── Resolve identifiers ───────────────────────────────────────────────────

  /**
   * The node an identifier names, seen from the block at `path`: its full
   * hierarchical path, a path relative to that block or one around it, then
   * a name only one element has. `this` is the element whose block it is.
   */
  function resolveId(ref: string, path: string[], self: string | null): string | null {
    const k = lc(ref)
    if (k === 'this') return self
    for (let i = path.length; i >= 0; i--) {
      const id = pathMap.get([...path.slice(0, i).map(lc), k].join('.'))
      if (id) return id
    }
    const bare = nameMap.get(k)
    if (bare) return bare
    // A dotted name that is the end of exactly one element's path.
    if (k.includes('.')) {
      const ends = [...pathMap.entries()].filter(([key]) => key.endsWith(`.${k}`))
      if (ends.length === 1) return ends[0][1]
    }
    return null
  }

  const byId = (): Record<string, C4Node> => Object.fromEntries(nodes.map((n) => [n.id, n]))
  const typeLabel = (t: string): string => metamodel.nodeTypes[t]?.label ?? t

  // ── Fit the metamodel: places ────────────────────────────────────────────
  // Parents come before their children in `nodes`, so each node is checked
  // where its parent has already been settled.
  {
    const index = byId()
    const dropped = new Set<string>()
    for (const n of [...nodes]) {
      if (dropped.has(n.id)) continue
      const parent = n.parentId ? index[n.parentId] : undefined
      if (isPlacementAllowed(metamodel, n.type, parent, index)) continue
      const where = parent ? `${typeLabel(parent.type)} "${parent.label}"` : 'the top of the model'
      if (n.type === 'group') {
        // What the group held goes to where the group stands.
        for (const child of nodes) if (child.parentId === n.id) child.parentId = n.parentId
        dropped.add(n.id)
        skipped(`Group "${n.label}" was left out: a group may not stand inside ${where}; what it held is ${parent ? `in "${parent.label}"` : 'at the top'}.`)
        continue
      }
      // Up to the nearest ancestor that may hold it, or the top.
      let up = parent?.parentId ? index[parent.parentId] : undefined
      while (up && !isPlacementAllowed(metamodel, n.type, up, index)) up = up.parentId ? index[up.parentId] : undefined
      if (up || isPlacementAllowed(metamodel, n.type, undefined, index)) {
        n.parentId = up?.id
        skipped(`${typeLabel(n.type)} "${n.label}" cannot stand inside ${where}; it was put ${up ? `in "${up.label}"` : 'at the top'}.`)
        continue
      }
      dropped.add(n.id)
      for (const d of nodes) if (d.parentId && dropped.has(d.parentId)) dropped.add(d.id)
      skipped(`${typeLabel(n.type)} "${n.label}" was left out: the metamodel has no place for it inside ${where}.`)
    }
    if (dropped.size) {
      // Identifiers of what was left out name nothing now.
      for (const [k, id] of [...pathMap]) if (dropped.has(id)) pathMap.delete(k)
      for (const [k, id] of [...nameMap]) if (id && dropped.has(id)) nameMap.delete(k)
      for (let i = nodes.length - 1; i >= 0; i--) if (dropped.has(nodes[i].id)) nodes.splice(i, 1)
    }
  }

  // ── Relationships ────────────────────────────────────────────────────────
  {
    const index = byId()
    const unresolved: string[] = []
    const refused: string[] = []
    let relIdx = 0
    for (const r of pending) {
      const srcId = resolveId(r.src, r.path, r.self)
      const tgtId = resolveId(r.tgt, r.path, r.self)
      if (!srcId || !tgtId) {
        unresolved.push(`${r.src} -> ${r.tgt}${r.label ? ` "${r.label}"` : ''}`)
        continue
      }
      if (srcId === tgtId) continue
      const from = index[srcId], to = index[tgtId]
      if (!from || !to) continue
      if (!isRelationAllowed(metamodel, from.type, to.type)) {
        refused.push(`"${from.label}" -> "${to.label}"${r.label ? ` "${r.label}"` : ''}`)
        continue
      }
      // Skip only a relationship given twice: two between the same pair that
      // say different things ("Reads orders", "Writes orders") are both kept.
      if (relations.some(x => x.sourceId === srcId && x.targetId === tgtId
        && (x.label ?? '') === (r.label ?? '') && (x.technology ?? '') === (r.technology ?? ''))) continue
      relations.push({
        id:         `rel-${++relIdx}`,
        sourceId:   srcId,
        targetId:   tgtId,
        label:      r.label,
        technology: r.technology,
      })
    }
    if (unresolved.length) skipped(`${unresolved.length} relationship${unresolved.length === 1 ? '' : 's'} name${unresolved.length === 1 ? 's' : ''} an element the workspace does not define (or two elements share the name): ${unresolved.join('; ')}.`)
    if (refused.length) skipped(`${refused.length} relationship${refused.length === 1 ? '' : 's'} between types the metamodel does not relate ${refused.length === 1 ? 'was' : 'were'} left out: ${refused.join('; ')}.`)
  }

  // ── Views ────────────────────────────────────────────────────────────────

  const sequences: DiagramSequence[] = []
  const views: DiagramView[] = []
  {
    const index = byId()
    const levelOf = (n: C4Node | undefined): Level | null => !n ? null
      : n.type === 'person' ? 'person'
      : n.type === 'system' ? 'system'
      : n.type === 'component' ? 'component'
      : n.type === 'group' ? null
      : 'container'
    /** The node itself or its nearest ancestor at `level`. */
    const upTo = (id: string, level: Level): string | null => {
      let cur: C4Node | undefined = index[id]
      while (cur && levelOf(cur) !== level) cur = cur.parentId ? index[cur.parentId] : undefined
      return cur?.id ?? null
    }
    /** A person, or the software system the element is part of. */
    const asSystem = (id: string): string | null => levelOf(index[id]) === 'person' ? id : upTo(id, 'system')
    const within = (id: string, ancestor: string): boolean => {
      let cur: C4Node | undefined = index[id]
      while (cur) { if (cur.id === ancestor) return true; cur = cur.parentId ? index[cur.parentId] : undefined }
      return false
    }
    const takenNames = new Set<string>()
    const unique = (name: string): string => {
      let out = name
      for (let i = 2; takenNames.has(out); i++) out = `${name} ${i}`
      takenNames.add(out)
      return out
    }

    for (const [i, spec] of viewSpecs.entries()) {
      const scopeId = spec.scope && spec.scope !== '*' ? resolveId(spec.scope, [], null) : null
      const scope = scopeId ? index[scopeId] : undefined
      if (spec.scope && spec.scope !== '*' && !scope) {
        skipped(`View "${spec.title ?? spec.key ?? spec.scope}" was not imported: "${spec.scope}" names no element.`)
        continue
      }
      const ids = new Set<string>()
      if (spec.include.includes('*')) {
        if (spec.kind === 'landscape') {
          for (const n of nodes) if (levelOf(n) === 'person' || (levelOf(n) === 'system' && !upTo(n.parentId ?? '', 'system'))) ids.add(n.id)
        } else if (spec.kind === 'context' && scope) {
          ids.add(scope.id)
          for (const r of relations) {
            const a = asSystem(r.sourceId), b = asSystem(r.targetId)
            if (a === scope.id && b && b !== scope.id) ids.add(b)
            if (b === scope.id && a && a !== scope.id) ids.add(a)
          }
        } else if (spec.kind === 'container' && scope) {
          // The system is the boundary its containers are drawn in.
          ids.add(scope.id)
          for (const n of nodes) if (levelOf(n) === 'container' && upTo(n.id, 'system') === scope.id) ids.add(n.id)
          for (const r of relations) {
            for (const [mine, other] of [[r.sourceId, r.targetId], [r.targetId, r.sourceId]]) {
              if (!within(mine, scope.id) || within(other, scope.id)) continue
              const o = asSystem(other)
              if (o) ids.add(o)
            }
          }
        } else if (spec.kind === 'component' && scope) {
          const system = upTo(scope.id, 'system')
          ids.add(scope.id)
          for (const n of nodes) if (n.type === 'component' && upTo(n.id, 'container') === scope.id) ids.add(n.id)
          for (const r of relations) {
            for (const [mine, other] of [[r.sourceId, r.targetId], [r.targetId, r.sourceId]]) {
              if (!within(mine, scope.id) || within(other, scope.id)) continue
              const o = system && within(other, system) ? upTo(other, 'container') : asSystem(other)
              if (o) ids.add(o)
            }
          }
        }
      }
      for (const ref of spec.include) {
        if (ref === '*') continue
        const id = resolveId(ref, [], null)
        if (id) ids.add(id)
        else skipped(`View "${spec.title ?? spec.key ?? ''}" includes "${ref}", which names no element.`)
      }
      for (const ref of spec.exclude) {
        const id = resolveId(ref, [], null)
        if (id) ids.delete(id)
      }

      const kindName = spec.kind === 'landscape' ? 'System Landscape'
        : spec.kind === 'context' ? `System Context of ${scope?.label}`
        : spec.kind === 'container' ? `Containers of ${scope?.label}`
        : spec.kind === 'component' ? `Components of ${scope?.label}`
        : scope ? `Dynamic view of ${scope.label}` : 'Dynamic view'
      const name = unique(spec.title || spec.key || kindName)
      const view: DiagramView = { id: `view-${i + 1}`, name, nodeIds: [], positions: {} }

      if (spec.kind === 'dynamic') {
        const relationIds: string[] = []
        const notes: (string | undefined)[] = []
        const missing: string[] = []
        for (const step of spec.steps) {
          const a = resolveId(step.src, [], null), b = resolveId(step.tgt, [], null)
          // Of two relationships between the pair, the one the step's
          // description names, as Structurizr picks it; else the first.
          const between = a && b ? relations.filter((r) => r.sourceId === a && r.targetId === b) : []
          const found = between.find((r) => step.description !== undefined && r.label === step.description) ?? between[0]
          if (!found) { missing.push(`${step.src} -> ${step.tgt}`); continue }
          relationIds.push(found.id)
          notes.push(step.description && step.description !== found.label ? step.description : undefined)
          ids.add(found.sourceId); ids.add(found.targetId)
        }
        if (missing.length) skipped(`View "${name}": ${missing.length} step${missing.length === 1 ? '' : 's'} with no relationship between ${missing.length === 1 ? 'its' : 'their'} elements left out (${missing.join('; ')}).`)
        if (relationIds.length) {
          const seq: DiagramSequence = { id: `seq-${sequences.length + 1}`, name, relationIds }
          if (notes.some((d) => d)) seq.stepDescriptions = notes
          sequences.push(seq)
          view.kind = 'dynamic'
          view.sequenceId = seq.id
        }
      }

      if (ids.size === 0) {
        takenNames.delete(name)
        skipped(`View "${name}" was not imported: it shows no element.`)
        continue
      }
      // The groups an element shown is in (up to the element that holds
      // them), as Structurizr draws a boundary round them: the views left
      // the workspace's groups out. A flow draws its participants only.
      if (view.kind !== 'dynamic') {
        for (const id of [...ids]) {
          for (let up = index[id]?.parentId; up && index[up]?.type === 'group'; up = index[up].parentId) ids.add(up)
        }
      }
      // Listed in model order; an element shown without any of what it
      // holds is drawn folded, as Structurizr draws a box.
      view.nodeIds = nodes.filter((n) => ids.has(n.id)).map((n) => n.id)
      const folded = view.nodeIds.filter((id) => nodes.some((n) => n.parentId === id) && !nodes.some((n) => ids.has(n.id) && n.id !== id && within(n.id, id)))
      if (folded.length) view.collapsedNodeIds = folded
      views.push(view)
    }
  }

  return { nodes, relations, sequences, views, name: workspaceName, notRead }
}
