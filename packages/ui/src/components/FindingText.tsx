// ─── The words of a rule and of a finding, with what matters marked ──────────
//
// A rule's description says what the rule asks and then, at length, how it
// reads the model: what it asks is in bold (written so in the description,
// where the rule is), the names of properties and files as code. A
// finding's sentence shows the words and values it quotes in bold and the
// names in backticks as code, so the eye finds what the sentence is about.

import React from 'react'
import { messageParts } from '@radical/common/check'
import { MarkdownText } from './MarkdownText'

/** A rule's description, its marks drawn. */
export function RuleText({ text, className = '' }: { text: string; className?: string }): React.ReactElement | null {
  if (!text) return null
  return <MarkdownText inline text={text} className={`rule-text ${className}`} />
}

/** Text of a finding's sentence: what it quotes in bold, names as code. */
export function QuotedText({ text }: { text: string }): React.ReactElement {
  return (
    <>
      {messageParts(text).map((part, i) => part.kind === 'quote' ? <b key={i} className="finding-quote">{part.text}</b>
        : part.kind === 'code' ? <code key={i}>{part.text}</code>
          : <React.Fragment key={i}>{part.text}</React.Fragment>)}
    </>
  )
}
