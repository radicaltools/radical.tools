import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CHANGELOG_URL, aboutRows, aboutText } from '../about'
import { host } from '../platform/host'

interface Props {
  open: boolean
  onClose: () => void
}

/** About Radical Studio, from the Radical menu: the version and build, with
 *  Copy for a bug report and a link to the changelog. */
export function AboutDialog({ open, onClose }: Props): React.ReactElement | null {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    setCopied(false)
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  const kind = host().kind
  const rows = aboutRows(kind)
  const copy = (): void => {
    void navigator.clipboard?.writeText(aboutText(kind)).then(() => setCopied(true), () => setCopied(false))
  }

  return createPortal(
    <div className="milestone-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="milestone-modal about-dialog" role="dialog" aria-modal="true" aria-label="About Radical Studio">
        <button type="button" className="ai-settings-close" onClick={onClose} aria-label="Close" title="Close (Esc)">✕</button>
        <h3 className="milestone-modal-title">Radical Studio</h3>
        <dl className="about-rows">
          {rows.map((row) => (
            <React.Fragment key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.href ? <a href={row.href} target="_blank" rel="noreferrer">{row.value}</a> : row.value}</dd>
            </React.Fragment>
          ))}
        </dl>
        <div className="about-actions">
          <a className="about-link" href={CHANGELOG_URL} target="_blank" rel="noreferrer">What's new</a>
          <button type="button" className="about-copy" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
