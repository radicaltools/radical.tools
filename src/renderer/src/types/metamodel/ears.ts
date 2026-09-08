// ─── EARS (Easy Approach to Requirements Syntax) helpers ───────────────────
//
// Composes/parses the free-text sentence for a `requirement` node's fields.
// This is domain logic for the governance preset's Requirement type, not
// part of the generic metamodel engine.

function capitalize(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1) }

/**
 * Compose the EARS requirement sentence from a node's fields.
 * Returns an object with `sentence` (the full EARS statement) and
 * `template` (the pattern with placeholders for empty fields).
 *
 * Templates:
 *  ubiquitous:         "The <system> shall <action>."
 *  event-driven:       "When <trigger>, the <system> shall <action>."
 *  state-driven:       "While <precondition>, the <system> shall <action>."
 *  unwanted-behaviour: "If <condition>, then the <system> shall <action>."
 *  optional:           "Where <feature>, the <system> shall <action>."
 *  complex:            "While <pre>, when <trigger>, the <system> shall <action>."
 */
export function composeEarsSentence(node: Record<string, unknown>, subject?: string): { sentence: string; complete: boolean } {
  const earsType = String(node.ears_type ?? 'ubiquitous')
  const subj = (subject || 'the system').trim()
  const action = String(node.action ?? '').trim()
  const trigger = String(node.trigger ?? '').trim()
  const precondition = String(node.precondition ?? '').trim()
  const unwanted = String(node.unwanted_condition ?? '').trim()
  const feature = String(node.feature ?? '').trim()

  const actionPart = action || '‹action›'
  const shallClause = `${subj} shall ${actionPart}`

  let sentence: string
  let complete = !!action

  switch (earsType) {
    case 'event-driven':
      sentence = `When ${trigger || '‹trigger›'}, ${shallClause}.`
      complete = complete && !!trigger
      break
    case 'state-driven':
      sentence = `While ${precondition || '‹precondition›'}, ${shallClause}.`
      complete = complete && !!precondition
      break
    case 'unwanted-behaviour':
      sentence = `If ${unwanted || '‹condition›'}, then ${shallClause}.`
      complete = complete && !!unwanted
      break
    case 'optional':
      sentence = `Where ${feature || '‹feature›'}, ${shallClause}.`
      complete = complete && !!feature
      break
    case 'complex': {
      const parts: string[] = []
      if (precondition) parts.push(`While ${precondition}`)
      if (trigger) parts.push(`when ${trigger}`)
      if (unwanted) parts.push(`if ${unwanted}`)
      if (feature) parts.push(`where ${feature}`)
      const hasCondition = parts.length > 0
      if (!hasCondition) parts.push('‹conditions›')
      else parts[0] = capitalize(parts[0])
      sentence = `${parts.join(', ')}, ${shallClause}.`
      complete = complete && hasCondition
      break
    }
    default: // ubiquitous
      sentence = `${capitalize(subj)} shall ${actionPart}.`
      break
  }

  return { sentence, complete }
}

const EARS_CLAUSE_KEYWORDS: {
  re: RegExp
  slot: 'trigger' | 'precondition' | 'unwanted_condition' | 'feature'
  type: 'event-driven' | 'state-driven' | 'unwanted-behaviour' | 'optional'
}[] = [
  { re: /^while\b/i, slot: 'precondition', type: 'state-driven' },
  { re: /^when(ever)?\b/i, slot: 'trigger', type: 'event-driven' },
  { re: /^if\b/i, slot: 'unwanted_condition', type: 'unwanted-behaviour' },
  { re: /^where\b/i, slot: 'feature', type: 'optional' },
]

export interface ParsedEarsSentence {
  ears_type: string
  action: string
  trigger?: string
  precondition?: string
  unwanted_condition?: string
  feature?: string
}

/**
 * Heuristically parse a free-text requirement sentence into EARS fields, so
 * a user can type "When the user clicks save, the system shall persist the
 * document" instead of first picking an ears_type from a list.
 *
 * Approach: split the sentence at its LAST "shall"/"must" — everything
 * after is the action, everything before is scanned (comma-separated) for
 * leading when/while/if/where clauses. The last occurrence is used (rather
 * than the first) because a condition clause may itself contain "must"
 * (e.g. "If the request must be retried, the system shall queue it."); the
 * action-introducing shall/must is the one right before the subject. One
 * matched keyword picks the corresponding single EARS type; more than one
 * makes it 'complex'; none (or no shall/must at all) falls back to
 * 'ubiquitous' with the whole sentence as the action. This is a best-effort
 * heuristic, not a grammar — unmatched wording is simply left out of the
 * parsed slots.
 */
export function parseEarsSentence(input: string): ParsedEarsSentence {
  const text = input.trim().replace(/\.+$/, '')
  if (!text) return { ears_type: 'ubiquitous', action: '' }

  const shallMatches = [...text.matchAll(/\b(shall|must)\b/gi)]
  if (shallMatches.length === 0) {
    return { ears_type: 'ubiquitous', action: text }
  }
  const shallMatch = shallMatches[shallMatches.length - 1]

  const conditionPart = text.slice(0, shallMatch.index).trim()
  const action = text.slice(shallMatch.index! + shallMatch[0].length).trim()

  const slots: Partial<Pick<ParsedEarsSentence, 'trigger' | 'precondition' | 'unwanted_condition' | 'feature'>> = {}
  for (const segment of conditionPart.split(',').map(s => s.trim()).filter(Boolean)) {
    for (const { re, slot } of EARS_CLAUSE_KEYWORDS) {
      if (re.test(segment)) {
        const value = segment.replace(re, '').trim()
        if (value) slots[slot] = value
        break
      }
    }
  }

  const foundSlots = Object.keys(slots) as (keyof typeof slots)[]
  const ears_type = foundSlots.length > 1
    ? 'complex'
    : foundSlots.length === 1
      ? EARS_CLAUSE_KEYWORDS.find(k => k.slot === foundSlots[0])!.type
      : 'ubiquitous'

  return { ears_type, action, ...slots }
}

/** Resolve the EARS subject for a requirement by finding 'satisfies' relations pointing to it. */
export function resolveEarsSubject(
  reqId: string,
  relations: Record<string, { sourceId: string; targetId: string; relationType?: string }>,
  nodes: Record<string, { label: string }>,
): string | undefined {
  for (const rel of Object.values(relations)) {
    if (rel.relationType === 'satisfies' && rel.targetId === reqId) {
      const src = nodes[rel.sourceId]
      if (src) return src.label
    }
  }
  return undefined
}
