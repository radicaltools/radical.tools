// ─── Tool catalogue ──────────────────────────────────────────────────────────
// Built fresh from the live metamodel every run — same "no code changes for a
// custom type" promise as TableView.tsx's deriveNodeCols/propToCol — so a
// type added via the Metamodel Editor gets full AI support automatically.
// Studio's AI (QuickSearch chat, Radical Forge) and the MCP server share it.

import type { Metamodel } from '../../metamodel'
import { viewRefusal } from '../../model'
import { buildAlignmentToolHandlers, buildLayoutToolDefs, buildLayoutToolHandlers } from './layoutTools'
export { noCanvasLayout } from './layoutTools'
import { buildMetamodelToolDefs, buildMetamodelToolHandlers } from './metamodelTools'
import { buildMilestoneToolDefs, buildMilestoneToolHandlers } from './milestoneTools'
import { buildModelToolDefs, buildModelToolHandlers } from './modelTools'
import { buildNodeToolDefs, buildNodeToolHandlers } from './nodeTools'
import { buildPresentationToolDefs, buildPresentationToolHandlers } from './presentationTools'
import { buildRelationToolDefs, buildRelationToolHandlers } from './relationTools'
import { buildSequenceToolDefs, buildSequenceToolHandlers } from './sequenceTools'
import { buildViewToolDefs, buildViewToolHandlers } from './viewTools'
import type { AsyncToolHandler, ToolDef, ToolHandler, ToolResult, ToolRunContext } from './types'

/** Tool groups a caller can leave out, e.g. Radical Forge, which only builds
 *  the model, leaves out 'metamodel', 'presentation' and 'milestone'. */
export type ToolGroup = 'node' | 'relation' | 'view' | 'sequence' | 'model' | 'layout' | 'presentation' | 'milestone' | 'metamodel'

export interface ToolCatalogueOptions {
  exclude?: ToolGroup[]
}

export function buildToolDefs(metamodel: Metamodel | undefined, options: ToolCatalogueOptions = {}): ToolDef[] {
  const groups: Record<ToolGroup, () => ToolDef[]> = {
    node: () => buildNodeToolDefs(metamodel),
    relation: () => buildRelationToolDefs(metamodel),
    view: buildViewToolDefs,
    sequence: buildSequenceToolDefs,
    model: buildModelToolDefs,
    layout: buildLayoutToolDefs,
    presentation: buildPresentationToolDefs,
    milestone: buildMilestoneToolDefs,
    metamodel: buildMetamodelToolDefs,
  }
  const exclude = new Set(options.exclude ?? [])
  return (Object.keys(groups) as ToolGroup[]).filter((group) => !exclude.has(group)).flatMap((group) => groups[group]())
}

/** The synchronous handlers. Use runTool to call any tool, async ones included. */
export function buildToolHandlers(): Map<string, ToolHandler> {
  return new Map(Object.entries({
    ...buildNodeToolHandlers(),
    ...buildRelationToolHandlers(),
    ...buildViewToolHandlers(),
    ...buildAlignmentToolHandlers(),
    ...buildSequenceToolHandlers(),
    ...buildModelToolHandlers(),
    ...buildPresentationToolHandlers(),
    ...buildMilestoneToolHandlers(),
    ...buildMetamodelToolHandlers(),
  }))
}

const SYNC = buildToolHandlers()
const ASYNC: Map<string, AsyncToolHandler> = new Map(Object.entries(buildLayoutToolHandlers()))

/** True when the catalogue has a tool with this name. */
export function hasTool(name: string): boolean {
  return SYNC.has(name) || ASYNC.has(name)
}

/** Runs any catalogue tool. A thrown error becomes a failed result. */
export async function runTool(name: string, input: unknown, ctx: ToolRunContext): Promise<ToolResult> {
  const handler = ASYNC.get(name) ?? SYNC.get(name)
  if (!handler) return { ok: false, resultText: `Unknown tool "${name}"` }
  const refused = otherModelViewRefusal(name, input, ctx)
  if (refused) return { ok: false, resultText: `${name}: ${refused}` }
  try {
    return await handler(input, ctx)
  } catch (err) {
    return { ok: false, resultText: (err as Error).message }
  }
}

/** The tools that change one view, and the field that names it. */
const VIEW_TOOLS: Record<string, 'id' | 'viewId'> = {
  update_view: 'id', delete_view: 'id', set_view_nodes: 'viewId', smart_layout: 'viewId',
  align_nodes: 'viewId', grid_nodes: 'viewId', remove_alignment: 'viewId',
}

/** Another model's view (a federation) is shown, not changed: a tool that
 *  would change it is refused before it runs, as an edit of its elements is. */
function otherModelViewRefusal(name: string, input: unknown, ctx: ToolRunContext): string | null {
  const field = VIEW_TOOLS[name]
  const raw = field && input && typeof input === 'object' ? (input as Record<string, unknown>)[field] : undefined
  if (typeof raw !== 'string' || !raw) return null
  return viewRefusal(ctx.diagram.getViews?.()[ctx.resolveId(raw)])
}

export type { AsyncToolHandler, ToolDef, ToolHandler, ToolRunContext, ToolResult } from './types'
