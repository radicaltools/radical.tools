// ─── Radical Hub — landing page ──────────────────────────────────────────────
//
// Shown at the empty hash. Everything here leads into the catalogue: browse,
// search, pick a category, or open a featured concept straight in the viewer.

import React, { useMemo, useState } from 'react'
import type { HubConcept } from '../store/hubStore'
import { HUB_CATEGORIES, categoryTheme, type HubCategory } from '../types/hubTheme'

const CATEGORY_BLURB: Record<HubCategory, string> = {
  pattern: 'Reference structures — microservices, CQRS, API gateway, strangler fig — as ready-made C4 fragments.',
  'fitness-function': 'Measurable guardrails for latency, coupling, coverage, security posture and delivery flow.',
  requirement: 'EARS-shaped requirements with trigger, condition and action already filled in.',
  adr: 'Decision-record templates with context, decision, consequences and alternatives.',
  blueprint: 'Whole solution skeletons that bundle systems, requirements, fitness functions and ADRs.',
}

const TypeIcon = ({ path, size = 16, color }: { path: string; size?: number; color?: string }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill={color ?? 'currentColor'} aria-hidden="true">
    <path d={path} />
  </svg>
)

const IconGitHub = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.532 1.031 1.532 1.031.891 1.528 2.341 1.087 2.91.831.091-.645.349-1.087.635-1.337-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.03-2.682-.103-.253-.447-1.27.098-2.646 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.547 1.376.203 2.393.1 2.646.641.698 1.029 1.591 1.029 2.682 0 3.841-2.337 4.687-4.565 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.744 0 .267.18.579.688.481C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" /></svg>
)

export interface HubLandingProps {
  concepts: HubConcept[]
  loading: boolean
  studioUrl: string
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  onBrowse: () => void
  onSearch: (query: string) => void
  onCategory: (category: HubCategory) => void
  onOpenConcept: (id: string) => void
}

/** A representative sample across categories: bundles first (they demo the
 *  viewer best), then one of each governance type. */
function pickFeatured(concepts: HubConcept[]): HubConcept[] {
  const byCat = (cat: HubCategory) => concepts.filter((c) => c.category === cat)
  const out: HubConcept[] = []
  const take = (list: HubConcept[], n: number) => { for (const c of list.slice(0, n)) if (!out.includes(c)) out.push(c) }
  take(byCat('blueprint'), 1)
  take(byCat('pattern'), 2)
  take(byCat('requirement'), 1)
  take(byCat('fitness-function'), 1)
  take(byCat('adr'), 1)
  return out.slice(0, 6)
}

export function HubLanding({
  concepts, loading, studioUrl, theme, onToggleTheme, onBrowse, onSearch, onCategory, onOpenConcept,
}: HubLandingProps): React.ReactElement {
  const [query, setQuery] = useState('')
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of concepts) m.set(c.category, (m.get(c.category) ?? 0) + 1)
    return m
  }, [concepts])
  const featured = useMemo(() => pickFeatured(concepts), [concepts])

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (q) onSearch(q); else onBrowse()
  }

  return (
    <div className="hub-landing">
      <header className="hub-landing-nav">
        <a className="hub-landing-logo" href="#/" onClick={(e) => e.preventDefault()}>
          <span className="hub-brand-mark">R</span>
          <span>Radical<em>Hub</em></span>
        </a>
        <nav className="hub-landing-links">
          <button type="button" className="hub-nav-btn" onClick={onBrowse}>Catalogue</button>
          <a className="hub-nav-btn" href="https://radical.tools" target="_blank" rel="noopener">radical.tools</a>
          <a className="hub-nav-btn primary" href={studioUrl} target="_blank" rel="noopener">Open Studio</a>
          <a className="hub-nav-icon" href="https://github.com/radicaltools/radical.tools" target="_blank" rel="noopener" aria-label="GitHub"><IconGitHub /></a>
          <button type="button" className="hub-nav-icon" onClick={onToggleTheme} title="Toggle theme" aria-label="Toggle theme">
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </nav>
      </header>

      <section className="hub-hero">
        <div className="hub-hero-eyebrow">
          <span className="hub-eyebrow-tag">open source</span>
          <span className="hub-eyebrow-sep">/</span>
          <span>curated</span>
          <span className="hub-eyebrow-sep">/</span>
          <span>{loading ? '…' : concepts.length} concepts</span>
        </div>
        <h1 className="hub-hero-title">
          Architecture concepts,<br /><span className="accent">ready to import.</span>
        </h1>
        <p className="hub-hero-sub">
          Requirements, ADRs, fitness functions, patterns and blueprints — rendered by the same
          engine as Radical Studio, so what you see here is <em>exactly</em> what lands in your model.
        </p>
        <form className="hub-hero-search" onSubmit={submitSearch} role="search">
          <input
            type="search"
            placeholder="Search — latency, GDPR, event-driven, CQRS…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search concepts"
          />
          <button type="submit" className="hub-cta">Browse the catalogue</button>
        </form>
      </section>

      <section className="hub-cats">
        {HUB_CATEGORIES.map((cat) => {
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
              <span className="hub-cat-blurb">{CATEGORY_BLURB[cat]}</span>
            </button>
          )
        })}
      </section>

      <section className="hub-how">
        <h2>Three steps from idea to model</h2>
        <div className="hub-how-steps">
          <div className="hub-how-step">
            <span className="hub-how-n">1</span>
            <h3>Explore</h3>
            <p>Open any concept as a diagram, a wiki page or a table. Drag, collapse, re-layout — it is the real viewer.</p>
          </div>
          <div className="hub-how-step">
            <span className="hub-how-n">2</span>
            <h3>Select</h3>
            <p>Collect the concepts you want. Blueprints let you pick individual elements and referenced items.</p>
          </div>
          <div className="hub-how-step">
            <span className="hub-how-n">3</span>
            <h3>Add to Studio</h3>
            <p>One click opens Radical Studio with your selection queued for import — template parameters and all.</p>
          </div>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="hub-featured">
          <div className="hub-featured-head">
            <h2>Start with these</h2>
            <button type="button" className="hub-link" onClick={onBrowse}>See all {concepts.length} →</button>
          </div>
          <div className="hub-featured-grid">
            {featured.map((c) => {
              const t = categoryTheme(c.category)
              return (
                <button
                  type="button"
                  key={c.id}
                  className="hub-feat-card"
                  style={{ ['--cat-color' as string]: t.color }}
                  onClick={() => onOpenConcept(c.id)}
                >
                  <span className="hub-feat-cat"><TypeIcon path={t.iconPath} size={11} /> {t.label}</span>
                  <span className="hub-feat-name">{c.name}</span>
                  <span className="hub-feat-desc">{c.description}</span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      <footer className="hub-landing-footer">
        <span>Radical Hub — part of <a href="https://radical.tools" target="_blank" rel="noopener">Radical.Tools</a>. MIT licensed.</span>
        <span>Missing a concept? <a href="https://github.com/radicaltools/radical.tools" target="_blank" rel="noopener">Open a PR</a>.</span>
      </footer>
    </div>
  )
}
