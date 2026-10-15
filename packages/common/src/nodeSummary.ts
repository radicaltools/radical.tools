// ─── Element summary ────────────────────────────────────────────────────────
// What an element says in one line, made of the data it already has by its
// type's summary template (NodeTypeDef.summary): a requirement its EARS
// sentence, a scenario its When → then, an ADR its status and the first
// sentence of its decision, … The table view shows it beside each name.
//
// A template is text with tokens: {key} is the element's value for key (a
// property, or label, description, technology, type) on one line, a ref
// property the names of the elements it points at, and {ears} a
// requirement's EARS sentence; {key.sentence} takes the first sentence
// only, {key.cap} starts it with a capital. A part in [ ] is left out when
// a token in it is empty; \[ and \] are brackets themselves. A type without
// a template of its own takes the built-in one for its id (DEFAULT_SUMMARIES),
// else the first sentence of the description, as does an element whose
// template comes out empty.

import type { C4Node, C4Relation } from './c4'
import type { Metamodel } from './metamodel/types'
import { composeEarsSentence, firstParagraph, requirementStatePhrase, resolveEarsSubject } from './metamodel'

const C4_SUMMARY = '[\\[{technology}\\] ]{description.sentence}'

/** The built-in types' templates. */
export const DEFAULT_SUMMARIES: Record<string, string> = {
  person: C4_SUMMARY,
  system: C4_SUMMARY,
  container: C4_SUMMARY,
  component: C4_SUMMARY,
  database: C4_SUMMARY,
  webapp: C4_SUMMARY,
  queue: C4_SUMMARY,
  requirement: '{ears}',
  scenario: '[When {when}][ → then {then}]',
  adr: '[{status.cap}: ]{decision.sentence}',
  'fitness-fn': '{description.sentence}[ — threshold {threshold}]',
  mockup: '{screen}[ — {description.sentence}]',
  blueprint: '[{status.cap}][ · {domain}][: {description.sentence}]',
}

const FALLBACK = '{description.sentence}'

/** The template elements of `type` are summed up by. */
export function summaryTemplate(type: string, metamodel: Metamodel | undefined): string {
  const own = metamodel?.nodeTypes[type]?.summary
  return own?.trim() ? own : DEFAULT_SUMMARIES[type] ?? FALLBACK
}

/** The tokens a template of `type` can use, for the metamodel editor. */
export function summaryTokens(type: string, metamodel: Metamodel | undefined): string[] {
  const props = (metamodel?.nodeTypes[type]?.properties ?? []).map((p) => p.key)
  const ears = props.includes('action') ? ['ears'] : []
  return [...new Set(['label', 'description', 'technology', ...ears, ...props])]
}

/** One line of running text: whitespace and Markdown heading marks folded. */
function line(text: unknown): string {
  return typeof text === 'string' ? firstParagraph(text).replace(/^#+\s*/gm, '').replace(/\s+/g, ' ').trim() : ''
}

/** The first sentence of a text, as one line. */
function sentence(text: string): string {
  const end = text.search(/[.!?](\s|$)/)
  return end >= 0 ? text.slice(0, end + 1) : text
}

interface Ctx {
  node: C4Node
  nodes: Record<string, C4Node>
  relations: Record<string, C4Relation>
  metamodel: Metamodel | undefined
}

function tokenValue(token: string, ctx: Ctx): string {
  const [key, ...mods] = token.trim().split('.')
  const { node, nodes, relations, metamodel } = ctx
  const p = node as unknown as Record<string, unknown>
  let value: string
  if (key === 'ears') {
    value = line(p.action) ? composeEarsSentence(p, resolveEarsSubject(node.id, relations, nodes), requirementStatePhrase(node, nodes, relations) || undefined).sentence : ''
  } else if (key === 'type') {
    value = metamodel?.nodeTypes[node.type]?.label ?? node.type
  } else {
    const raw = p[key]
    const def = metamodel?.nodeTypes[node.type]?.properties?.find((d) => d.key === key)
    const values = (Array.isArray(raw) ? raw : raw === undefined || raw === null ? [] : [raw])
      .map((v) => (def?.type === 'ref' ? nodes[String(v)]?.label ?? '' : typeof v === 'boolean' ? (v ? def?.label ?? key : '') : line(String(v))))
      .filter(Boolean)
    value = values.join(', ')
  }
  if (mods.includes('sentence')) value = sentence(value)
  if (mods.includes('cap')) value = value.charAt(0).toUpperCase() + value.slice(1)
  return value
}

/** `template` read from `at`: its text, and whether every token in it had a value. */
function render(template: string, ctx: Ctx, at = 0, inGroup = false): { text: string; full: boolean; end: number } {
  let text = ''
  let full = true
  let i = at
  while (i < template.length) {
    const ch = template[i]
    if (ch === '\\' && i + 1 < template.length) { text += template[i + 1]; i += 2; continue }
    if (ch === ']' && inGroup) return { text, full, end: i + 1 }
    if (ch === '[') {
      const group = render(template, ctx, i + 1, true)
      if (group.full) text += group.text
      i = group.end
      continue
    }
    if (ch === '{') {
      const close = template.indexOf('}', i)
      if (close < 0) { text += template.slice(i); break }
      const value = tokenValue(template.slice(i + 1, close), ctx)
      if (!value) full = false
      text += value
      i = close + 1
      continue
    }
    text += ch
    i++
  }
  return { text, full, end: template.length }
}

/** `node`'s summary by its type's template; the first sentence of its
 *  description when that comes out empty. */
export function nodeSummary(node: C4Node, nodes: Record<string, C4Node>, relations: Record<string, C4Relation>, metamodel?: Metamodel): string {
  const ctx: Ctx = { node, nodes, relations, metamodel }
  const tidy = (s: string) => s.replace(/\s+/g, ' ').replace(/^[\s·:—–,;→-]+|[\s·:—–,;→-]+$/g, '').trim()
  return tidy(render(summaryTemplate(node.type, metamodel), ctx).text) || tidy(render(FALLBACK, ctx).text)
}
