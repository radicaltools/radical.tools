// ─── Presentation tools: create_presentation / update_presentation / delete_presentation
// A presentation is an ordered list of slides, each showing one view (or
// every node). Slides made here carry no captured viewport or canvas state,
// so Studio's presenter mode frames each one to fit its view, or to fit the
// slide's focus elements: several slides can zoom onto parts of one view. A
// slide shows the current model, or a milestone (a phase of the system).

import type { C4Node, C4Relation, DiagramView, Presentation, PresentationSlide } from '../../c4'
import { fail, type ToolDef, type ToolHandler, type ToolRunContext } from './types'
import { viewShownNodes } from '../../viewPipeline'
import { milestoneViews } from '../../model'
import { VIEW_KIND_LABELS, isViewpointKind } from '../../viewpoints'

const randomId = (): string =>
  (globalThis as unknown as { crypto: { randomUUID(): string } }).crypto.randomUUID()

const SLIDES_SCHEMA = {
  type: 'array',
  description: "Slides in order. Each shows one view (or every node without viewId), framed to fit the whole view or only its focus elements; several slides may show the same view with different focus to zoom onto its parts, or different milestones to walk through the phases of the system. Pass an existing slide's id to keep it (and any framing captured in Studio).",
  items: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Existing slide id to keep; omit for a new slide.' },
      name: { type: 'string' },
      viewId: { type: ['string', 'null'], description: 'Real view id or a tempId from this run. null = no view (the All elements table). Omit on a kept slide to keep its view and framing; changing it resets the slide\'s framing.' },
      milestone: { type: ['string', 'null'], description: 'Milestone id (list_milestones): the slide shows the model as saved in it. null = the current model. Omit on a kept slide to keep its milestone; changing it resets the slide\'s framing.' },
      focus: {
        type: 'array',
        items: { type: 'string' },
        description: "Node ids (or tempIds) the slide zooms onto, shown in the slide's view, which must be a Structure view (a canvas); the camera frames just these. Empty = the whole view. Omit on a kept slide to keep its focus and framing; passing it drops framing captured in Studio.",
      },
    },
    required: ['name'],
    additionalProperties: false,
  },
}

export function buildPresentationToolDefs(): ToolDef[] {
  return [
    {
      name: 'create_presentation',
      description: 'Create a presentation: an ordered list of slides, each showing one view, whole or zoomed onto some of its elements (focus).',
      inputSchema: {
        type: 'object',
        properties: { name: { type: 'string' }, slides: SLIDES_SCHEMA },
        required: ['name'],
        additionalProperties: false,
      },
    },
    {
      name: 'update_presentation',
      description: 'Rename a presentation or replace its slides (the full ordered list).',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' }, name: { type: 'string' }, slides: SLIDES_SCHEMA },
        required: ['id'],
        additionalProperties: false,
      },
    },
    {
      name: 'delete_presentation',
      description: 'Delete a presentation.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false,
      },
    },
  ]
}

const NO_VIEWPORT = { x: 0, y: 0, zoom: 0 }

const newSlide = (id: string, name: string, viewId: string | null, focus: string[] | undefined, snapshotId: string | null): PresentationSlide =>
  // A zero viewport and no canvas state make Studio fit the slide's view (or its focus).
  ({ id, name, snapshotId, viewId, viewport: NO_VIEWPORT, ...(focus?.length ? { focusNodeIds: focus } : {}) })

/** Nodes a view shows: what its chain gives, or its listed nodes, with their ancestors (every node when it lists none). */
function shownIn(view: DiagramView | undefined, nodes: Record<string, C4Node>, relations: Record<string, C4Relation>): ((id: string) => boolean) {
  const shown = viewShownNodes(view, nodes, relations)
  return shown ? (id) => shown.has(id) : (id) => id in nodes
}

/** Why a slide of `view` cannot zoom onto elements: only a canvas (a
 *  Structure view) has a camera. Without a view a slide shows the All
 *  elements table. */
function noCanvas(view: DiagramView | undefined): string | null {
  if (!view) return 'without viewId it shows the All elements table'
  const kind = view.kind ?? 'static'
  if (kind === 'static') return null
  const label = kind === 'dynamic' ? 'flow' : isViewpointKind(kind) ? VIEW_KIND_LABELS[kind].toLowerCase() : kind
  return `view "${view.name}" is a ${label} view`
}

/** `nodes`: the model the slide shows, the current one or its milestone's. */
function parseFocus(tool: string, i: number, raw: unknown, ctx: ToolRunContext, view: DiagramView | undefined, nodes: Record<string, C4Node>, relations: Record<string, C4Relation>): string[] | string {
  if (!Array.isArray(raw) || raw.some((id) => typeof id !== 'string')) return `${tool}: slide ${i + 1} focus must be an array of node ids`
  // A focus on a slide with no canvas did nothing: it played the whole table.
  const refused = raw.length ? noCanvas(view) : null
  if (refused) return `${tool}: slide ${i + 1} cannot focus on elements: ${refused}, and only a Structure view (a canvas) zooms onto elements`
  const shown = shownIn(view, nodes, relations)
  const focus = [...new Set((raw as string[]).map((id) => ctx.resolveId(id)))]
  const unknown = focus.filter((id) => !(id in nodes))
  if (unknown.length) return `${tool}: slide ${i + 1} focuses on unknown node(s) ${unknown.map((id) => `"${id}"`).join(', ')}`
  const outside = focus.filter((id) => !shown(id))
  if (outside.length) return `${tool}: slide ${i + 1} focuses on node(s) not in view "${view!.name}": ${outside.map((id) => `${nodes[id].label} (${id})`).join(', ')}`
  return focus
}

function parseSlides(tool: string, raw: unknown, ctx: ToolRunContext, existing: PresentationSlide[]): PresentationSlide[] | string {
  if (!Array.isArray(raw)) return `${tool}: slides must be an array`
  const views = ctx.diagram.getViews?.() ?? {}
  const milestones = ctx.diagram.getMilestones?.() ?? []
  const kept = new Map(existing.map((slide) => [slide.id, slide]))
  const slides: PresentationSlide[] = []
  // A slide is listed once: two slides with one id were one to Studio,
  // whose delete then took both from the file and left one on screen.
  const used = new Set<string>()
  for (const [i, item] of raw.entries()) {
    const s = item as { id?: unknown; name?: unknown; viewId?: unknown; focus?: unknown; milestone?: unknown }
    if (typeof s?.name !== 'string' || !s.name.trim()) return `${tool}: slide ${i + 1} needs a name`
    const previous = typeof s.id === 'string' ? kept.get(s.id) : undefined
    if (typeof s.id === 'string' && !previous) return `${tool}: slide ${i + 1} has unknown id "${s.id}"`
    if (typeof s.id === 'string' && used.has(s.id)) return `${tool}: slide ${i + 1} repeats the id "${s.id}" of an earlier slide; leave the id out for a new slide`
    if (typeof s.id === 'string') used.add(s.id)
    let snapshotId = previous?.snapshotId ?? null
    if (s.milestone !== undefined) {
      if (s.milestone !== null && typeof s.milestone !== 'string') return `${tool}: slide ${i + 1} has an invalid milestone`
      if (s.milestone !== null && !milestones.some((m) => m.id === s.milestone)) return `${tool}: slide ${i + 1} has unknown milestone "${s.milestone}"`
      snapshotId = s.milestone
    }
    const milestone = snapshotId ? milestones.find((m) => m.id === snapshotId) : undefined
    // The views as the slide's model has them: a milestone keeps its own
    // list of a view, and a view of an element deleted since, as Studio
    // draws them.
    const shownViews = milestoneViews(views, milestone, ctx.diagram.getNodes())
    // A kept slide keeps its view unless told otherwise, as it keeps its
    // milestone and focus: slides reordered by id and name all lost theirs.
    let viewId: string | null = s.viewId === undefined ? (previous?.viewId ?? null) : null
    if (s.viewId != null) {
      if (typeof s.viewId !== 'string') return `${tool}: slide ${i + 1} has an invalid viewId`
      viewId = ctx.resolveId(s.viewId)
      if (!(viewId in shownViews)) return `${tool}: slide ${i + 1} has unknown viewId "${s.viewId}"`
    }
    let focus: string[] | undefined
    if (s.focus !== undefined) {
      const parsed = parseFocus(tool, i, s.focus, ctx, viewId ? shownViews[viewId] : undefined, milestone?.nodes ?? ctx.diagram.getNodes(), milestone?.relations ?? ctx.diagram.getRelations())
      if (typeof parsed === 'string') return parsed
      focus = parsed
    }
    const name = s.name.trim()
    if (!previous) slides.push(newSlide(randomId(), name, viewId, focus, snapshotId))
    // A slide moved to another view or milestone loses the framing, focus and
    // model copy captured for the old one; Studio would replay them over the new.
    else if ((previous.viewId ?? null) !== viewId || (previous.snapshotId ?? null) !== snapshotId) {
      slides.push(newSlide(previous.id, name, viewId, focus, snapshotId))
    } else if (!focus) slides.push({ ...previous, name })
    else {
      // A new focus replaces the camera captured in Studio, which would win over it.
      const slide: PresentationSlide = { ...previous, name, viewport: NO_VIEWPORT, focusNodeIds: focus }
      if (!focus.length) delete slide.focusNodeIds
      slides.push(slide)
    }
  }
  return slides
}

function presentationsOf(tool: string, ctx: ToolRunContext): Presentation[] | string {
  if (!ctx.diagram.getPresentations || !ctx.diagram.setPresentations) return `${tool}: presentations are not editable in this context`
  return ctx.diagram.getPresentations().map((p) => ({ ...p, slides: [...p.slides] }))
}

export function buildPresentationToolHandlers(): Record<string, ToolHandler> {
  return {
    create_presentation: (rawInput, ctx) => {
      const input = rawInput as { name?: unknown; slides?: unknown }
      const list = presentationsOf('create_presentation', ctx)
      if (typeof list === 'string') return fail(list)
      if (typeof input.name !== 'string' || !input.name.trim()) return fail('create_presentation: name is required')
      const slides = input.slides === undefined ? [] : parseSlides('create_presentation', input.slides, ctx, [])
      if (typeof slides === 'string') return fail(slides)
      const id = randomId()
      ctx.diagram.setPresentations!([...list, { id, name: input.name.trim(), slides }])
      return { ok: true, resultText: `Created presentation ${id} with ${slides.length} slide(s).` }
    },

    update_presentation: (rawInput, ctx) => {
      const input = rawInput as { id?: unknown; name?: unknown; slides?: unknown }
      const list = presentationsOf('update_presentation', ctx)
      if (typeof list === 'string') return fail(list)
      const presentation = list.find((p) => p.id === input.id)
      if (!presentation) return fail(`update_presentation: unknown presentation id "${String(input.id)}"`)
      if (input.name !== undefined && (typeof input.name !== 'string' || !input.name.trim())) return fail('update_presentation: name must be a non-empty string')
      const slides = input.slides === undefined ? undefined : parseSlides('update_presentation', input.slides, ctx, presentation.slides)
      if (typeof slides === 'string') return fail(slides)
      if (input.name === undefined && !slides) return fail('update_presentation: nothing to change')
      if (typeof input.name === 'string') presentation.name = input.name.trim()
      if (slides) presentation.slides = slides
      ctx.diagram.setPresentations!(list)
      return { ok: true, resultText: `Updated presentation ${presentation.id}.` }
    },

    delete_presentation: (rawInput, ctx) => {
      const input = rawInput as { id?: unknown }
      const list = presentationsOf('delete_presentation', ctx)
      if (typeof list === 'string') return fail(list)
      if (!list.some((p) => p.id === input.id)) return fail(`delete_presentation: unknown presentation id "${String(input.id)}"`)
      ctx.diagram.setPresentations!(list.filter((p) => p.id !== input.id))
      return { ok: true, resultText: `Deleted presentation ${String(input.id)}.` }
    },
  }
}
