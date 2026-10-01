// ─── Node wizard helpers ─────────────────────────────────────────────────────
//
// Pure functions behind the node wizard UI: which wizard applies, which
// fields a step shows for the values entered so far, which existing nodes a
// relations step offers, and what is still missing before it can finish.

import { isPropertyVisible } from './lookup'
import type {
  Metamodel,
  NodeTypeDef,
  NodeWizardDef,
  PropertyDef,
  WizardRelationsStep,
  WizardStep,
} from './types'

/** A relation the wizard will create between its node and `otherId`. */
export interface WizardLink {
  relationType: string
  /** 'out' — the wizard's node is the source; 'in' — it is the target. */
  direction: 'out' | 'in'
  otherId: string
}

export function sameWizardLink(a: WizardLink, b: WizardLink): boolean {
  return a.relationType === b.relationType && a.direction === b.direction && a.otherId === b.otherId
}

/** `label` and `description` live on every node but aren't PropertyDefs. */
const BUILTIN_FIELDS: Record<string, PropertyDef> = {
  label: { key: 'label', label: 'Name', type: 'text', required: true },
  description: { key: 'description', label: 'Description', type: 'textarea' },
}

/** The wizard for `typeId`, or undefined. With `trigger: 'create'`, only a
 *  wizard that opens on creation counts. */
export function wizardFor(
  metamodel: Metamodel | undefined,
  typeId: string,
  trigger?: 'create',
): NodeWizardDef | undefined {
  const wizard = metamodel?.nodeTypes[typeId]?.wizard
  if (!wizard || wizard.steps.length === 0) return undefined
  if (trigger && wizard.trigger !== trigger) return undefined
  return wizard
}

/** The wizard's starting values, with `{{today}}` resolved. */
export function wizardPrefill(wizard: NodeWizardDef, now: Date = new Date()): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(wizard.prefill ?? {})) {
    out[key] = value === '{{today}}' ? isoDate(now) : value
  }
  return out
}

function isoDate(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** The fields a step shows, given the values entered so far. Unknown keys
 *  are dropped, as are properties hidden by `visibleWhen`. */
export function wizardStepFields(
  step: WizardStep,
  typeDef: NodeTypeDef | undefined,
  values: Record<string, unknown>,
): PropertyDef[] {
  if (step.kind !== 'fields') return []
  const props = typeDef?.properties ?? []
  const out: PropertyDef[] = []
  for (const key of step.fields) {
    const def = props.find((p) => p.key === key) ?? BUILTIN_FIELDS[key]
    if (def && isPropertyVisible(def, values)) out.push(def)
  }
  return out
}

/** Node types a relations step may link to, or `null` when its relation
 *  type allows any pair. */
export function wizardRelationTargetTypes(
  metamodel: Metamodel | undefined,
  step: WizardRelationsStep,
  nodeType: string,
): string[] | null {
  const rt = metamodel?.relationTypes[step.relationType]
  if (!rt) return []
  if (rt.allowedPairs.length === 0) return null
  const types = step.direction === 'out'
    ? rt.allowedPairs.filter((p) => p.from === nodeType).map((p) => p.to)
    : rt.allowedPairs.filter((p) => p.to === nodeType).map((p) => p.from)
  return [...new Set(types)]
}

/** Existing nodes a relations step offers, sorted by type then label. */
export function wizardRelationCandidates<N extends { id: string; type: string; label: string }>(
  metamodel: Metamodel | undefined,
  step: WizardRelationsStep,
  nodeType: string,
  nodes: Record<string, N>,
  selfId?: string,
): N[] {
  const types = wizardRelationTargetTypes(metamodel, step, nodeType)
  return Object.values(nodes)
    .filter((n) => n.id !== selfId && (types === null || types.includes(n.type)))
    .sort((a, b) => a.type.localeCompare(b.type) || a.label.localeCompare(b.label))
}

/** The node's existing relations that the wizard's relation steps cover —
 *  what an edit-mode wizard starts with checked. */
export function wizardLinksOf(
  wizard: NodeWizardDef,
  nodeId: string,
  relations: Record<string, { id: string; sourceId: string; targetId: string; relationType?: string }>,
): Array<WizardLink & { relationId: string }> {
  const out: Array<WizardLink & { relationId: string }> = []
  const seen: WizardLink[] = []
  for (const step of wizard.steps) {
    if (step.kind !== 'relations') continue
    for (const r of Object.values(relations)) {
      if (r.relationType !== step.relationType) continue
      const otherId = step.direction === 'out'
        ? (r.sourceId === nodeId ? r.targetId : null)
        : (r.targetId === nodeId ? r.sourceId : null)
      if (!otherId) continue
      const link: WizardLink = { relationType: step.relationType, direction: step.direction, otherId }
      // Two steps over the same relation type + direction share their links.
      if (seen.some((l) => sameWizardLink(l, link))) continue
      seen.push(link)
      out.push({ ...link, relationId: r.id })
    }
  }
  return out
}

/** Whether a step has anything to offer this node type — a relations step
 *  whose relation type can't involve it is skipped. */
export function isWizardStepApplicable(
  metamodel: Metamodel | undefined,
  step: WizardStep,
  nodeType: string,
): boolean {
  if (step.kind !== 'relations') return true
  const types = wizardRelationTargetTypes(metamodel, step, nodeType)
  return types === null || types.length > 0
}

/** Labels of required, visible fields across the wizard's steps that are
 *  still empty. */
export function wizardMissingRequired(
  wizard: NodeWizardDef,
  typeDef: NodeTypeDef | undefined,
  values: Record<string, unknown>,
): string[] {
  const missing: string[] = []
  for (const step of wizard.steps) {
    for (const def of wizardStepFields(step, typeDef, values)) {
      if (!def.required || def.type === 'boolean') continue
      const v = values[def.key]
      if (v === undefined || v === null || String(v).trim() === '') missing.push(def.label)
    }
  }
  return missing
}
