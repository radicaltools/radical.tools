// ─── Markdown in an element's fields ────────────────────────────────────────
// An element's long fields are Markdown: its description (the body of its
// file in a Markdown folder) and every textarea property (an ADR's context
// and decision, a need's text, …). The wiki and the table render them; a
// place that has room for plain text only (a card on the canvas, a tooltip)
// shows them without their marks. Short fields (text, enum, ref) are plain
// text, escaped where they go into Markdown, as in a summary.

import type { PropertyDef } from './metamodel/types'

/** Whether a field holds Markdown: the description and every textarea. */
export function isMarkdownField(key: string, def?: Pick<PropertyDef, 'type'>): boolean {
  return key === 'description' || def?.type === 'textarea'
}

const ESCAPABLE = /[\\`*_[\]]/g

/** Plain text that reads as itself inside Markdown. */
export function escapeMarkdown(text: string): string {
  return text.replace(ESCAPABLE, '\\$&')
}

// A backslash escape is held as a private-use character while the marks are
// taken out, so that an escaped mark is not taken for one.
const HELD = 0xe000
const hold = (s: string) => s.replace(/\\([!-/:-@[-`{-~])/g, (_, c: string) => String.fromCharCode(HELD + c.charCodeAt(0)))
const release = (s: string) => s.replace(/[-]/g, (c) => String.fromCharCode(c.charCodeAt(0) - HELD))

/** `text` without its Markdown marks: headings, quotes, list bullets, code
 *  fences, emphasis, code spans, links (their text) and images (their alt
 *  text). Line breaks stay. */
export function markdownToPlain(text: string): string {
  return release(
    hold(text)
      .replace(/^ {0,3}(```|~~~).*$\n?/gm, '')
      .replace(/^ {0,3}([-*_])( *\1){2,} *$/gm, '')
      .replace(/^ {0,3}#{1,6}[ \t]+/gm, '')
      .replace(/^ {0,3}(> ?)+/gm, '')
      .replace(/^([ \t]*)(?:[-*+]|\d{1,9}[.)])[ \t]+(?:\[[ xX]\][ \t]+)?/gm, '$1')
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/<((?:https?|mailto):[^>\s]+)>/g, '$1')
      .replace(/(`+)(.+?)\1/g, '$2')
      .replace(/(\*\*|__)(?=\S)(.+?)(?<=\S)\1/g, '$2')
      .replace(/(^|[^\w*])\*(?=\S)([^*\n]+?)(?<=\S)\*(?!\*)/g, '$1$2')
      .replace(/(^|[^\w_])_(?=\S)([^_\n]+?)(?<=\S)_(?!\w)/g, '$1$2')
      .replace(/~~(?=\S)(.+?)(?<=\S)~~/g, '$1'),
  )
}

/** `text` with each line break kept as one, as a comment on GitHub keeps
 *  them: a single newline in a paragraph becomes a hard break (two spaces
 *  before it). Code fences are left as they are. */
export function keepLineBreaks(text: string): string {
  let fenced = false
  const lines = text.split('\n')
  return lines
    .map((line, i) => {
      if (/^ {0,3}(```|~~~)/.test(line)) fenced = !fenced
      const next = lines[i + 1]
      const breaks = !fenced && next !== undefined && line.trim() !== '' && next.trim() !== '' && !/ {2}$|\\$/.test(line)
      return breaks ? `${line}  ` : line
    })
    .join('\n')
}
