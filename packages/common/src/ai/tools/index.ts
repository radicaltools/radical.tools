// ─── Tool catalogue ──────────────────────────────────────────────────────────
// Built fresh from the live metamodel every run — same "no code changes for a
// custom type" promise as TableView.tsx's deriveNodeCols/propToCol — so a
// type added via the Metamodel Editor gets full AI support automatically.
// Studio's AI (QuickSearch chat, Radical Forge) and the MCP server share it.

import type { Metamodel } from '../../metamodel'
import { buildAlignmentToolHandlers, buildLayoutToolDefs, buildLayoutToolHandlers } from './layoutTools'
import { buildMetamodelToolDefs, buildMetamodelToolHandlers } from './metamodelTools'
import { buildModelToolDefs, buildModelToolHandlers } from './modelTools'
import { buildNodeToolDefs, buildNodeToolHandlers } from './nodeTools'
import { buildPresentationToolDefs, buildPresentationToolHandlers } from './presentationTools'
import { buildRelationToolDefs, buildRelationToolHandlers } from './relationTools'
import { buildSequenceToolDefs, buildSequenceToolHandlers } from './sequenceTools'
import { buildViewToolDefs, buildViewToolHandlers } from './viewTools'
import type { AsyncToolHandler, ToolDef, ToolHandler, ToolResult, ToolRunContext } from './types'

/** Tool groups a caller can leave out, e.g. Radical Forge, which only builds
 *  the model, leaves out 'metamodel' and 'presentation'. */
export type ToolGroup = 'node' | 'relation' | 'view' | 'sequence' | 'model' | 'layout' | 'presentation' | 'metamodel'

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
  try {
    return await handler(input, ctx)
  } catch (err) {
    return { ok: false, resultText: (err as Error).message }
  }
}

export type { AsyncToolHandler, ToolDef, ToolHandler, ToolRunContext, ToolResult } from './types'
