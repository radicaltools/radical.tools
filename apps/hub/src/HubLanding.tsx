// ─── Radical Hub — landing page ──────────────────────────────────────────────
//
// Shown at the empty hash. Everything here leads into the catalogue: browse,
// search, pick a category, or open a featured concept straight in the viewer.

import React, { useMemo, useState } from 'react'
import type { HubConceptSummary } from '@radical/common/hubFormat'
import { HUB_GROUPS, categoryTheme, hubGroupOf } from '@radical/ui/viewer'
import { CONCERN_GROUPS } from '@radical/common/concerns'
import { SiteNav } from './SiteNav'


const TypeIcon = ({ path, size = 16, color }: { path: string; size?: number; color?: string }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill={color ?? 'currentColor'} aria-hidden="true">
    <path d={path} />
  </svg>
)

export interface HubLandingProps {
  concepts: HubConceptSummary[]
  loading: boolean
  studioUrl: string
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  onBrowse: () => void
  onSearch: (query: string) => void
  /** A concern group (or a category) to list. */
  onCategory: (category: string) => void
}

export function HubLanding({
  concepts, loading, studioUrl, theme, onToggleTheme, onBrowse, onSearch, onCategory,
}: HubLandingProps): React.ReactElement {
  const [query, setQuery] = useState('')
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of concepts) m.set(hubGroupOf(c), (m.get(hubGroupOf(c)) ?? 0) + 1)
    return m
  }, [concepts])

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (q) onSearch(q); else onBrowse()
  }

  return (
    <div className="hub-landing">
      <SiteNav
        studioUrl={studioUrl}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onHub={() => document.querySelector('.hub-landing')?.scrollTo({ top: 0, behavior: 'smooth' })}
      />

      <section className="hub-hero">
        <div className="hub-hero-eyebrow">
          <span className="hub-eyebrow-tag">open source</span>
          <span className="hub-eyebrow-sep">/</span>
          <span>curated</span>
          <span className="hub-eyebrow-sep">/</span>
          <span>{loading ? '…' : concepts.length} concern packs</span>
        </div>
        <h1 className="hub-hero-title">
          Decisions every system needs,<br /><span className="accent">settled in a few answers.</span>
        </h1>
        <p className="hub-hero-sub">
          Each concern pack covers one concern — authentication, personal data, secrets, backups — with the
          questions that decide it and the requirements, decision, fitness functions and scenarios your answers
          bring. Radical Forge and AI agents ask the questions while they model your system, and
          <code>radical check</code> and the Inspector validate the model against the packs, naming every
          concern it has not decided yet.
        </p>
        <form className="hub-hero-search" onSubmit={submitSearch} role="search">
          <input
            type="search"
            placeholder="Search — sign-in, GDPR, retries, secrets…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search concern packs"
          />
          <button type="submit" className="hub-cta">Browse the catalogue</button>
        </form>
      </section>

      <section className="hub-cats">
        {HUB_GROUPS.map((cat) => {
          const t = categoryTheme(cat)
          return (
            <button
              type="button"
              key={cat}
              className="hub-cat-tile"
              style={{ ['--cat-color' as string]: t.color }}
              onClick={() => onCategory(cat)}
            >
              <span className="hub-cat-icon"><TypeIcon path={t.iconPath} size={18} color={t.fg} /></span>
              <span className="hub-cat-head">
                <span className="hub-cat-name">{t.plural}</span>
                <span className="hub-cat-count">{counts.get(cat) ?? 0}</span>
              </span>
              <span className="hub-cat-blurb">{CONCERN_GROUPS.find((g) => g.id === cat)?.description}</span>
            </button>
          )
        })}
      </section>

      <footer className="hub-landing-footer">
        <span>Radical Hub — part of <a href="https://radical.tools" target="_blank" rel="noopener">Radical.Tools</a>. MIT licensed.</span>
        <span>Missing a concern? <a href="https://github.com/radicaltools/radical.tools" target="_blank" rel="noopener">Open a PR</a>.</span>
      </footer>
    </div>
  )
}
