import React from 'react'
import Markdown, { type MarkdownToJSX } from 'markdown-to-jsx/react'
import { keepLineBreaks } from '@radical/common/markdown'

// ─── Markdown text ───────────────────────────────────────────────────────────
// An element's long field (markdown.ts) rendered: its paragraphs, lists,
// emphasis, code and links. Its line breaks stay as written. Raw HTML is shown
// as text, not built. A link opens outside the app (a new tab, or the
// browser from Studio) and does not reach what is around it: a click on a link
// in the wiki opens the link, not the text's editor.
//
// `inline` renders one line (a summary) in a span; otherwise the text is
// blocks (paragraphs, lists, …) in a div.

function Link({ href, children, title }: { href?: string; children?: React.ReactNode; title?: string }): React.ReactElement {
  return (
    <a href={href} title={title} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
      {children}
    </a>
  )
}

// Headings get no id: the page's own anchors are its elements and fields.
const HEADINGS = Object.fromEntries(
  (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const).map((Tag) => [
    Tag,
    { component: ({ id: _id, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <Tag {...props} /> },
  ]),
)

const BASE: MarkdownToJSX.Options = {
  disableParsingRawHTML: true,
  disableFrontmatter: true,
  forceWrapper: true,
  overrides: { a: { component: Link }, ...HEADINGS },
}
const BLOCK: MarkdownToJSX.Options = { ...BASE, wrapper: 'div' }
const INLINE: MarkdownToJSX.Options = { ...BASE, forceInline: true, wrapper: 'span' }

export function MarkdownText({
  text,
  inline = false,
  className = '',
}: {
  text: string
  inline?: boolean
  className?: string
}): React.ReactElement {
  const source = inline ? text : keepLineBreaks(text)
  return (
    <Markdown className={`md-text ${className}`} options={inline ? INLINE : BLOCK}>
      {source}
    </Markdown>
  )
}
