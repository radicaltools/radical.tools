// ─── EARS (Easy Approach to Requirements Syntax) helpers ───────────────────
//
// Composes/parses the free-text sentence for a `requirement` node's fields.
// This is domain logic for the governance preset's Requirement type, not
// part of the generic metamodel engine.

function capitalize(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1) }

/** True when an action is a whole clause with a subject of its own ("The
 *  wiki view shall show an overview page") rather than what follows "shall".
 *  Such a requirement reads by its own subject: prefixing the element that
 *  satisfies it would say "shall" twice. */
export function earsActionIsClause(action: string): boolean {
  return /\S\s+shall\s+\S/i.test(action)
}

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
 *  `statePrecondition` stands in for an empty precondition text: the phrase
 *  for the state machine state the requirement points at.
 */
export function composeEarsSentence(node: Record<string, unknown>, subject?: string, statePrecondition?: string): { sentence: string; complete: boolean } {
  const earsType = String(node.ears_type ?? 'ubiquitous')
  const subj = (subject || 'the system').trim()
  const action = String(node.action ?? '').trim()
  const trigger = String(node.trigger ?? '').trim()
  // The precondition text, or else the state it points at (see
  // requirementStatePhrase): "the Reservation is Confirmed".
  const precondition = String(node.precondition ?? '').trim() || (statePrecondition ?? '').trim()
  const unwanted = String(node.unwanted_condition ?? '').trim()
  const feature = String(node.feature ?? '').trim()

  // The sentence ends with its own full stop, whatever the action brings.
  const actionPart = action.replace(/\.+$/, '') || '‹action›'
  const ownClause = earsActionIsClause(actionPart)
  // After a condition the clause is mid-sentence: "When …, the system shall …".
  const shallClause = ownClause ? actionPart.replace(/^(The|A|An)\b/, (w) => w.toLowerCase()) : `${subj} shall ${actionPart}`

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
      sentence = ownClause ? `${capitalize(actionPart)}.` : `${capitalize(subj)} shall ${actionPart}.`
      break
  }

  return { sentence, complete }
}

type EarsSlot = 'trigger' | 'precondition' | 'unwanted_condition' | 'feature'

// How a condition clause may open, and the field it then fills. The words
// EARS itself uses, and the few others that read the same once the sentence
// is written back with the EARS word ("As soon as the order ships" is
// "When the order ships"). "In case of …" is no clause: it has no verb.
const EARS_CLAUSE_KEYWORDS: {
  re: RegExp
  slot: EarsSlot
  type: 'event-driven' | 'state-driven' | 'unwanted-behaviour' | 'optional'
}[] = [
  { re: /^(?:while|whilst|as long as)\b/i, slot: 'precondition', type: 'state-driven' },
  { re: /^(?:when(?:ever)?|as soon as|every time|each time)\b/i, slot: 'trigger', type: 'event-driven' },
  { re: /^(?:if|in case(?!\s+of\b))\b/i, slot: 'unwanted_condition', type: 'unwanted-behaviour' },
  { re: /^where\b/i, slot: 'feature', type: 'optional' },
]

// What a requirement is written with. A composed sentence says "shall".
const EARS_MODAL = /\b(?:shall|must|should|will)\b/gi

const clauseOf = (segment: string): (typeof EARS_CLAUSE_KEYWORDS)[number] | undefined =>
  EARS_CLAUSE_KEYWORDS.find(({ re }) => re.test(segment))

const isTheSystem = (subject: string): boolean => /^(?:the\s+)?system$/i.test(subject)

export interface ParsedEarsSentence {
  ears_type: string
  action: string
  trigger?: string
  precondition?: string
  unwanted_condition?: string
  feature?: string
}

// A sentence taken apart: its condition clauses, who shall, and what.
interface EarsParts {
  slots: Partial<Record<EarsSlot, string>>
  /** A leading condition that opens with none of the clause words ("After
   *  three failed logins"), as written. */
  lead: string
  /** Who shall, as written; empty when the sentence does not say. */
  subject: string
  /** What follows "shall". */
  tail: string
}

/**
 * Take a requirement sentence apart, or return null when it has no "shall"
 * (or must, should, will) to split at, or no comma to tell its condition
 * from a subject that is not "the system" ("When a payment fails the
 * gateway shall retry"): such a sentence is kept whole rather than guessed
 * at.
 *
 * The "shall" of the main clause is the first one whose stretch of the
 * sentence, back to the comma before it, does not open a condition: so
 * "must" inside a condition ("If the request must be retried, the system
 * shall queue it") and "shall" inside the action ("… a list of what the
 * user shall pay") are both passed over. What stands before it is cut at
 * its commas: a stretch that opens with a clause word starts a condition,
 * any other continues the condition before it (a condition may hold commas
 * of its own), and the last one is the subject.
 */
function splitEarsSentence(text: string): EarsParts | null {
  const modals = [...text.matchAll(EARS_MODAL)]
  if (modals.length === 0) return null
  const stretchBefore = (index: number): string => text.slice(text.lastIndexOf(',', index) + 1, index).trim()
  const modal = modals.find((m) => !clauseOf(stretchBefore(m.index!))) ?? modals[modals.length - 1]
  const tail = text.slice(modal.index! + modal[0].length).trim().replace(/[.:;]+$/, '').trim()
  const segments = text
    .slice(0, modal.index)
    // "… and when the user signs in" starts a condition of its own.
    .replace(/\s+and\s+(?=(?:when|whenever|while|if|where)\b)/gi, ', ')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  // "If …, then the system shall …": the "then" after the comma belongs to
  // neither the condition nor the subject. Left on the stretch, it was read
  // as the end of the condition ("the limit is exceeded, then"), and each
  // rewrite of the sentence added one more.
  if (segments.length > 1) {
    const afterThen = segments[segments.length - 1].replace(/^then\b\s*/i, '')
    if (afterThen) segments[segments.length - 1] = afterThen
  }

  let subject = ''
  const last = segments[segments.length - 1]
  // With no comma before the subject, only "the system" can be told apart
  // from the end of the condition before it.
  const beforeTheSystem = last === undefined ? null : /^(.+?)(?:\s+then)?\s+(the\s+system)$/i.exec(last)
  if (last !== undefined && clauseOf(last)) {
    if (!beforeTheSystem) return null
    segments[segments.length - 1] = beforeTheSystem[1]
    subject = beforeTheSystem[2]
  } else if (beforeTheSystem && segments.length > 1 && !/^(?:the|an?|each|every|any|all)\b/i.test(last!)) {
    // "When the user, being logged in, clicks save the system shall …": the
    // stretch ends the condition, it is no subject with an article of its own.
    segments[segments.length - 1] = beforeTheSystem[1]
    subject = beforeTheSystem[2]
  } else if (last !== undefined) {
    subject = segments.pop()!.replace(/^then\s+/i, '')
  }

  const slots: EarsParts['slots'] = {}
  const lead: string[] = []
  let open: EarsSlot | null = null
  for (const segment of segments) {
    const clause = clauseOf(segment)
    if (clause) {
      const value = segment.replace(clause.re, '').trim()
      if (!value) continue
      slots[clause.slot] = slots[clause.slot] ? `${slots[clause.slot]} and ${value}` : value
      open = clause.slot
    } else if (open) {
      slots[open] = `${slots[open]}, ${segment}`
    } else {
      lead.push(segment)
    }
  }
  return { slots, lead: lead.join(', '), subject, tail }
}

/** The fields of a sentence taken apart. Whatever the fields have no place
 *  for stays in the action, as a clause of its own (see earsActionIsClause),
 *  so that the sentence composed from them reads as it was written: a
 *  subject other than the system (or `subject`, the element the requirement
 *  is known to be about), a leading condition with no clause word, and an
 *  action with a "shall" of its own. */
function earsFields(parts: EarsParts, subject?: string): ParsedEarsSentence {
  const { slots, lead, tail } = parts
  const implied = !parts.subject || isTheSystem(parts.subject)
    || (!!subject && parts.subject.toLowerCase() === subject.trim().toLowerCase())
  let action = tail
  if (tail && (lead || !implied || /\bshall\b/i.test(tail))) {
    action = `${lead ? `${lead}, ` : ''}${parts.subject || 'the system'} shall ${tail}`
  }
  const found = Object.keys(slots) as EarsSlot[]
  const ears_type = found.length > 1
    ? 'complex'
    : found.length === 1
      ? EARS_CLAUSE_KEYWORDS.find((k) => k.slot === found[0])!.type
      : 'ubiquitous'
  return { ears_type, action, ...slots }
}

/**
 * Heuristically parse a free-text requirement sentence into EARS fields, so
 * a user can type "When the user clicks save, the system shall persist the
 * document" instead of first picking an ears_type from a list.
 *
 * One condition clause picks its EARS type, more than one makes the
 * requirement 'complex', none leaves it 'ubiquitous' (see splitEarsSentence
 * and earsFields for how the sentence is read). No word of the sentence is
 * dropped: a sentence that cannot be taken apart is the action whole, as a
 * clause of its own when it says "shall". `subject` is the element the
 * requirement is known to be about, which the sentence may name in place of
 * "the system".
 */
export function parseEarsSentence(input: string, subject?: string): ParsedEarsSentence {
  const text = input.trim().replace(/\s+/g, ' ').replace(/\.+$/, '')
  if (!text) return { ears_type: 'ubiquitous', action: '' }
  const parts = splitEarsSentence(text)
  if (parts) return earsFields(parts, subject)
  // Kept whole. Written with "must" or "will", it says "shall" like any
  // other, which also marks it as a clause with a subject of its own.
  const modals = [...text.matchAll(EARS_MODAL)]
  const main = modals[modals.length - 1]
  const action = main ? `${text.slice(0, main.index)}shall${text.slice(main.index! + main[0].length)}` : text
  return { ears_type: 'ubiquitous', action }
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

// A name is a line of a list, not a sentence: up to this many characters.
const LINE_LABEL_MAX = 64

/** The start of `text` as a name: whole when it is short, or else cut at a
 *  word with an ellipsis. Its capitals are left as written ("iOS app"). */
export function labelFromText(text: string, max = LINE_LABEL_MAX): string {
  const clean = text.trim().replace(/\s+/g, ' ').replace(/[.;:,]+$/, '')
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const atWord = cut.lastIndexOf(' ')
  return `${(atWord > max / 2 ? cut.slice(0, atWord) : cut).replace(/[.;:,]+$/, '')}…`
}

/**
 * The requirement a line of text stands for, when it is written down
 * without a form: its name and its fields.
 *
 * A line with "shall" or "must" is an EARS sentence: its clauses go to
 * their fields and the action names the requirement, with its condition
 * when that fits ("When the user saves, the system shall persist the
 * document" is named "Persist the document when the user saves").
 * A subject other than the system stays in the action as a clause of its
 * own ("the wiki view shall show an overview"), so the sentence still reads
 * as it was written. Any other line is not a sentence the system can be the
 * subject of ("Users can reset their password"), so it is kept as written:
 * it names the requirement, and is its description when the name had to be
 * cut. Its sentence is then left to be written.
 */
export function requirementFromLine(line: string): { label: string; fields: Record<string, unknown> } {
  const text = line.trim().replace(/\s+/g, ' ').replace(/\.+$/, '')
  if (!text.match(EARS_MODAL)) {
    const label = labelFromText(text)
    return { label, fields: label.endsWith('…') ? { description: text } : {} }
  }
  const parsed = parseEarsSentence(text)
  const fields: Record<string, unknown> = { ears_type: parsed.ears_type, action: parsed.action }
  for (const key of ['trigger', 'precondition', 'unwanted_condition', 'feature'] as const) {
    if (parsed[key]) fields[key] = parsed[key]
  }
  // The name is what the system shall do, and says when, too, as long as it
  // stays a name: "Refuse the transfer" could be any of several requirements.
  let name = splitEarsSentence(text)?.tail || text
  for (const [key, word] of [['trigger', 'when'], ['precondition', 'while'], ['unwanted_condition', 'if'], ['feature', 'where']] as const) {
    const longer = `${name} ${word} ${parsed[key]}`
    if (parsed[key] && longer.length <= LINE_LABEL_MAX) name = longer
  }
  return { label: capitalize(labelFromText(name)), fields }
}
