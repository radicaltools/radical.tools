// ─── The person's words: reading them without a language model ─────────────
// (ADR Agents check requirements against the person's words)
//
// What radical check compares between a need, the quotes on derives
// relations, requirements, scenarios and test sources: words as words
// (Markdown and typography aside), the questions and answers of a need, and
// the hard values of a text with the limit, unit, order and rounding the text
// gives them. Presence and form only: whether a sentence means what another
// one means is the agent's review (review_requirements), not this.

/** Text as it is compared word for word: Markdown emphasis, code marks,
 *  headings and list and quotation markers out; dashes, quotation marks and
 *  spaces of one kind; lower case; white space single. */
export const plainWords = (text: string): string => text
  .replace(/\r/g, '')
  .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
  .replace(/^[ \t]*(?:[-*+>]|\d+[.)])[ \t]+/gm, '')
  .replace(/\*\*|__|`/g, '')
  .replace(/(^|[\s([{"'])[*_](?=\S)/g, '$1')
  .replace(/(\S)[*_](?=[\s)\]}"'.,;:!?]|$)/g, '$1')
  .replace(/[‐-―−]/g, '-')
  .replace(/[‘’‚]/g, "'").replace(/[“”„]/g, '"')
  .replace(/[   ]/g, ' ')
  .toLowerCase().replace(/\s+/g, ' ').trim()

const WORD = /[\p{L}\p{N}]/u
const DIGIT = /\d/

/** Where `piece` ends in `text` as whole words (not "10" inside "100" or
 *  "10.5"), searching from `from`; -1 when it is not there. Both plain. */
export function wordsAt(text: string, piece: string, from = 0): number {
  if (!piece) return -1
  for (let i = text.indexOf(piece, from); i >= 0; i = text.indexOf(piece, i + 1)) {
    const end = i + piece.length
    const first = piece[0]; const last = piece[piece.length - 1]
    const before = text[i - 1] ?? ''; const after = text[end] ?? ''
    const startOk = !WORD.test(first) || !before || !WORD.test(before) && !(DIGIT.test(first) && /[.,]/.test(before) && DIGIT.test(text[i - 2] ?? ''))
    const endOk = !WORD.test(last) || !after || !WORD.test(after) && !(DIGIT.test(last) && /[.,]/.test(after) && DIGIT.test(text[end + 1] ?? ''))
    if (startOk && endOk) return end
  }
  return -1
}

// ─── Questions and answers of a need ───────────────────────────────────────

export type NeedPart = { kind: 'intro' | 'question' | 'answer'; text: string }

// A line that starts a question or an answer: "Q:", "A:", "Q1:", "Answer:",
// after a list or quotation marker, in bold or not.
const QA_START = /^[ \t]*(?:[-*+>][ \t]*)?(?:\*\*|__)?[ \t]*(Q|A|Question|Answer)[ \t]*\d*[ \t]*(?:\*\*|__)?[ \t]*:(?:[ \t]*(?:\*\*|__)(?=\s|$))?[ \t]*/i
// An answer on the line of its question: "Q: How many? A: At most 20."
const INLINE_ANSWER = /([?.!)"'*_])[ \t]+(?:\*\*|__)?(?:A|Answer)[ \t]*\d*[ \t]*(?:\*\*|__)?[ \t]*:(?:[ \t]*(?:\*\*|__)(?=\s|$))?[ \t]*/

/** Bold marks left open at the ends of a part ("**Q: How many?**"). */
const unwrap = (text: string): string => {
  let t = text.trim()
  if ((t.match(/\*\*/g) ?? []).length % 2) t = t.replace(/^\*\*\s*|\s*\*\*$/g, '')
  if ((t.match(/__/g) ?? []).length % 2) t = t.replace(/^__\s*|\s*__$/g, '')
  return t.trim()
}

/** A need's text in its parts: what comes before the first question, then
 *  each question and each answer of a person, as the lines that start them
 *  ("Q:", "A:", "Answer:", "Q1:", with list or bold marks, or an answer on
 *  its question's line) divide it. */
export function needParts(text: string): NeedPart[] {
  const parts: Array<{ kind: NeedPart['kind']; lines: string[] }> = [{ kind: 'intro', lines: [] }]
  for (const line of text.split('\n')) {
    const m = QA_START.exec(line)
    if (!m) { parts[parts.length - 1].lines.push(line); continue }
    const rest = line.slice(m[0].length)
    if (/^a/i.test(m[1])) { parts.push({ kind: 'answer', lines: [rest] }); continue }
    const inline = INLINE_ANSWER.exec(rest)
    if (inline) {
      parts.push({ kind: 'question', lines: [rest.slice(0, inline.index + inline[1].length)] })
      parts.push({ kind: 'answer', lines: [rest.slice(inline.index + inline[0].length)] })
    } else parts.push({ kind: 'question', lines: [rest] })
  }
  return parts.map((p) => ({ kind: p.kind, text: unwrap(p.lines.join('\n')) })).filter((p) => p.text)
}

/** The answers of a person in a need's text. */
export const needAnswers = (text: string): string[] => needParts(text).filter((p) => p.kind === 'answer').map((p) => p.text)

// ─── Quotes ─────────────────────────────────────────────────────────────────

/** The fragments a derives relation quotes: one per line, without the
 *  quotation marks around it, as plain words; an ellipsis inside splits a
 *  fragment into pieces that must be in the need in that order, within one
 *  question, answer or the text before the questions. */
export function quoteFragments(quote: unknown): string[][] {
  if (typeof quote !== 'string') return []
  return quote.split('\n').map((line) => line.trim().replace(/^["'“‘„>]+|["'”’]+$/g, '').trim()).filter(Boolean)
    .map((line) => line.split(/…|\.\.\./).map((piece) => plainWords(piece).replace(/^["']+|["']+$/g, '').trim()).filter(Boolean))
    .filter((pieces) => pieces.length)
}

/** Whether a need's text holds a quoted fragment. */
export function quoteFound(needText: string, pieces: string[]): boolean {
  if (pieces.length === 1) return wordsAt(plainWords(needText), pieces[0]) >= 0
  return needParts(needText).some((part) => {
    const text = plainWords(part.text)
    let at = 0
    for (const piece of pieces) { at = wordsAt(text, piece, at); if (at < 0) return false }
    return true
  })
}

/** The words of a fragment: a single word, or a lone value, points at no
 *  words of the need in particular. */
export const fragmentWords = (pieces: string[]): number => pieces.join(' ').split(' ').filter((w) => WORD.test(w)).length

// ─── Hard values ─────────────────────────────────────────────────────────────
// Numbers, null, true and false, dates and times, and identifiers in
// backticks or quotation marks: what cannot be paraphrased without changing
// the meaning. A value has aliases, which count as saying it but are never
// asked for: a percentage and its number, an amount of money and its cents,
// a duration in seconds, "one" for 1.

const UNITS: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 }
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }
const SCALES: Record<string, number> = { hundred: 100, thousand: 1000, million: 1000000 }
const has = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k)
const isNumberWord = (w: string): boolean => has(UNITS, w) || has(TENS, w) || has(SCALES, w)

/** Runs of number words written as digits ("twenty-five" → 25, "two
 *  hundred" → 200); a lone "one" stays a word (a pronoun as often as not). */
export function numerals(text: string): string {
  return text.replace(/\b(?:(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million)(?:[ -]+(?:and[ -]+)?|\b))+/gi, (run) => {
    const words = run.toLowerCase().split(/[ -]+/).filter((w) => w && w !== 'and')
    if (!words.length || words.some((w) => !isNumberWord(w))) return run
    if (words.length === 1 && words[0] === 'one') return run
    if (has(SCALES, words[0])) return run
    let total = 0; let current = 0
    for (const w of words) {
      if (has(UNITS, w)) current += UNITS[w]
      else if (has(TENS, w)) current += TENS[w]
      else if (w === 'hundred') current = (current || 1) * 100
      else { total += (current || 1) * SCALES[w]; current = 0 }
    }
    return `${total + current}${/\s$/.test(run) ? ' ' : ''}`
  })
}

const DURATION: Array<[RegExp, number]> = [
  [/^(?:ms|msecs?|milliseconds?)$/, 0.001], [/^(?:s|secs?|seconds?)$/, 1], [/^(?:mins?|minutes?)$/, 60],
  [/^(?:h|hrs?|hours?)$/, 3600], [/^(?:d|days?)$/, 86400], [/^(?:weeks?|wks?)$/, 604800],
]
const MONEY_AFTER = /^(?:€|eur|euros?|zł|zl|pln|usd|\$|£|gbp|chf|dollars?|pounds?)$/
const CENTS = /^(?:cents?|ct|grosz[ey]?|pence|p)$/
const MONEY_BEFORE = /(?:€|\$|£|eur|usd|pln|gbp|chf)\s?$/

/** A number as a value: thousands separators out, a decimal comma a point,
 *  trailing zeros of the fraction dropped. */
const numberValue = (raw: string): string => {
  let n = /^\d{1,3}(,\d{3})+$/.test(raw) ? raw.replace(/,/g, '') : raw.replace(',', '.')
  if (/^\d+\.\d+$/.test(n)) n = n.replace(/0+$/, '').replace(/\.$/, '')
  return n
}
const fmt = (n: number): string => String(Math.round(n * 1000) / 1000)

export type Quantity = { value: string; dimension: 'time' | 'money'; base: string; text: string }

export interface ValueReading {
  /** The values the text states. */
  values: Set<string>
  /** Aliases of each value (a percentage's number, money in cents, a
   *  duration in seconds). */
  aliases: Map<string, string[]>
  /** What else counts as said: every alias, and "one" as 1. */
  also: Set<string>
  /** The values that come with a unit of time or money. */
  quantities: Quantity[]
}

/** The hard values of a text, with their aliases and units. */
export function readValues(text: string): ValueReading {
  const values = new Set<string>(); const aliases = new Map<string, string[]>(); const also = new Set<string>(); const quantities: Quantity[] = []
  const alias = (value: string, ...more: string[]) => { aliases.set(value, [...new Set([...aliases.get(value) ?? [], ...more])]); more.forEach((m) => also.add(m)) }
  let t = text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[  ]/g, ' ')
  // Not the words between two quotations ("…", and "…"): an identifier does not start or end with a space.
  for (const m of t.matchAll(/`([^`\s][^`\n]{0,38}[^`\s]|[^`\s])`|"([^"\s][^"\n]{0,38}[^"\s]|[^"\s])"|(?<![\w])'([a-z0-9][a-z0-9_-]{0,39})'(?![\w])/gi)) {
    const id = (m[1] ?? m[2] ?? m[3]).trim().toLowerCase()
    // A name or a code, not a path, a template or punctuation.
    if (/^[a-z0-9][a-z0-9_-]*$/.test(id) && !/^\d+$/.test(id)) values.add(id)
  }
  // Dates and times are one value each, not three numbers.
  t = t.replace(/\b(\d{4}-\d{2}-\d{2})(?:[t ](\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?z?)?\b/gi, (_, date: string, time?: string) => { values.add(date); if (time) values.add(time); return ' ' })
  t = t.replace(/(?<![\d:])(\d{1,2}:\d{2})(?![\d:])/g, (_, time: string) => { values.add(time.padStart(5, '0')); return ' ' })
  t = numerals(t)
  // Not the number inside a code such as MUG-BLUE-01.
  for (const m of t.matchAll(/(?<![\w.,]|\w-)(\d{1,3}(?:,\d{3})+|\d+(?:[.,]\d+)?)(?:\s?(%|percent\b|per cent\b)|(st|nd|rd|th)\b|\s?([a-zżł€$£]+\b|€|\$|£))?(?![\w])/gi)) {
    const raw = m[1]; const n = numberValue(raw)
    if (m[2]) { values.add(`${n}%`); alias(`${n}%`, n); continue }
    values.add(n)
    if (/[.,]\d\d$/.test(raw) && !/^\d{1,3}(,\d{3})+$/.test(raw)) alias(n, fmt(Number(n) * 100))
    if (!/%$/.test(n)) alias(n, `${n}%`)
    const unit = (m[4] ?? '').toLowerCase()
    const before = t.slice(Math.max(0, (m.index ?? 0) - 4), m.index ?? 0).toLowerCase()
    const duration = DURATION.find(([re]) => re.test(unit))
    if (duration) { const base = `${fmt(Number(n) * duration[1])}s`; alias(n, base); quantities.push({ value: n, dimension: 'time', base, text: `${raw} ${unit}` }) }
    else if (MONEY_AFTER.test(unit) || MONEY_BEFORE.test(before)) { const cents = fmt(Number(n) * 100); alias(n, `${cents}¢`, cents); quantities.push({ value: n, dimension: 'money', base: `${cents}¢`, text: `${raw} ${unit}`.trim() }) }
    else if (CENTS.test(unit)) { alias(n, `${n}¢`); quantities.push({ value: n, dimension: 'money', base: `${n}¢`, text: `${raw} ${unit}` }) }
  }
  const lower = t.toLowerCase()
  for (const m of lower.matchAll(/\b(null|true|false)\b/g)) values.add(m[1])
  // Counted, never asked for: "one" may be a pronoun, "once" and "twice" are counts.
  if (/\bone\b|\bonce\b|\bsingle\b/.test(lower)) also.add('1')
  if (/\btwice\b/.test(lower)) also.add('2')
  if (/\bdozen\b/.test(lower)) also.add('12')
  return { values, aliases, also, quantities }
}

/** The hard values of a text, normalised. */
export const hardValues = (text: string): Set<string> => readValues(text).values

/** Whether a reading says `value`: as a value, or as what counts as one. */
export const says = (reading: ValueReading, value: string): boolean => reading.values.has(value) || reading.also.has(value)

/** Whether `to` says value `value` of `from`, itself or by an alias. */
export const saysValueOf = (from: ValueReading, value: string, to: ValueReading): boolean =>
  says(to, value) || (from.aliases.get(value) ?? []).some((a) => says(to, a))

// ─── Limits, order and rounding ────────────────────────────────────────────

export type Op = '<=' | '<' | '>=' | '>'
export type Limit = { value: string; op: Op; text: string }
const COMPLEMENT: Record<Op, Op> = { '<=': '>', '<': '>=', '>=': '<', '>': '<=' }
const N = String.raw`(\d+(?:[.,]\d+)?)`
const LIMIT_BEFORE: Array<[RegExp, Op]> = [
  [new RegExp(String.raw`\b(?:at most|no more than|not more than|up to|maximum of|a maximum of|max(?:imum)?\.?|no longer than|not over)\s+${N}`, 'g'), '<='],
  [new RegExp(String.raw`(?:≤|<=)\s*${N}`, 'g'), '<='],
  [new RegExp(String.raw`\b(?:at least|no less than|no fewer than|not less than|not fewer than|minimum of|a minimum of|min(?:imum)?\.?)\s+${N}`, 'g'), '>='],
  [new RegExp(String.raw`(?:≥|>=)\s*${N}`, 'g'), '>='],
  [new RegExp(String.raw`(?<!\b(?:no|not) )\b(?:more than|greater than|longer than|larger than|higher than|over|above|exceeds?|exceeding|beyond)\s+${N}`, 'g'), '>'],
  [new RegExp(String.raw`(?<![<>=-])>\s*${N}`, 'g'), '>'],
  [new RegExp(String.raw`(?<!\b(?:no|not) )\b(?:less than|fewer than|shorter than|smaller than|lower than|below|under)\s+${N}`, 'g'), '<'],
  [new RegExp(String.raw`(?<![<>=-])<\s*${N}(?![\d=])`, 'g'), '<'],
]
const LIMIT_AFTER: Array<[RegExp, Op]> = [
  [new RegExp(String.raw`${N}(?:\s*[a-z%€$£]+)?\s+or\s+(?:less|fewer|below|under|lower|smaller|shorter)\b`, 'g'), '<='],
  [new RegExp(String.raw`${N}(?:\s*[a-z%€$£]+)?\s+or\s+(?:more|above|over|higher|greater|larger|longer)\b`, 'g'), '>='],
]
const RANGE = new RegExp(String.raw`\b(?:from|between)\s+${N}\s+(?:to|and)\s+${N}|(?<![\d.,-])${N}\s?(?:-|to)\s?${N}(?![\d.,-])`, 'g')
export const REFUSAL = /\b(?:refus\w*|reject\w*|declin\w*|den(?:y|ies|ied)|invalid|not (?:allowed|accepted|permitted)|forbidden|disallow\w*|error|too (?:long|short|many|few|high|low|big|small))\b/

/** The limits a text puts on numbers, each as the side that is allowed: "at
 *  most 20" and "refuses more than 20" both allow `<= 20`. A clause that
 *  refuses, rejects or declines, or a condition ("if", "when") followed by
 *  one, speaks of what is not allowed; `refusing` says the whole text does. */
export function readLimits(text: string, refusing = false): Limit[] {
  const limits: Limit[] = []
  const plain = numerals(plainWords(text)).replace(/\b\d{4}-\d{2}-\d{2}\S*|\b\d{1,2}:\d{2}\b/g, ' ')
  for (const sentence of plain.split(/(?<=[.;!?])\s+(?=\D)/)) {
    const clauses = sentence.split(/,|;|\s(?:and|but|so|then|otherwise)\s/).filter((c) => c.trim())
    clauses.forEach((clause, i) => {
      const refused = refusing || REFUSAL.test(clause) || /^\s*(?:if|when|whenever|where|once|should)\b/.test(clause) && REFUSAL.test(clauses[i + 1] ?? '')
      for (const [re, op] of [...LIMIT_BEFORE, ...LIMIT_AFTER]) {
        for (const m of clause.matchAll(re)) {
          // "a cost that is not above zero": the negation turns the limit round once more.
          const negated = /\b(?:not|never|isn't|aren't|neither|nor)\b/.test(clause.slice(0, m.index))
          limits.push({ value: numberValue(m[1]), op: refused !== negated ? COMPLEMENT[op] : op, text: m[0].trim() })
        }
      }
      // A range is what is allowed; one in a refusal is too often "not 2 to 10" to read.
      if (refused) return
      for (const m of clause.matchAll(RANGE)) {
        const [low, high] = m[1] !== undefined ? [m[1], m[2]] : [m[3], m[4]]
        if (Number(numberValue(low)) >= Number(numberValue(high))) continue
        limits.push({ value: numberValue(low), op: '>=', text: m[0].trim() }, { value: numberValue(high), op: '<=', text: m[0].trim() })
      }
    })
  }
  return limits
}

export type Order = 'oldest-first' | 'newest-first' | 'ascending' | 'descending'
const ORDERS: Array<[RegExp, Order]> = [
  [/\b(?:oldest|earliest)(?: \w+)? first\b|\bin (?:the )?order (?:they|it) (?:came|were|was) \w+/, 'oldest-first'],
  [/\b(?:newest|latest|most recent)(?: \w+)? first\b|\breverse chronological\b/, 'newest-first'],
  [/\bascending\b|\b(?:lowest|smallest|cheapest) first\b|\ba to z\b/, 'ascending'],
  [/\bdescending\b|\b(?:highest|largest|biggest|dearest) first\b|\bz to a\b/, 'descending'],
]
const OPPOSITE: Record<Order, Order> = { 'oldest-first': 'newest-first', 'newest-first': 'oldest-first', ascending: 'descending', descending: 'ascending' }
export const oppositeOrder = (o: Order): Order => OPPOSITE[o]

/** The orders a text gives lists. */
export function readOrders(text: string): Set<Order> {
  const t = plainWords(text)
  return new Set(ORDERS.filter(([re]) => re.test(t)).map(([, o]) => o))
}

export type Rounding = 'half up' | 'half down' | 'half even' | 'down' | 'up'
/** The roundings a text names: "rounded half up", "half even", "rounded down". */
export function readRoundings(text: string): Set<Rounding> {
  let t = plainWords(text)
  const found = new Set<Rounding>()
  t = t.replace(/\b(?:round(?:ed|s|ing)? )?half(?:[ -]way)?[ -](up|down|even)\b|\bbanker'?s rounding\b/g, (m, kind?: string) => { found.add(`half ${kind ?? 'even'}` as Rounding); return ' ' })
  for (const m of t.matchAll(/\bround(?:ed|s|ing)?(?: \w+){0,3} (up|down)\b/g)) found.add(m[1] as Rounding)
  return found
}

// ─── Examples ───────────────────────────────────────────────────────────────

const EXAMPLE = /\b(?:for example|for instance|e\.g\.|example:|examples:)/i

/** The sentences of a text that give an example with at least two values
 *  ("For example, 4 on hand at 4.00 € and 12 received at 6.00 € gives
 *  5.50 €."), as written. */
export function exampleSentences(text: string): string[] {
  const out: string[] = []
  for (const line of text.split('\n')) {
    const sentences = line.split(/(?<=[.!?])\s+(?=[A-Z(*`"“-])/)
    for (const s of sentences) {
      // Markdown out, and list numbers ("1. the style, 2. microservices") are no values.
      const clean = s.replace(/\*\*|__|`/g, '').replace(/^[\s>*+-]+/, '').replace(/(^|[\s,;:(])\d{1,2}[.)](?=\s+[a-z])/g, '$1').trim()
      if (EXAMPLE.test(clean) && (clean.match(/\d+(?:[.,]\d+)?/g) ?? []).length >= 2) out.push(clean)
    }
  }
  return out
}
