// ─── Concern pack wizard ─────────────────────────────────────────────────────
//
// Answering a Hub concern pack (@radical/common/concerns): where it applies
// (the elements bindSuggestions proposes, the fewest that cover them all
// checked, and every other element it can be bound to), one step per
// question with its answers as cards, the free-text details the answers
// still use, and a review of what comes into the model. The same dialog as
// the node wizard (packages/ui NodeWizard.tsx, the .nw classes): steps on the
// side, one question in front, Back / Next, ⌘↵ adds from any step, Esc
// cancels.

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { C4Node } from '@radical/common/c4'
import { NODE_COLORS, NODE_FG, TYPE_ICON_PATHS, TYPE_LABELS } from '@radical/common/c4'
import { answerTexts, CONCERN_GROUPS, pickVariant, suggestedCover, type BindSuggestion } from '@radical/common/concerns'
import { resolveParamValues, templateKeysUsed } from '@radical/common/hubImport'
import type { HubConcept, TemplateParam } from '@radical/common/hubFormat'

interface Props {
  concept: HubConcept
  /** Where it applies, best first (bindSuggestions). */
  suggestions: BindSuggestion[]
  /** Every other element it can be bound to. */
  others: string[]
  nodes: Record<string, C4Node>
  onImport: (answers: Record<string, string>, elementIds: string[]) => void
  onCancel: () => void
  /** Its place among several packs answered one after another ("2 of 3"). */
  position?: string
  /** Why the model cannot take the pack (metamodelProblem), or null: then
   *  it is not added, as the MCP server refuses it. */
  problem?: string | null
}

type Step =
  | { kind: 'scope'; title: string }
  | { kind: 'question'; title: string; param: TemplateParam }
  | { kind: 'details'; title: string; params: TemplateParam[] }
  | { kind: 'review'; title: string }

const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

export function ConcernWizard({ concept, suggestions, others, nodes, onImport, onCancel, position, problem }: Props): React.ReactElement {
  const params = concept.templateParams ?? []
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(params.map((p) => [p.key, p.defaultValue ?? ''])))
  const cover = useMemo(() => suggestedCover(suggestions), [suggestions])
  const [bound, setBound] = useState<string[]>(() => cover.length ? cover : others.slice(0, 1))
  const toggle = (id: string): void => setBound((b) => (b.includes(id) ? b.filter((x) => x !== id) : [...b, id]))
  const [search, setSearch] = useState('')
  const [stepIndex, setStepIndex] = useState(0)
  const [furthest, setFurthest] = useState(0)

  const values = resolveParamValues(params, answers)
  const picked = useMemo(() => pickVariant(concept, values).nodes, [concept, JSON.stringify(values)])
  // A detail shows only when the answers keep an element that uses it.
  const used = templateKeysUsed({ nodes: picked })
  // A question shows while its answer matters: another answer would pick
  // other elements, or the elements picked use it (no second factor to ask
  // about when nobody signs in).
  const ids = (nodes: Array<Record<string, unknown>>): string => nodes.map((n) => n.id).join(' ')
  const matters = (p: TemplateParam): boolean => used.has(p.key)
    || (p.options ?? []).some((o) => ids(pickVariant(concept, { ...values, [p.key]: o.value }).nodes) !== ids(picked))
  const steps: Step[] = [
    { kind: 'scope', title: 'Scope' },
    ...params.filter((p) => p.options?.length && matters(p)).map((p): Step => ({ kind: 'question', title: p.title ?? p.label, param: p })),
    ...(params.some((p) => !p.options?.length && used.has(p.key))
      ? [{ kind: 'details', title: 'Details', params: params.filter((p) => !p.options?.length && used.has(p.key)) } as Step]
      : []),
    { kind: 'review', title: 'Review' },
  ]
  const index = Math.min(stepIndex, steps.length - 1)
  const step = steps[index]
  const isLast = index === steps.length - 1
  const boundNames = bound.map((id) => nodes[id]?.label).filter(Boolean)
  // What the chosen elements cover of what the concern applies to.
  const applies = [...new Set(suggestions.flatMap((c) => c.covers))]
  const covered = applies.filter((t) => suggestions.some((c) => bound.includes(c.id) && c.covers.includes(t)))

  const goTo = (i: number): void => {
    setStepIndex(i)
    setFurthest((f) => Math.max(f, i))
  }
  // Bound to nothing it still comes in, as Forge brings it before C4: the
  // check's concern-unbound reports it until it is bound.
  const add = (): void => { if (!problem) onImport(answers, bound) }
  const next = (): void => (isLast ? add() : goTo(index + 1))

  const addRef = useRef(add)
  addRef.current = add
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel() }
      else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); addRef.current() }
    }
    // Capture: the Hub dialog beneath closes on Escape too.
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onCancel])

  const bodyRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = bodyRef.current?.querySelector<HTMLElement>('[aria-checked="true"], input')
    el?.focus()
  }, [index])

  const texts = answerTexts(params, values)
  const fill = (v: unknown): string => String(v ?? '').replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, k: string) => texts[k] ?? '')
  const listed = others.filter((id) => !search.trim() || `${nodes[id].label} ${nodes[id].type}`.toLowerCase().includes(search.trim().toLowerCase()))

  const heading = step.kind === 'scope' ? 'Which part of the system does it cover?'
    : step.kind === 'question' ? step.param.label
    : step.kind === 'details' ? 'A few details'
    : `What comes into ${boundNames.length === 1 ? boundNames[0] : boundNames.length ? `${boundNames.length} elements` : 'the model'}`
  const help = step.kind === 'scope'
    ? `${concept.concern?.why ? capital(concept.concern.why) + ' ' : ''}Bind it to one element or several; a decision on a system covers everything inside it.`
    : step.kind === 'question' ? step.param.hint
    : step.kind === 'details' ? 'They go into the requirements, the decision and its fitness functions.'
    : bound.length
      ? `The decision and its fitness functions constrain ${bound.length === 1 ? 'it' : 'each of them'}, and ${bound.length === 1 ? 'it satisfies' : 'each satisfies'} the requirements. The scenarios and fitness functions come without tests: the check lists them until you name yours.`
      : 'Bound to no element: the check reports the decision until it constrains the elements it is about, and the requirements until something satisfies them. The scenarios and fitness functions come without tests.'

  return createPortal(
    <div className="nw-backdrop cw-backdrop" onMouseDown={onCancel}>
      <div
        className="nw cw"
        role="dialog"
        aria-modal="true"
        aria-label={`${concept.name} — concern`}
        data-testid="concern-wizard"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <aside className="nw-side">
          <div className="nw-type">
            <span className="nw-type-icon" style={{ background: NODE_COLORS.adr, width: 36, height: 36 }} aria-hidden="true">
              <svg viewBox="0 0 16 16" width={18} height={18} fill={NODE_FG.adr}><path d={TYPE_ICON_PATHS.adr} /></svg>
            </span>
            <div className="nw-type-text">
              <div className="nw-type-label">{concept.concern ? `${CONCERN_GROUPS.find((g) => g.id === concept.concern!.group)?.label ?? 'Concern'} · concern pack` : 'Concern pack'}</div>
              <div className="nw-title" title={concept.name}>{concept.name}</div>
              {position && <div className="cw-position" data-testid="concern-position">Pack {position}</div>}
            </div>
          </div>

          <ol className="nw-steps">
            {steps.map((s, i) => {
              const state = i === index ? 'active' : i <= furthest ? 'done' : 'todo'
              const answer = s.kind === 'question' ? s.param.options?.find((o) => o.value === values[s.param.key])?.label
                : s.kind === 'scope' ? (boundNames.length > 1 ? `${boundNames[0]} +${boundNames.length - 1}` : boundNames[0]) : undefined
              return (
                <li key={`${s.kind}-${s.title}`} className={`nw-step-item ${state}`}>
                  <button type="button" className="nw-step" aria-current={i === index ? 'step' : undefined} onClick={() => goTo(i)}>
                    <span className="nw-step-dot" aria-hidden="true">{state === 'done' ? <CheckIcon /> : i + 1}</span>
                    <span className="cw-step-text">
                      <span className="nw-step-title">{s.title}</span>
                      {answer && i !== index && <span className="cw-step-answer">{capital(answer)}</span>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>

          <div className="nw-keys" aria-hidden="true">
            <span><kbd>{isMac() ? '⌘' : 'Ctrl'}</kbd><kbd>↵</kbd> add</span>
            <span><kbd>Esc</kbd> cancel</span>
          </div>
        </aside>

        <section className="nw-main">
          <div className="nw-progress" aria-hidden="true">
            <div className="nw-progress-bar" style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
          </div>
          <header className="nw-head">
            <div className="nw-eyebrow">Step {index + 1} of {steps.length}</div>
            <h2 className="nw-heading">{heading}</h2>
            {help && <p className="nw-help">{help}</p>}
            <button type="button" className="nw-close" aria-label="Close" onClick={onCancel}>
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </header>

          <div className="nw-body" key={index} ref={bodyRef}>
            {step.kind === 'scope' && (
              <div className="cw-scope">
                {suggestions.length > 0 && (
                  <section className="cw-review-section">
                    <div className="cw-section-head">
                      <h3 className="nw-label">Where the concern applies</h3>
                      <span className={`nw-count${covered.length === applies.length ? ' active' : ''}`}>
                        {covered.length} of {applies.length} covered
                      </span>
                    </div>
                    <Cards label="Bind to" onEnter={next}>
                      {suggestions.map(({ id, covers }) => (
                        <Card
                          key={id}
                          multi
                          selected={bound.includes(id)}
                          onSelect={() => toggle(id)}
                          title={nodes[id].label}
                          tag={TYPE_LABELS[nodes[id].type as C4Node['type']] ?? nodes[id].type}
                          badge={cover.includes(id) ? 'Suggested' : undefined}
                          text={covers.length === 1 && covers[0] === id ? 'Covers itself.' : `Covers ${covers.length}: ${covers.map((c) => nodes[c]?.label).join(', ')}.`}
                        />
                      ))}
                    </Cards>
                  </section>
                )}
                {others.length > 0 && (
                  <section className="cw-review-section">
                    <div className="cw-section-head">
                      <h3 className="nw-label">{suggestions.length ? 'Other elements' : 'Elements'}</h3>
                      <div className="nw-search">
                        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                        <input className="nw-input" type="search" placeholder="Find an element…" aria-label="Find an element" value={search} onChange={(e) => setSearch(e.target.value)} />
                      </div>
                    </div>
                    <ul className="nw-options cw-others">
                      {listed.map((id) => (
                        <li key={id}>
                          <label className={`nw-option${bound.includes(id) ? ' selected' : ''}`}>
                            <input type="checkbox" className="nw-check" checked={bound.includes(id)} onChange={() => toggle(id)} />
                            <span className="nw-option-text">
                              <span className="nw-option-label">{nodes[id].label}</span>
                              <span className="nw-option-type">{TYPE_LABELS[nodes[id].type as C4Node['type']] ?? nodes[id].type}</span>
                            </span>
                          </label>
                        </li>
                      ))}
                      {!listed.length && <li className="cw-muted">No element matches.</li>}
                    </ul>
                  </section>
                )}
                {!suggestions.length && !others.length && (
                  <div className="nw-empty">{problem
                    ? `This model cannot take the pack: ${problem}.`
                    : 'Nothing in the model can carry this decision yet: add the system or container it is about first.'}</div>
                )}
              </div>
            )}

            {step.kind === 'question' && (
              <Cards label={step.param.label} onEnter={next}>
                {step.param.options!.map((o) => (
                  <Card
                    key={o.value}
                    selected={values[step.param.key] === o.value}
                    onSelect={() => setAnswers((a) => ({ ...a, [step.param.key]: o.value }))}
                    title={capital(o.label)}
                    text={o.description}
                  />
                ))}
              </Cards>
            )}

            {step.kind === 'details' && (
              <div className="nw-fields">
                {step.params.map((p) => (
                  <label key={p.key} className="nw-field">
                    <span className="nw-label">{p.label}</span>
                    <input
                      className="nw-input"
                      type={p.type === 'number' ? 'number' : 'text'}
                      value={answers[p.key] ?? ''}
                      placeholder={p.defaultValue}
                      onChange={(e) => setAnswers((a) => ({ ...a, [p.key]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); next() } }}
                      spellCheck={false}
                      autoComplete="off"
                    />
                  </label>
                ))}
              </div>
            )}

            {step.kind === 'review' && <Review picked={picked} fill={fill} />}
          </div>

          <footer className="nw-foot">
            {problem
              ? <span className="nw-missing" role="alert">Cannot be added: {problem}</span>
              : !bound.length && <span className="nw-missing">Not bound: the check will list it until it is</span>}
            <span className="nw-spacer" />
            {index > 0 && <button type="button" className="nw-btn ghost" onClick={() => goTo(index - 1)}>Back</button>}
            {!isLast && <button type="button" className="nw-btn secondary" onClick={add} disabled={!!problem}>Add to model</button>}
            {isLast ? (
              <button type="button" className="nw-btn primary" onClick={add} disabled={!!problem}>Add to model</button>
            ) : (
              <button type="button" className="nw-btn primary" onClick={next}>
                Next
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                  <path d="M6 3.5L10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </footer>
        </section>
      </div>
    </div>,
    document.body,
  )
}

/** A single choice among cards: arrows move it, Enter goes on. */
function Cards({ label, onEnter, children }: { label: string; onEnter: () => void; children: React.ReactNode }): React.ReactElement {
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    const cards = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"], [role="checkbox"]')]
    const at = cards.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const to = cards[(at + (e.key === 'ArrowDown' ? 1 : cards.length - 1)) % cards.length]
      to?.focus()
      if (to?.getAttribute('role') === 'radio') to.click()
    } else if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      onEnter()
    }
  }
  return <div className="cw-cards" role="group" aria-label={label} onKeyDown={onKeyDown}>{children}</div>
}

function Card({ selected, onSelect, title, tag, badge, text, multi }: {
  selected: boolean; onSelect: () => void; title: string; tag?: string; badge?: string; text?: string
  /** One of several that may be chosen (a checkbox), not the one (a radio). */
  multi?: boolean
}): React.ReactElement {
  return (
    <button
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={selected}
      tabIndex={multi || selected ? 0 : -1}
      className={`cw-card${selected ? ' selected' : ''}`}
      onClick={onSelect}
    >
      <span className={multi ? 'cw-box' : 'cw-radio'} aria-hidden="true" />
      <span className="cw-card-text">
        <span className="cw-card-title">
          {title}
          {tag && <span className="cw-card-tag">{tag}</span>}
          {badge && <span className="cw-badge">{badge}</span>}
        </span>
        {text && <span className="cw-card-desc">{text}</span>}
      </span>
    </button>
  )
}

function Review({ picked, fill }: { picked: Array<Record<string, unknown>>; fill: (v: unknown) => string }): React.ReactElement {
  const of = (type: string) => picked.filter((n) => n.type === type)
  const adr = of('adr')[0]
  const requirements = of('requirement')
  const checks = of('fitness-fn')
  const scenarios = of('scenario')
  return (
    <div className="cw-review" data-testid="concern-brings">
      {adr && (
        <section className="cw-review-section">
          <h3 className="nw-label">Decision</h3>
          <div className="nw-preview cw-decision">
            <strong>{fill(adr.label)}</strong>
            <p>{fill(adr.decision)}</p>
          </div>
        </section>
      )}
      <section className="cw-review-section">
        <h3 className="nw-label">{requirements.length} requirement{requirements.length === 1 ? '' : 's'}</h3>
        <ul className="cw-list">
          {requirements.map((r) => <li key={String(r.id)}><span className="cw-dot" style={{ background: NODE_COLORS.requirement }} aria-hidden="true" />{fill(r.label)}</li>)}
        </ul>
      </section>
      {checks.length > 0 && (
        <section className="cw-review-section">
          <h3 className="nw-label">Checked by</h3>
          <ul className="cw-list">
            {checks.map((f) => (
              <li key={String(f.id)}>
                <span className="cw-dot" style={{ background: NODE_COLORS['fitness-fn'] }} aria-hidden="true" />
                <span><strong>{fill(f.label)}</strong><span className="cw-muted"> — {fill(f.threshold)}</span></span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="cw-note">
        Also {scenarios.length} scenario{scenarios.length === 1 ? '' : 's'} and the need they come from. Name the tests of the scenarios and fitness functions to have them verified.
      </p>
    </div>
  )
}

function isMac(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.platform?.includes('Mac')
}

function CheckIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
