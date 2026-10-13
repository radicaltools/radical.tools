import { labelFromText, requirementFromLine } from '@radical/common/metamodel'

// ─── Writing in the wiki ─────────────────────────────────────────────────────
//
// What the line under a heading ("Requirements") makes of the text typed or
// pasted into it: one element for each line, with no form to fill in. A
// requirement is written as its sentence; anything else is named.

// The marker a line brings from the list it was copied out of: a bullet, a
// number, a checkbox, or a bullet and a checkbox ("- [ ] …").
const LIST_MARKER = /^\s*(?:(?:[-*•–—]|\d+[.)])\s+)?(?:\[[ xX]?\]\s+)?/

/** The lines of a typed or pasted text that say something, each without the
 *  marker of its list. */
export function writtenLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(LIST_MARKER, '').trim())
    .filter(Boolean)
}

/** The fields of the element of `type` that a line stands for. A name too
 *  long for one keeps the whole line as the description. */
export function elementFromLine(type: string, line: string): { label: string } & Record<string, unknown> {
  if (type === 'requirement') {
    const { label, fields } = requirementFromLine(line)
    return { label, ...fields }
  }
  const text = line.trim().replace(/\s+/g, ' ')
  const label = labelFromText(text)
  return label.endsWith('…') ? { label, description: text } : { label }
}
