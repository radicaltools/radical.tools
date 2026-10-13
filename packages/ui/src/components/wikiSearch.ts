// ─── Search of the wiki's pages ──────────────────────────────────────────────
//
// What the search box above the list of pages looks through: the name of an
// element and what its page says in words (its description, the sentence of
// a requirement, its long and short text fields). A page found by its text
// rather than its name is listed with the words around the match, so that
// the list shows why it is there.

import { composeEarsSentence, resolveEarsSubject, type Metamodel } from '@radical/common/metamodel'
import type { C4Node, C4Relation } from '@radical/common/c4'

/** A property label as a heading: without the hint a form puts in brackets
 *  ("Source (who / where from)" → "Source"). */
export function fieldTitle(label: string): string {
  return label.replace(/\s*\([^)]*\)\s*$/, '') || label
}

// The parts of a requirement that its sentence already says.
const EARS_CLAUSE_KEYS: ReadonlySet<string> = new Set(['trigger', 'precondition', 'unwanted_condition', 'feature', 'action'])

export interface WikiSearchText {
  /** The field the text is from; none for the description and the sentence
   *  of a requirement, which a page writes without a heading. */
  field?: string
  text: string
}

/** What the page of `node` says in words, in the order the page says it. */
export function searchableTexts(
  node: C4Node,
  nodes: Record<string, C4Node>,
  relations: Record<string, C4Relation>,
  metamodel: Metamodel | null | undefined,
): WikiSearchText[] {
  const values = node as unknown as Record<string, unknown>
  const texts: WikiSearchText[] = []
  const add = (text: unknown, field?: string): void => {
    if (typeof text === 'string' && text.trim()) texts.push({ field, text })
  }
  add(node.description)
  const isRequirement = node.type === 'requirement'
  if (isRequirement) add(composeEarsSentence(values, resolveEarsSubject(node.id, relations, nodes)).sentence)
  const props = metamodel?.nodeTypes[node.type]?.properties
  if (!props) {
    add(node.technology, 'Technology')
    return texts
  }
  for (const p of props) {
    if (p.type !== 'text' && p.type !== 'textarea') continue
    if (p.key === 'label' || p.key === 'description') continue
    if (isRequirement && EARS_CLAUSE_KEYS.has(p.key)) continue
    add(values[p.key], fieldTitle(p.label))
  }
  return texts
}

export interface WikiSearchHit {
  /** Where the name matches, or -1 when only the text does. */
  nameAt: number
  /** The words around the first match in the text, when the name does not
   *  match: what to show under the name. */
  snippet?: { field?: string; before: string; match: string; after: string }
}

// How much of the text is shown before and after the match.
const SNIPPET_BEFORE = 28
const SNIPPET_AFTER = 64

/** How `node` matches `query` (already trimmed and in lower case), or null
 *  when neither its name nor its text has it. */
export function wikiSearchHit(
  node: C4Node,
  query: string,
  nodes: Record<string, C4Node>,
  relations: Record<string, C4Relation>,
  metamodel: Metamodel | null | undefined,
): WikiSearchHit | null {
  if (!query) return null
  const nameAt = node.label.toLowerCase().indexOf(query)
  if (nameAt >= 0) return { nameAt }
  for (const { field, text } of searchableTexts(node, nodes, relations, metamodel)) {
    // One line of text: a snippet has no room for the breaks of a paragraph.
    const flat = text.replace(/\s+/g, ' ').trim()
    const at = flat.toLowerCase().indexOf(query)
    if (at < 0) continue
    const start = Math.max(0, at - SNIPPET_BEFORE)
    const end = Math.min(flat.length, at + query.length + SNIPPET_AFTER)
    return {
      nameAt: -1,
      snippet: {
        field,
        before: (start > 0 ? '…' : '') + flat.slice(start, at),
        match: flat.slice(at, at + query.length),
        after: flat.slice(at + query.length, end) + (end < flat.length ? '…' : ''),
      },
    }
  }
  return null
}
