import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  composeEarsSentence,
  requirementStatePhrase,
  resolveEarsSubject,
  isWizardStepApplicable,
  sameWizardLink,
  wizardFor,
  wizardLinksOf,
  wizardMissingRequired,
  wizardPrefill,
  wizardRelationCandidates,
  wizardStepFields,
  type NodeTypeDef,
  type NodeWizardDef,
  type PropertyDef,
  type WizardLink,
  type WizardRelationsStep,
  type WizardStep,
} from '@radical/common/metamodel'
import { NODE_COLORS, NODE_FG, TYPE_ICON_PATHS, TYPE_LABELS, type C4Node, type C4Relation } from '@radical/common/c4'
import { useDiagramStore, type NodeWizardSession } from '../store/diagramStore'
import { EarsQuickEntry } from './EarsQuickEntry'
import { RefPicker } from './RefPicker'

/**
 * Step-by-step form for a node type with a `wizard` in the metamodel. Opens
 * when the store has a wizard session — `requestCreateNode` (canvas, table,
 * wiki) for a new node, `openNodeWizard` for an existing one — so it is
 * mounted once, at the app root, and covers every place a node is created.
 */
export function NodeWizard(): React.ReactElement | null {
  const session = useDiagramStore((s) => s.nodeWizard)
  const metamodel = useDiagramStore((s) => s.metamodel)
  const c4Nodes = useDiagramStore((s) => s.c4Nodes)
  if (!session) return null
  const type = session.mode === 'create' ? session.draft.type : c4Nodes[session.nodeId]?.type
  const wizard = type ? wizardFor(metamodel, type) : undefined
  if (!type || !wizard) return null
  return <WizardDialog session={session} wizard={wizard} typeDef={metamodel?.nodeTypes[type]} type={type} />
}

function initialValues(session: NodeWizardSession, wizard: NodeWizardDef, typeDef: NodeTypeDef | undefined): Record<string, unknown> {
  const state = useDiagramStore.getState()
  const keys = new Set<string>()
  for (const step of wizard.steps) {
    if (step.kind === 'fields') step.fields.forEach((k) => keys.add(k))
  }
  if (session.mode === 'create') {
    const values: Record<string, unknown> = { label: session.draft.label }
    for (const p of typeDef?.properties ?? []) {
      if (p.default !== undefined) values[p.key] = p.default
    }
    return { ...values, ...wizardPrefill(wizard) }
  }
  const node = state.c4Nodes[session.nodeId] as (C4Node & Record<string, unknown>) | undefined
  const values: Record<string, unknown> = {}
  for (const k of keys) values[k] = node?.[k]
  // EARS fields are filled by the custom step, not listed in a fields step.
  for (const p of typeDef?.properties ?? []) {
    if (!(p.key in values)) values[p.key] = node?.[p.key]
  }
  return values
}


type TypeMeta = { label: string; color: string; fg: string; iconPath?: string }

function WizardDialog({ session, wizard, typeDef, type }: {
  session: NodeWizardSession
  wizard: NodeWizardDef
  typeDef: NodeTypeDef | undefined
  type: string
}): React.ReactElement {
  const metamodel = useDiagramStore((s) => s.metamodel)
  const c4Nodes = useDiagramStore((s) => s.c4Nodes)
  const c4Relations = useDiagramStore((s) => s.c4Relations)
  const finish = useDiagramStore((s) => s.finishNodeWizard)
  const cancel = useDiagramStore((s) => s.cancelNodeWizard)

  const selfId = session.mode === 'edit' ? session.nodeId : undefined
  const steps = useMemo(
    () => wizard.steps.filter((s) => isWizardStepApplicable(metamodel, s, type)),
    [wizard, metamodel, type],
  )
  const [stepIndex, setStepIndex] = useState(0)
  const [furthest, setFurthest] = useState(0)
  const [values, setValues] = useState(() => initialValues(session, wizard, typeDef))
  const [links, setLinks] = useState<WizardLink[]>(() =>
    session.mode === 'create'
      ? session.initialLinks
      : wizardLinksOf(wizard, session.nodeId, useDiagramStore.getState().c4Relations)
          .map(({ relationType, direction, otherId }) => ({ relationType, direction, otherId })),
  )

  const step = steps[Math.min(stepIndex, steps.length - 1)]
  const isLast = stepIndex >= steps.length - 1
  const missing = wizardMissingRequired(wizard, typeDef, values)
  const verb = session.mode === 'create' ? 'Create' : 'Save'

  const typeMetaOf = (t: string): TypeMeta => {
    const def = metamodel?.nodeTypes[t]
    const c4 = t as C4Node['type']
    return {
      label: def?.label ?? TYPE_LABELS[c4] ?? t,
      color: def?.color ?? NODE_COLORS[c4] ?? '#334155',
      fg: def?.fg ?? NODE_FG[c4] ?? '#fff',
      iconPath: def?.iconPath ?? TYPE_ICON_PATHS[c4],
    }
  }
  const meta = typeMetaOf(type)
  const title = session.mode === 'create'
    ? `New ${meta.label}`
    : String(c4Nodes[session.nodeId]?.label ?? meta.label)

  const goTo = (i: number): void => {
    setStepIndex(i)
    setFurthest((f) => Math.max(f, i))
  }
  const done = (): void => {
    if (missing.length) return
    finish(values, links)
  }
  const next = (): void => (isLast ? done() : goTo(stepIndex + 1))

  // Esc cancels, Ctrl/Cmd+Enter finishes from any step.
  const doneRef = useRef(done)
  doneRef.current = done
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); cancel() }
      else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); doneRef.current() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cancel])

  // Focus the step's first input.
  const bodyRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = bodyRef.current?.querySelector<HTMLElement>('input, textarea, select')
    el?.focus()
    if (el instanceof HTMLInputElement && el.type === 'text') el.select()
  }, [stepIndex])

  const setValue = (key: string, value: unknown): void => setValues((v) => ({ ...v, [key]: value }))

  return (
    <div className="nw-backdrop" onMouseDown={cancel}>
      <div
        className="nw"
        role="dialog"
        aria-modal="true"
        aria-label={`${title} — wizard`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <aside className="nw-side">
          <div className="nw-type">
            <TypeIcon meta={meta} size={36} />
            <div className="nw-type-text">
              <div className="nw-type-label">{meta.label}</div>
              <div className="nw-title" title={title}>{title}</div>
            </div>
          </div>

          <ol className="nw-steps">
            {steps.map((s, i) => {
              const state = i === stepIndex ? 'active' : i <= furthest ? 'done' : 'todo'
              return (
                <li key={i} className={`nw-step-item ${state}`}>
                  <button
                    type="button"
                    className="nw-step"
                    aria-current={i === stepIndex ? 'step' : undefined}
                    onClick={() => goTo(i)}
                  >
                    <span className="nw-step-dot" aria-hidden="true">
                      {state === 'done' ? <CheckIcon /> : i + 1}
                    </span>
                    <span className="nw-step-title">{s.title}</span>
                  </button>
                </li>
              )
            })}
          </ol>

          <div className="nw-keys" aria-hidden="true">
            <span><kbd>{isMac() ? '⌘' : 'Ctrl'}</kbd><kbd>↵</kbd> {verb.toLowerCase()}</span>
            <span><kbd>Esc</kbd> cancel</span>
          </div>
        </aside>

        <section className="nw-main">
          <div className="nw-progress" aria-hidden="true">
            <div className="nw-progress-bar" style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} />
          </div>

          <header className="nw-head">
            <div className="nw-eyebrow">Step {stepIndex + 1} of {steps.length}</div>
            <h2 className="nw-heading">{step.title}</h2>
            {step.help && <p className="nw-help">{step.help}</p>}
            <button type="button" className="nw-close" aria-label="Close" onClick={cancel}>
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </header>

          <div className="nw-body" key={stepIndex} ref={bodyRef}>
            {step.kind === 'fields' && (
              <FieldsStep
                fields={wizardStepFields(step, typeDef, values)}
                values={values}
                setValue={setValue}
                // A single field gets the whole step, so give it room.
                roomy={step.fields.length === 1}
                onEnter={next}
              />
            )}
            {step.kind === 'relations' && (
              <RelationsStep
                step={step}
                candidates={wizardRelationCandidates(metamodel, step, type, c4Nodes, selfId)}
                links={links}
                setLinks={setLinks}
                typeMetaOf={typeMetaOf}
              />
            )}
            {step.kind === 'custom' && (
              <CustomStep step={step} values={values} setValues={setValues} sessionKey={selfId ?? 'new'} nodes={c4Nodes} relations={c4Relations} links={links} />
            )}
          </div>

          <footer className="nw-foot">
            {missing.length > 0 && <span className="nw-missing">Required: {missing.join(', ')}</span>}
            <span className="nw-spacer" />
            {stepIndex > 0 && (
              <button type="button" className="nw-btn ghost" onClick={() => goTo(stepIndex - 1)}>Back</button>
            )}
            {!isLast && (
              <button type="button" className="nw-btn secondary" disabled={missing.length > 0} onClick={done}>{verb}</button>
            )}
            {isLast ? (
              <button type="button" className="nw-btn primary" disabled={missing.length > 0} onClick={done}>{verb}</button>
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

function TypeIcon({ meta, size }: { meta: TypeMeta; size: number }): React.ReactElement {
  return (
    <span className="nw-type-icon" style={{ background: meta.color, width: size, height: size }} aria-hidden="true">
      {meta.iconPath && (
        <svg viewBox="0 0 16 16" width={Math.round(size * 0.5)} height={Math.round(size * 0.5)} fill={meta.fg}>
          <path d={meta.iconPath} />
        </svg>
      )}
    </span>
  )
}

/** Enums with up to this many options render as chips instead of a select. */
const MAX_CHOICE_CHIPS = 6

function FieldsStep({ fields, values, setValue, roomy, onEnter }: {
  fields: PropertyDef[]
  values: Record<string, unknown>
  setValue: (key: string, value: unknown) => void
  roomy: boolean
  onEnter: () => void
}): React.ReactElement {
  return (
    <div className="nw-fields">
      {fields.map((p) => {
        const value = values[p.key]
        const id = `nw-field-${p.key}`
        const label = (
          <>
            {p.label}
            {p.required && <span className="nw-required" aria-hidden="true">*</span>}
          </>
        )
        if (p.type === 'boolean') {
          return (
            <label className="nw-switch" key={p.key}>
              <input type="checkbox" role="switch" checked={Boolean(value)} onChange={(e) => setValue(p.key, e.target.checked)} />
              <span className="nw-switch-track" aria-hidden="true" />
              {label}
            </label>
          )
        }
        if (p.type === 'ref') {
          return (
            <div className="nw-field" key={p.key}>
              <div className="nw-label">{label}</div>
              <RefPicker def={p} value={value} className="nw-input" onChange={(v) => setValue(p.key, v)} />
            </div>
          )
        }
        if (p.type === 'enum' && (p.options?.length ?? 0) <= MAX_CHOICE_CHIPS) {
          return (
            <div className="nw-field" key={p.key}>
              <div className="nw-label" id={`${id}-label`}>{label}</div>
              <div className="nw-choices" role="radiogroup" aria-labelledby={`${id}-label`}>
                {(p.options ?? []).map((o) => (
                  <button
                    key={o}
                    type="button"
                    role="radio"
                    aria-checked={value === o}
                    className="nw-choice"
                    onClick={() => setValue(p.key, o)}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>
          )
        }
        return (
          // The only field of a step repeats the step heading — keep its
          // label for screen readers only.
          <div className={`nw-field${roomy ? ' solo' : ''}${roomy && p.type === 'textarea' ? ' grow' : ''}`} key={p.key}>
            <label className="nw-label" htmlFor={id}>{label}</label>
            {p.type === 'enum' ? (
              <select id={id} className="nw-input" value={String(value ?? '')}
                onChange={(e) => setValue(p.key, e.target.value)}>
                {!p.options?.includes(String(value ?? '')) && <option value="" />}
                {(p.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : p.type === 'textarea' ? (
              <textarea id={id} className={`nw-input nw-textarea${roomy ? ' roomy' : ''}`}
                value={String(value ?? '')} onChange={(e) => setValue(p.key, e.target.value)} />
            ) : (
              <input id={id} className="nw-input" type={p.type === 'number' ? 'number' : 'text'}
                value={String(value ?? '')}
                onChange={(e) => setValue(p.key, p.type === 'number'
                  ? (e.target.value === '' ? undefined : Number(e.target.value))
                  : e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); onEnter() }
                }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function RelationsStep({ step, candidates, links, setLinks, typeMetaOf }: {
  step: WizardRelationsStep
  candidates: C4Node[]
  links: WizardLink[]
  setLinks: React.Dispatch<React.SetStateAction<WizardLink[]>>
  typeMetaOf: (type: string) => TypeMeta
}): React.ReactElement {
  const [filter, setFilter] = useState('')
  const q = filter.trim().toLowerCase()
  const shown = q ? candidates.filter((n) => n.label.toLowerCase().includes(q)) : candidates
  const linkFor = (otherId: string): WizardLink => ({ relationType: step.relationType, direction: step.direction, otherId })
  const isLinked = (otherId: string): boolean => links.some((l) => sameWizardLink(l, linkFor(otherId)))
  const toggle = (otherId: string): void => {
    const link = linkFor(otherId)
    setLinks((ls) => (ls.some((l) => sameWizardLink(l, link)) ? ls.filter((l) => !sameWizardLink(l, link)) : [...ls, link]))
  }
  const selected = candidates.filter((n) => isLinked(n.id)).length

  if (candidates.length === 0) {
    return (
      <div className="nw-empty">
        <svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true">
          <path d="M6.5 9.5l3-3M7 4.5l1-1a2.5 2.5 0 0 1 3.5 3.5l-1 1M9 11.5l-1 1A2.5 2.5 0 0 1 4.5 9l1-1" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <span>Nothing in the model can be linked here yet — you can add these relations later.</span>
      </div>
    )
  }
  return (
    <div className="nw-relations">
      <div className="nw-relations-bar">
        {candidates.length > 6 && (
          <div className="nw-search">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input className="nw-input" placeholder="Filter…" aria-label="Filter" value={filter}
              onChange={(e) => setFilter(e.target.value)} />
          </div>
        )}
        <span className="nw-spacer" />
        <span className={`nw-count${selected ? ' active' : ''}`}>{selected} selected</span>
      </div>
      <ul className="nw-options">
        {shown.map((n) => {
          const meta = typeMetaOf(n.type)
          const on = isLinked(n.id)
          return (
            <li key={n.id}>
              <label className={`nw-option${on ? ' selected' : ''}`}>
                <input type="checkbox" className="nw-check" checked={on} onChange={() => toggle(n.id)} />
                <TypeIcon meta={meta} size={26} />
                <span className="nw-option-text">
                  <span className="nw-option-label">{n.label}</span>
                  <span className="nw-option-type">{meta.label}</span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function CustomStep({ step, values, setValues, sessionKey, nodes, relations, links }: {
  step: Extract<WizardStep, { kind: 'custom' }>
  values: Record<string, unknown>
  setValues: React.Dispatch<React.SetStateAction<Record<string, unknown>>>
  sessionKey: string
  nodes: Record<string, C4Node>
  relations: Record<string, { sourceId: string; targetId: string; relationType?: string }>
  links: WizardLink[]
}): React.ReactElement | null {
  if (step.component !== 'ears-quick-entry') return null
  // The subject is whatever satisfies the requirement — from the model in
  // edit mode, or from a link already picked in this wizard.
  const satisfier = links.find((l) => l.relationType === 'satisfies' && l.direction === 'in')
  const subject = satisfier ? nodes[satisfier.otherId]?.label : resolveEarsSubject(sessionKey, relations, nodes)
  const statePhrase = requirementStatePhrase({ ...(values as object), id: sessionKey } as unknown as C4Node, nodes, relations as Record<string, C4Relation>)
  const { sentence, complete } = composeEarsSentence(values, subject, statePhrase)
  return (
    <div className="nw-ears">
      <EarsQuickEntry nodeId={sessionKey} updateNode={(_id, patch) => setValues((v) => ({ ...v, ...patch }))} />
      <div className={`nw-preview${complete ? '' : ' incomplete'}`}>
        <div className="nw-eyebrow">Preview</div>
        <p>{sentence}</p>
      </div>
    </div>
  )
}
