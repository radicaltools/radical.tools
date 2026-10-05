// ─── Presentation tools: create_presentation / update_presentation / delete_presentation
// A presentation is an ordered list of slides, each showing one view (or
// every node). Slides made here carry no captured viewport or canvas state,
// so Studio's presenter mode frames each one to fit its view.

import type { Presentation, PresentationSlide } from '../../c4'
import { fail, type ToolDef, type ToolHandler, type ToolRunContext } from './types'

const randomId = (): string =>
  (globalThis as unknown as { crypto: { randomUUID(): string } }).crypto.randomUUID()

const SLIDES_SCHEMA = {
  type: 'array',
  description: "Slides in order. Each shows one view (or every node without viewId), framed to fit. Pass an existing slide's id to keep it (and any framing captured in Studio).",
  items: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Existing slide id to keep; omit for a new slide.' },
      name: { type: 'string' },
      viewId: { type: ['string', 'null'], description: 'Real view id or a tempId from this run.' },
    },
    required: ['name'],
    additionalProperties: false,
  },
}

export function buildPresentationToolDefs(): ToolDef[] {
  return [
    {
      name: 'create_presentation',
      description: 'Create a presentation: an ordered list of slides, each showing one view.',
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

const newSlide = (id: string, name: string, viewId: string | null): PresentationSlide =>
  // A zero viewport and no canvas state make Studio fit the slide's view.
  ({ id, name, snapshotId: null, viewId, viewport: { x: 0, y: 0, zoom: 0 } })

function parseSlides(tool: string, raw: unknown, ctx: ToolRunContext, existing: PresentationSlide[]): PresentationSlide[] | string {
  if (!Array.isArray(raw)) return `${tool}: slides must be an array`
  const views = ctx.diagram.getViews?.() ?? {}
  const kept = new Map(existing.map((slide) => [slide.id, slide]))
  const slides: PresentationSlide[] = []
  for (const [i, item] of raw.entries()) {
    const s = item as { id?: unknown; name?: unknown; viewId?: unknown }
    if (typeof s?.name !== 'string' || !s.name.trim()) return `${tool}: slide ${i + 1} needs a name`
    let viewId: string | null = null
    if (s.viewId != null) {
      if (typeof s.viewId !== 'string') return `${tool}: slide ${i + 1} has an invalid viewId`
      viewId = ctx.resolveId(s.viewId)
      if (!(viewId in views)) return `${tool}: slide ${i + 1} has unknown viewId "${s.viewId}"`
    }
    const previous = typeof s.id === 'string' ? kept.get(s.id) : undefined
    if (typeof s.id === 'string' && !previous) return `${tool}: slide ${i + 1} has unknown id "${s.id}"`
    const name = s.name.trim()
    if (!previous) slides.push(newSlide(randomId(), name, viewId))
    // A slide moved to another view loses the framing captured for the old one.
    else if ((previous.viewId ?? null) === viewId) slides.push({ ...previous, name })
    else slides.push(newSlide(previous.id, name, viewId))
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
