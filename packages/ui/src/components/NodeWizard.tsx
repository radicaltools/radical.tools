import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  composeEarsSentence,
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
import { NODE_COLORS, NODE_FG, TYPE_ICON_PATHS, TYPE_LABELS, type C4Node } from '@radical/common/c4'
import { useDiagramStore, type NodeWizardSession } from '../store/diagramStore'
import { EarsQuickEntry } from './EarsQuickEntry'

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

  const typeLabel = typeDef?.label ?? TYPE_LABELS[type as C4Node['type']] ?? type
  const badgeBg = typeDef?.color ?? NODE_COLORS[type as C4Node['type']] ?? '#334155'
  const badgeFg = typeDef?.fg ?? NODE_FG[type as C4Node['type']] ?? '#fff'
  const badgeIcon = typeDef?.iconPath ?? TYPE_ICON_PATHS[type as C4Node['type']]
  const title = session.mode === 'create'
    ? `New ${typeLabel}`
    : String(c4Nodes[session.nodeId]?.label ?? typeLabel)

  const done = (): void => {
    if (missing.length) return
    finish(values, links)
  }
  const next = (): void => (isLast ? done() : setStepIndex((i) => i + 1))

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
    <div className="milestone-modal-backdrop" onMouseDown={cancel}>
      <div
        className="node-wizard"
        role="dialog"
        aria-modal="true"
        aria-label={`${title} — wizard`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="node-wizard-header">
          <span className="props-type-badge" style={{ background: badgeBg, color: badgeFg }}>
            {badgeIcon && (
              <svg viewBox="0 0 16 16" width="14" height="14" fill={badgeFg} style={{ marginRight: 6 }}>
                <path d={badgeIcon} />
              </svg>
            )}
            {typeLabel.toUpperCase()}
          </span>
          <h3 className="node-wizard-title">{title}</h3>
        </header>

        <ol className="node-wizard-steps">
          {steps.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                className={`node-wizard-step${i === stepIndex ? ' active' : ''}${i < stepIndex ? ' done' : ''}`}
                aria-current={i === stepIndex ? 'step' : undefined}
                onClick={() => setStepIndex(i)}
              >
                <span className="node-wizard-step-num">{i + 1}</span>
                {s.title}
              </button>
            </li>
          ))}
        </ol>

        <div className="node-wizard-body" ref={bodyRef}>
          {step.help && <p className="node-wizard-help">{step.help}</p>}
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
              typeLabelOf={(t) => metamodel?.nodeTypes[t]?.label ?? TYPE_LABELS[t as C4Node['type']] ?? t}
            />
          )}
          {step.kind === 'custom' && (
            <CustomStep step={step} values={values} setValues={setValues} sessionKey={selfId ?? 'new'} nodes={c4Nodes} relations={c4Relations} links={links} />
          )}
        </div>

        <footer className="node-wizard-footer">
          <button type="button" className="node-wizard-btn ghost" onClick={cancel}>Cancel</button>
          <span className="node-wizard-footer-hint">
            {missing.length ? `Required: ${missing.join(', ')}` : `${isMac() ? '⌘' : 'Ctrl'}+Enter to ${session.mode === 'create' ? 'create' : 'save'}`}
          </span>
          {stepIndex > 0 && (
            <button type="button" className="node-wizard-btn" onClick={() => setStepIndex((i) => i - 1)}>Back</button>
          )}
          {!isLast && (
            <button type="button" className="node-wizard-btn" onClick={next}>Next</button>
          )}
          <button
            type="button"
            className="node-wizard-btn primary"
            disabled={missing.length > 0}
            onClick={done}
          >
            {session.mode === 'create' ? 'Create' : 'Save'}
          </button>
        </footer>
      </div>
    </div>
  )
}

function isMac(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.platform?.includes('Mac')
}

function FieldsStep({ fields, values, setValue, roomy, onEnter }: {
  fields: PropertyDef[]
  values: Record<string, unknown>
  setValue: (key: string, value: unknown) => void
  roomy: boolean
  onEnter: () => void
}): React.ReactElement {
  return (
    <>
      {fields.map((p) => {
        const value = values[p.key]
        const id = `node-wizard-field-${p.key}`
        if (p.type === 'boolean') {
          return (
            <label className="node-wizard-check" key={p.key}>
              <input type="checkbox" checked={Boolean(value)} onChange={(e) => setValue(p.key, e.target.checked)} />
              {p.label}
            </label>
          )
        }
        return (
          <div className="props-field" key={p.key}>
            <label className="props-label" htmlFor={id}>
              {p.label}{p.required ? ' *' : ''}
            </label>
            {p.type === 'enum' ? (
              <select id={id} className="props-input" value={String(value ?? '')}
                onChange={(e) => setValue(p.key, e.target.value)}>
                {!p.options?.includes(String(value ?? '')) && <option value="" />}
                {(p.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : p.type === 'textarea' ? (
              <textarea id={id} className="props-textarea" rows={roomy ? 10 : 4}
                value={String(value ?? '')} onChange={(e) => setValue(p.key, e.target.value)} />
            ) : (
              <input id={id} className="props-input" type={p.type === 'number' ? 'number' : 'text'}
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
    </>
  )
}

function RelationsStep({ step, candidates, links, setLinks, typeLabelOf }: {
  step: WizardRelationsStep
  candidates: C4Node[]
  links: WizardLink[]
  setLinks: React.Dispatch<React.SetStateAction<WizardLink[]>>
  typeLabelOf: (type: string) => string
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
    return <p className="node-wizard-empty">Nothing in the model can be linked here yet — you can add these relations later.</p>
  }
  return (
    <>
      {candidates.length > 6 && (
        <input className="props-input node-wizard-filter" placeholder="Filter…" value={filter}
          onChange={(e) => setFilter(e.target.value)} />
      )}
      <ul className="node-wizard-options">
        {shown.map((n) => (
          <li key={n.id}>
            <label className="node-wizard-check">
              <input type="checkbox" checked={isLinked(n.id)} onChange={() => toggle(n.id)} />
              <span className="node-wizard-option-label">{n.label}</span>
              <span className="node-wizard-option-type">{typeLabelOf(n.type)}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="node-wizard-count">{selected} selected</div>
    </>
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
  const { sentence, complete } = composeEarsSentence(values, subject)
  return (
    <>
      <EarsQuickEntry nodeId={sessionKey} updateNode={(_id, patch) => setValues((v) => ({ ...v, ...patch }))} />
      <p className={`node-wizard-sentence${complete ? '' : ' incomplete'}`}>{sentence}</p>
    </>
  )
}
