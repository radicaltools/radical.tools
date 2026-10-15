import { describe, it, expect } from 'vitest'
import { escapeMarkdown, isMarkdownField, keepLineBreaks, markdownToPlain } from '../src/markdown'

describe('Markdown in an element\'s fields', () => {
  it('holds Markdown in the description and every textarea, plain text elsewhere', () => {
    expect(isMarkdownField('description')).toBe(true)
    expect(isMarkdownField('decision', { type: 'textarea' })).toBe(true)
    expect(isMarkdownField('status', { type: 'enum' })).toBe(false)
    expect(isMarkdownField('label')).toBe(false)
  })

  it('takes the marks out for a place that shows plain text', () => {
    expect(markdownToPlain('Use **Postgres** with `pg_trgm`, see [the docs](https://x.y) and ~~not~~ _this_.'))
      .toBe('Use Postgres with pg_trgm, see the docs and not this.')
    expect(markdownToPlain('# Brief\n> quoted\n- one\n- [x] two\n1. three\n\n```ts\ncode()\n```\n---\n![diagram](d.png)'))
      .toBe('Brief\nquoted\none\ntwo\nthree\n\ncode()\n\ndiagram')
  })

  it('leaves a word with underscores or stars in it, and escaped marks, as they are', () => {
    expect(markdownToPlain('snake_case_name and 2*3*4')).toBe('snake_case_name and 2*3*4')
    expect(markdownToPlain('\\*not emphasis\\* and \\[x\\]')).toBe('*not emphasis* and [x]')
  })

  it('escapes plain text so that it reads as itself', () => {
    expect(escapeMarkdown('a*b_c [d] `e`')).toBe('a\\*b\\_c \\[d\\] \\`e\\`')
    expect(markdownToPlain(escapeMarkdown('**not bold** [x](y)'))).toBe('**not bold** [x](y)')
    expect(escapeMarkdown('< 300 ms')).toBe('< 300 ms')
  })

  it('keeps each line break of a paragraph, but not in code', () => {
    expect(keepLineBreaks('one\ntwo\n\nthree')).toBe('one  \ntwo\n\nthree')
    expect(keepLineBreaks('```\na\nb\n```')).toBe('```\na\nb\n```')
    expect(keepLineBreaks('ends  \nwith a break')).toBe('ends  \nwith a break')
  })
})
