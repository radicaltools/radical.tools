import React from 'react'
import Markdown, { type MarkdownToJSX } from 'markdown-to-jsx/react'
import { keepLineBreaks } from '@radical/common/markdown'

// ─── Markdown text ───────────────────────────────────────────────────────────
// An element's long field (markdown.ts) rendered: its paragraphs, lists,
// emphasis, code and links. Its line breaks stay as written. Raw HTML is shown
// as text, not built. A link opens outside the app (a new tab, or the
// browser from Studio), but for one into the app itself (#/…), and does not
// reach what is around it: a click on a link in the wiki opens the link, not
// the text's editor. An image on another site is a link, never fetched.
//
// `inline` renders one line (a summary) in a span; otherwise the text is
// blocks (paragraphs, lists, …) in a div.

function Link({ href, children, title }: { href?: string; children?: React.ReactNode; title?: string }): React.ReactElement {
  // A link the sanitizer emptied (javascript:, data:) was drawn as a link
  // that did nothing: it is its text.
  if (!href) return <span className="md-dead-link" title={title}>{children}</span>
  // A link into the app (#/d/…/v/…, a wiki page) opens here, not in a new tab.
  const inApp = href.startsWith('#')
  return (
    <a href={href} title={title} {...(inApp ? {} : { target: '_blank', rel: 'noopener noreferrer' })} onClick={(e) => e.stopPropagation()}>
      {children}
    </a>
  )
}

/** An image of the text: one on another host is not loaded (the request
 *  would leave the machine, D13); it is a link with its address. One in
 *  the text itself (data:) or beside the app is drawn. */
function Image({ src, alt, title }: { src?: string; alt?: string; title?: string }): React.ReactElement | null {
  if (!src) return alt ? <span>{alt}</span> : null
  if (/^(https?:)?\/\//i.test(src)) {
    return (
      <a href={src} className="md-remote-image" title={title ?? 'An image on another site, not loaded'} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
        {alt ? `${alt} (${src})` : src}
      </a>
    )
  }
  return <img src={src} alt={alt} title={title} />
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
  overrides: { a: { component: Link }, img: { component: Image }, ...HEADINGS },
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
