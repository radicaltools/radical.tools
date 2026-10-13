// ─── Prose ─────────────────────────────────────────────────────────────────
//
// The words the wiki view writes from model data, so that a page reads as
// text rather than as a form: a relation read as a sentence from either of
// its ends, a property value as a phrase, a count of elements in words.

import type { C4Node, C4Relation } from '../c4'
import type { Metamodel, PropertyDef, RelationTypeDef } from './types'
import { inferRelationType } from './lookup'
import { refLabels } from './refs'

/** Which end of a relation the page's element is at: its source or target. */
export type RelationDirection = 'out' | 'in'

export interface RelationPhrase {
  text: string
  /** False when the type has no `inverseLabel`: `text` is then its label,
   *  which reads from the other end and cannot start a sentence here. */
  reads: boolean
}

/** How relations of one type read from the element at the `direction` end:
 *  "Constrains" from the source, "Constrained by" from the target. */
export function relationPhrase(def: RelationTypeDef | undefined, direction: RelationDirection): RelationPhrase {
  if (!def) return { text: direction === 'out' ? 'Relates to' : 'Linked from', reads: true }
  if (direction === 'out') return { text: def.forwardLabel?.trim() || def.label, reads: true }
  const inverse = def.inverseLabel?.trim()
  return inverse ? { text: inverse, reads: true } : { text: def.label, reads: false }
}

export interface RelationSentence {
  direction: RelationDirection
  /** Undefined for relations without a type. */
  typeId: string | undefined
  phrase: RelationPhrase
  /** The relations the sentence lists, by the label of the element at
   *  their far end. */
  relations: C4Relation[]
}

/** The type a relation reads as: its own, or else the one type the metamodel
 *  allows between its two ends (a relation drawn before the model had a
 *  metamodel has none). Undefined when neither says. */
export function relationTypeForProse(
  relation: C4Relation,
  nodes: Record<string, C4Node>,
  metamodel: Metamodel | undefined,
): string | undefined {
  if (relation.relationType && metamodel?.relationTypes[relation.relationType]) return relation.relationType
  const source = nodes[relation.sourceId]
  const target = nodes[relation.targetId]
  return source && target ? inferRelationType(metamodel, source.type, target.type) : undefined
}

/** The relations of `nodeId` as sentences, one per direction and relation
 *  type: outgoing first, each in the order of the metamodel's types. */
export function relationSentences(
  nodeId: string,
  relations: C4Relation[],
  nodes: Record<string, C4Node>,
  metamodel: Metamodel | undefined,
): RelationSentence[] {
  const typeOrder = Object.keys(metamodel?.relationTypes ?? {})
  const rank = (typeId: string | undefined): number => {
    const i = typeId ? typeOrder.indexOf(typeId) : -1
    return i < 0 ? typeOrder.length : i
  }
  const sentences: RelationSentence[] = []
  for (const direction of ['out', 'in'] as const) {
    const byType = new Map<string | undefined, C4Relation[]>()
    for (const r of relations) {
      if ((direction === 'out' ? r.sourceId : r.targetId) !== nodeId) continue
      const typeId = relationTypeForProse(r, nodes, metamodel)
      const list = byType.get(typeId) ?? []
      list.push(r)
      byType.set(typeId, list)
    }
    const otherLabel = (r: C4Relation): string => nodes[direction === 'out' ? r.targetId : r.sourceId]?.label ?? ''
    for (const typeId of [...byType.keys()].sort((a, b) => rank(a) - rank(b))) {
      sentences.push({
        direction,
        typeId,
        phrase: relationPhrase(typeId ? metamodel?.relationTypes[typeId] : undefined, direction),
        relations: byType.get(typeId)!.sort((a, b) => otherLabel(a).localeCompare(otherLabel(b))),
      })
    }
  }
  return sentences
}

/** A property value as a phrase, or '' when there is nothing to say: the
 *  labels of referenced nodes, the label of a boolean that is set, the value
 *  itself otherwise. */
export function propertyText(def: PropertyDef, value: unknown, nodes: Record<string, C4Node>): string {
  if (def.type === 'ref') return refLabels(value, nodes).join(', ')
  if (def.type === 'boolean') return value ? def.label.toLowerCase() : ''
  if (value == null) return ''
  return String(value).trim()
}

/** What a sentence adds in brackets after a relation's far end: the
 *  relation's own label, then the properties that are set. An enum still at
 *  its default says nothing. */
export function relationDetails(relation: C4Relation, def: RelationTypeDef | undefined, nodes: Record<string, C4Node>): string[] {
  const details: string[] = []
  const label = relation.label?.trim()
  if (label) details.push(label)
  const values = relation as unknown as Record<string, unknown>
  for (const p of def?.properties ?? []) {
    if (p.type === 'enum' && values[p.key] === p.default) continue
    const text = propertyText(p, values[p.key], nodes)
    if (text) details.push(p.type === 'number' ? `${p.label.toLowerCase()} ${text}` : text)
  }
  if (!def && relation.technology?.trim()) details.push(relation.technology.trim())
  return details
}

const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']

/** A count as prose writes it: in words up to twelve, in digits beyond. */
export function countWord(n: number): string {
  return COUNT_WORDS[n] ?? String(n)
}

/** A type label inside a sentence: "Software System" → "software system".
 *  Acronyms and words with capitals of their own (ADR, iOS) stay as they are. */
export function typeNoun(label: string, plural = false): string {
  const words = label.trim().split(/\s+/).map((w) => (/^[A-Z][a-z]+$/.test(w) ? w.toLowerCase() : w))
  if (plural && words.length > 0) words[words.length - 1] = pluralise(words[words.length - 1])
  return words.join(' ')
}

function pluralise(word: string): string {
  if (word === 'person') return 'people'
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`
  if (/(s|x|z|ch|sh)$/.test(word)) return `${word}es`
  return `${word}s`
}

/** "three domains", or "three elements" when they are of several types. */
export function countedNoun(count: number, typeLabels: string[]): string {
  const distinct = [...new Set(typeLabels)]
  const noun = distinct.length === 1 ? typeNoun(distinct[0], count !== 1) : count === 1 ? 'element' : 'elements'
  return `${countWord(count)} ${noun}`
}

/** The first paragraph of a longer text: what a page says about an element
 *  that it only mentions. */
export function firstParagraph(text: string | undefined): string {
  return (text ?? '').trim().split(/\n\s*\n/)[0]?.trim() ?? ''
}
