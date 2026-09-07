// ─── Shared site navigation ──────────────────────────────────────────────────
//
// The same bar as radical.tools / docs (website/landing.css `.site-nav`):
// Home · Hub · Docs | Open Studio | GitHub · theme. Keep markup and class
// names in sync with website/index.html and website/manual.html.

import React from 'react'

const IconGitHub = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.532 1.031 1.532 1.031.891 1.528 2.341 1.087 2.91.831.091-.645.349-1.087.635-1.337-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.03-2.682-.103-.253-.447-1.27.098-2.646 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.547 1.376.203 2.393.1 2.646.641.698 1.029 1.591 1.029 2.682 0 3.841-2.337 4.687-4.565 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.744 0 .267.18.579.688.481C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" /></svg>
)

export interface SiteNavProps {
  studioUrl: string
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  /** Hub link handler (we are on the hub, so it navigates in-app). */
  onHub: () => void
  /** Full-bleed variant for the catalogue layout (no centred column). */
  wide?: boolean
}

export function SiteNav({ studioUrl, theme, onToggleTheme, onHub, wide }: SiteNavProps): React.ReactElement {
  const themeLabel = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
  return (
    <header className={`site-nav${wide ? ' wide' : ''}`}>
      <a className="site-nav-logo" href="https://radical.tools" aria-label="Radical.Tools"><span className="site-nav-mark">R</span></a>
      <nav className="site-nav-links">
        <a className="site-nav-btn" href="https://radical.tools">Home</a>
        <button type="button" className="site-nav-btn active" onClick={onHub}>Hub</button>
        <a className="site-nav-btn" href="https://radical.tools/manual.html">Docs</a>
        <span className="site-nav-sep" aria-hidden="true" />
        <a className="site-nav-btn primary" href={studioUrl} target="_blank" rel="noopener">Open Studio</a>
        <span className="site-nav-sep" aria-hidden="true" />
        <a className="site-nav-icon" href="https://github.com/radicaltools/radical.tools" target="_blank" rel="noopener" aria-label="GitHub"><IconGitHub /></a>
        <button type="button" className="site-nav-icon" onClick={onToggleTheme} title={themeLabel} aria-label={themeLabel}>
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </nav>
    </header>
  )
}
