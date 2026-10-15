// ─── Element summary ────────────────────────────────────────────────────────
// What an element says in one line, made of the data it already has by its
// type's summary template (NodeTypeDef.summary). The table view shows it
// beside each name. A line starts with what matters and ends with detail,
// so that what the cell cuts off is detail: a requirement who shall do what,
// then when; a scenario its outcome, then when; a state where it leads; a
// domain its kind first. What matters is bold (who shall do what, the
// outcome, the status, the state it leads to); the rest is plain. It is
// never empty when the element has anything to say.
//
// A template is text with tokens: {key} is the element's value for key (a
// property, or label, description, technology, type) on one line, a ref
// property the names of the elements it points at; for a requirement {ears}
// is its EARS sentence, {obligation} who shall do what (the action's first
// phrase) and {condition} the when/while/if/where it holds under (ears.ts,
// earsSummaryParts); {transitions} where a state machine goes from a state
// or on an event; {out:type} and {in:type} the names of the elements linked
// by relations of that type. {key.sentence} takes the first sentence only,
// {key.phrase} the first phrase (up to a colon, semicolon or dash aside),
// {key.cap} starts it with a capital, {key.bold} makes it bold as a whole,
// and {a|b} is the first of a and b that has a value. A part in [ ] is left
// out when a token in it is empty; \[ and \] are brackets themselves. A type
// without a template of its own takes the built-in one for its id
// (DEFAULT_SUMMARIES), else the first sentence of the description, as does
// an element whose template comes out empty.
//
// A summary is inline Markdown (markdown.ts): the template's own text may
// use it ("**{status.cap}**: …"), a Markdown field (description, a
// textarea) and a requirement's EARS sentence go in as they are, and a
// plain value is escaped. The table renders it; markdownToPlain makes plain
// text of it.

import type { C4Node, C4Relation } from './c4'
import type { Metamodel } from './metamodel/types'
import { escapeMarkdown, isMarkdownField, markdownToPlain } from './markdown'
import { composeEarsSentence, earsSummaryParts, firstParagraph, firstPhrase, requirementStatePhrase, resolveEarsSubject } from './metamodel'

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
  requirement: '[{obligation.bold}][ — {condition}]',
  scenario: '[{then.phrase.cap.bold}][ — when {when}]',
  adr: '[{status.cap.bold}: ]{decision.sentence}',
  'fitness-fn': '{description.sentence}[ — threshold {threshold.bold}]',
  domain: '[{kind.cap.bold} · ]{description.sentence}',
  'state-machine': '[Lifecycle of {out:lifecycle-of.bold}: ]{description.sentence}',
  state: '{description.sentence|transitions.cap|kind.cap}',
  pseudostate: '[{kind.cap.bold}][ {transitions}]',
  event: '{description.sentence|transitions}',
  mockup: '[{screen.bold}][ — {description.sentence}]',
  blueprint: '[{status.cap.bold}][ · {domain}][: {description.sentence}]',
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
  const ears = props.includes('action') ? ['ears', 'obligation', 'condition'] : []
  const moves = ['state', 'pseudostate', 'event'].includes(type) ? ['transitions'] : []
  return [...new Set(['label', 'description', 'technology', ...ears, ...moves, ...props])]
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

const nameOf = (id: string, nodes: Record<string, C4Node>) => escapeMarkdown(nodes[id]?.label ?? '')

/** The ids of the events a transition fires on. */
function transitionEvents(rel: C4Relation): string[] {
  const raw = (rel as unknown as Record<string, unknown>).event
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map(String)
}

/** Where the state machine goes from here, in a line, the state it leads
 *  to in bold: for an event the moves it makes ("Loading → **Ready**"),
 *  for a state or pseudostate its ways
 *  out ("on Files changed → Reloading", "→ Loading" without an event). */
function transitionsOf(node: C4Node, nodes: Record<string, C4Node>, relations: Record<string, C4Relation>): string {
  const all = Object.values(relations).filter((r) => r.relationType === 'transition')
  const moves = node.type === 'event'
    ? all.filter((r) => transitionEvents(r).includes(node.id)).map((r) => `${nameOf(r.sourceId, nodes)} → **${nameOf(r.targetId, nodes)}**`)
    : all.filter((r) => r.sourceId === node.id).map((r) => {
        const on = transitionEvents(r).map((e) => nameOf(e, nodes)).filter(Boolean).join(' or ')
        return `${on ? `on ${on} ` : ''}→ **${nameOf(r.targetId, nodes)}**`
      })
  return [...new Set(moves)].join('; ')
}

/** The names of the elements linked to `node` by relations of `type`:
 *  `out` those it points at, `in` those pointing at it. */
function linkedNames(node: C4Node, nodes: Record<string, C4Node>, relations: Record<string, C4Relation>, dir: 'out' | 'in', type: string): string {
  const ids = Object.values(relations)
    .filter((r) => r.relationType === type && (dir === 'out' ? r.sourceId === node.id : r.targetId === node.id))
    .map((r) => (dir === 'out' ? r.targetId : r.sourceId))
  return [...new Set(ids)].map((id) => nameOf(id, nodes)).filter(Boolean).join(', ')
}

/** A token's value: the first of its alternatives (`{a|b}`) that has one. */
function tokenValue(token: string, ctx: Ctx): string {
  for (const alternative of token.split('|')) {
    const value = singleTokenValue(alternative, ctx)
    if (value) return value
  }
  return ''
}

function singleTokenValue(token: string, ctx: Ctx): string {
  const [key, ...mods] = token.trim().split('.')
  const { node, nodes, relations, metamodel } = ctx
  const p = node as unknown as Record<string, unknown>
  let value: string
  const link = /^(out|in):(.+)$/.exec(key)
  if (link) {
    value = linkedNames(node, nodes, relations, link[1] as 'out' | 'in', link[2])
  } else if (key === 'transitions') {
    value = transitionsOf(node, nodes, relations)
  } else if (key === 'ears') {
    // Prose of the requirement's own fields (its action is a textarea): Markdown.
    value = line(p.action) ? line(composeEarsSentence(p, resolveEarsSubject(node.id, relations, nodes), requirementStatePhrase(node, nodes, relations) || undefined).sentence) : ''
  } else if (key === 'obligation' || key === 'condition') {
    value = line(earsSummaryParts(p, resolveEarsSubject(node.id, relations, nodes), requirementStatePhrase(node, nodes, relations) || undefined)[key])
  } else if (key === 'type') {
    value = escapeMarkdown(metamodel?.nodeTypes[node.type]?.label ?? node.type)
  } else {
    const raw = p[key]
    const def = metamodel?.nodeTypes[node.type]?.properties?.find((d) => d.key === key)
    const markdown = isMarkdownField(key, def)
    const values = (Array.isArray(raw) ? raw : raw === undefined || raw === null ? [] : [raw])
      .map((v) => (def?.type === 'ref' ? nodes[String(v)]?.label ?? '' : typeof v === 'boolean' ? (v ? def?.label ?? key : '') : line(String(v))))
      .filter(Boolean)
      .map((v) => (markdown ? v : escapeMarkdown(v)))
    value = values.join(', ')
  }
  if (mods.includes('sentence')) value = sentence(value)
  if (mods.includes('phrase')) value = firstPhrase(value)
  // The first letter, past any marks before it ("**accepted**").
  if (mods.includes('cap')) value = value.replace(/^([^\p{L}\p{N}]*)(\p{L})/u, (_, marks: string, letter: string) => marks + letter.toUpperCase())
  // Bold as a whole: bold inside it would end it early.
  if (mods.includes('bold') && value) value = `**${value.replace(/\*\*|__/g, '')}**`
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

/** `node`'s summary by its type's template, as inline Markdown; the first
 *  sentence of its description when that comes out empty. */
export function nodeSummary(node: C4Node, nodes: Record<string, C4Node>, relations: Record<string, C4Relation>, metamodel?: Metamodel): string {
  const ctx: Ctx = { node, nodes, relations, metamodel }
  const tidy = (s: string) => s.replace(/\s+/g, ' ').replace(/^[\s·:—–,;→-]+|[\s·:—–,;→-]+$/g, '').trim()
  return tidy(render(summaryTemplate(node.type, metamodel), ctx).text) || tidy(render(FALLBACK, ctx).text)
}

/** What the tooltip of `node`'s summary says, in plain text: a
 *  requirement's whole EARS sentence, else the summary itself. */
export function nodeSummaryDetail(node: C4Node, nodes: Record<string, C4Node>, relations: Record<string, C4Relation>, metamodel?: Metamodel): string {
  const p = node as unknown as Record<string, unknown>
  const text = line(p.action)
    ? composeEarsSentence(p, resolveEarsSubject(node.id, relations, nodes), requirementStatePhrase(node, nodes, relations) || undefined).sentence
    : nodeSummary(node, nodes, relations, metamodel)
  return markdownToPlain(text)
}
