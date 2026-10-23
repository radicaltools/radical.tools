// ─── Relation rules ─────────────────────────────────────────────────────────
//
// The one check of whether a relation may be made: what Studio and the MCP
// server accept (checkAddRelation, checkPatchRelation) and what they offer
// to make (Add or link, the wizard's relation steps, the wiki's other
// relationships, the connect key, the type selects). Offered from a rule of
// their own, a picker listed what the model then refused (a system to the
// container it holds) or let through what Validation then flagged (an
// aggregate root part of another).

import { holderOf, type C4Node, type C4Relation } from './c4'
import {
  inferRelationType,
  isRelationAllowed,
  lifecycleRefusal,
  relationTypesFitting,
  sameWizardLink,
  transitionRefusal,
  wizardRelationCandidates,
  type Metamodel,
  type WizardLink,
  type WizardRelationsStep,
} from './metamodel'

/** The model a relation is checked against. */
export interface RelationContext {
  nodes: Record<string, C4Node>
  relations: Record<string, C4Relation> | C4Relation[]
  metamodel?: Metamodel
}

const typeLabel = (mm: Metamodel | undefined, type: string): string => mm?.nodeTypes[type]?.label ?? type

const hasStatecharts = (mm: Metamodel | undefined): boolean => !!(mm?.nodeTypes.state && mm.relationTypes.transition)

/** Whether a relation of `typeId` may join an element and what holds it:
 *  a governance relation (RelationTypeDef.governance), which containment
 *  does not say, or a transition to a state that holds its source, which is
 *  SCXML (it leaves and enters that state). Any other is structural, and
 *  containment already joins the two. */
export function relationMayJoinHolder(metamodel: Metamodel | undefined, typeId: string | undefined): boolean {
  if (!typeId) return false
  return typeId === 'transition' || !!metamodel?.relationTypes[typeId]?.governance
}

const kindOf = (n: C4Node): string => {
  const kind = (n as unknown as Record<string, unknown>).kind
  return typeof kind === 'string' && kind ? kind : 'aggregate-root'
}

/** Why a part-of from `part` to `root` breaks the aggregate rules: a root is
 *  part of nothing, a part belongs to a root, and to one only. Validation
 *  flags each (validateDomainModel). */
function aggregateRefusal(part: C4Node, root: C4Node, relations: C4Relation[], nodes: Record<string, C4Node>, exceptId?: string): string | null {
  if (part.type !== 'entity' || root.type !== 'entity') return null
  if (kindOf(part) === 'aggregate-root') return `"${part.label}" is an aggregate root, which is part of no other; aggregates refer to each other with "references".`
  if (kindOf(root) !== 'aggregate-root') return `"${root.label}" is not an aggregate root; a part belongs to the root of its aggregate.`
  const other = relations.find((r) => r.id !== exceptId && r.relationType === 'part-of' && r.sourceId === part.id && r.targetId !== root.id
    && nodes[r.targetId]?.type === 'entity')
  if (other) return `"${part.label}" is part of "${nodes[other.targetId].label}" already; an entity belongs to one aggregate.`
  return null
}

const relationList = (relations: Record<string, C4Relation> | C4Relation[]): C4Relation[] =>
  (Array.isArray(relations) ? relations : Object.values(relations))

const relationRecord = (relations: Record<string, C4Relation> | C4Relation[]): Record<string, C4Relation> =>
  (Array.isArray(relations) ? Object.fromEntries(relations.map((r) => [r.id, r])) : relations)

/** Why `rel` may not be made, or null: a new relation, or the relation
 *  `exceptId` changed into `rel` (its type `kept` stays where it still has
 *  the pair). Both ends are elements of the model; the metamodel allows the
 *  pair, and the type it names has it; between an element and what holds
 *  it only a relation that may join them (relationMayJoinHolder); a part-of
 *  keeps the aggregate rules; a transition and a lifecycle keep the
 *  statechart rules. */
export function relationRefusal(ctx: RelationContext, rel: Omit<C4Relation, 'id'>, exceptId?: string, kept?: string): string | null {
  const src = ctx.nodes[rel.sourceId]
  const dst = ctx.nodes[rel.targetId]
  // An end that is gone (removed outside while a picker listed it) leaves a
  // relation to nothing, which Validation then flags.
  if (!src || !dst) return `Relation not allowed: "${!src ? rel.sourceId : rel.targetId}" is no element of the model (it may have been deleted meanwhile).`
  const mm = ctx.metamodel
  if (!isRelationAllowed(mm, src.type, dst.type)) {
    return `Relation not allowed: ${typeLabel(mm, src.type)} → ${typeLabel(mm, dst.type)}. The metamodel does not permit this connection.`
  }
  // A relation that names its type must be one that type has between the two.
  const def = rel.relationType ? mm?.relationTypes[rel.relationType] : undefined
  if (def && !relationTypeAllows(def, src.type, dst.type)) {
    return `Relation not allowed: "${def.label}" does not connect ${typeLabel(mm, src.type)} → ${typeLabel(mm, dst.type)}.`
  }
  // The type it will have (insertRelation and patchRelation infer one).
  const keptDef = kept ? mm?.relationTypes[kept] : undefined
  const type = rel.relationType ?? (keptDef && relationTypeAllows(keptDef, src.type, dst.type) ? kept : inferRelationType(mm, src.type, dst.type))
  // Containment already joins an element and what holds it; a governance
  // relation says what containment does not (a requirement in the system
  // that satisfies it), and a transition may go to a state holding its source.
  const holder = relationMayJoinHolder(mm, type) ? undefined : holderOf(ctx.nodes, src, dst)
  if (holder) return `Relation not allowed: ${holder.label} holds ${(holder === src ? dst : src).label}, and containment already joins them.`
  if (type === 'part-of') {
    const why = aggregateRefusal(src, dst, relationList(ctx.relations), ctx.nodes, exceptId)
    if (why) return `Relation not allowed: ${why}`
  }
  if (hasStatecharts(mm) && (type === 'transition' || type === 'lifecycle-of')) {
    const relations = relationRecord(ctx.relations)
    const why = type === 'transition' ? transitionRefusal(src, dst, ctx.nodes, relations, exceptId)
      : lifecycleRefusal(src, dst, ctx.nodes, relations, exceptId)
    if (why) return `Relation not allowed: ${why}`
  }
  return null
}

export function relationTypeAllows(def: { allowedPairs: { from: string; to: string }[] }, from: string, to: string): boolean {
  return def.allowedPairs.length === 0 || def.allowedPairs.some((p) => p.from === from && p.to === to)
}

/** The types a relation from `sourceId` to `targetId` may have, each one
 *  relationRefusal accepts: what a type select, the connect key or a matrix
 *  cell offers. With `exceptId`, for that relation changed to the type. */
export function relationTypesAccepted(ctx: RelationContext, sourceId: string, targetId: string, exceptId?: string): string[] {
  const src = ctx.nodes[sourceId], dst = ctx.nodes[targetId]
  if (!src || !dst) return []
  return relationTypesFitting(ctx.metamodel, src.type, dst.type)
    .filter((rt) => !relationRefusal(ctx, { sourceId, targetId, relationType: rt.id }, exceptId))
    .map((rt) => rt.id)
}

/** The id an element not yet in the model goes by in linkRefusal. */
const NEW_ELEMENT = '\u0000new'

/** Why the element `self` may not be linked the way `link` says (a
 *  WizardLink: `out` when `self` is the source): relationRefusal, for an
 *  element of the model or, without an id, one about to be made of its
 *  type in `parentId` (a wizard's relation step before Create). */
export function linkRefusal(ctx: RelationContext, self: { id?: string; type: string; label?: string; parentId?: string }, link: WizardLink): string | null {
  const id = self.id && ctx.nodes[self.id] ? self.id : NEW_ELEMENT
  const nodes = id === NEW_ELEMENT
    ? { ...ctx.nodes, [id]: { id, type: self.type, label: self.label ?? typeLabel(ctx.metamodel, self.type), parentId: self.parentId } as C4Node }
    : ctx.nodes
  const rel = link.direction === 'out'
    ? { sourceId: id, targetId: link.otherId, relationType: link.relationType }
    : { sourceId: link.otherId, targetId: id, relationType: link.relationType }
  return relationRefusal({ ...ctx, nodes }, rel)
}

/** The elements a wizard's relation step offers to link `self` to
 *  (wizardRelationCandidates), those the model accepts linked so
 *  (linkRefusal), and those it is linked to already (`links`), which stay
 *  to be unticked. An ADR dropped onto a system offered only that system
 *  under a structural step, and Create was then refused. */
export function wizardLinkCandidates(
  ctx: RelationContext,
  step: WizardRelationsStep,
  self: { id?: string; type: string; label?: string; parentId?: string },
  links: WizardLink[] = [],
): C4Node[] {
  return wizardRelationCandidates(ctx.metamodel, step, self.type, ctx.nodes, self.id).filter((n) => {
    const link: WizardLink = { relationType: step.relationType, direction: step.direction, otherId: n.id }
    return links.some((l) => sameWizardLink(l, link)) || !linkRefusal(ctx, self, link)
  })
}
