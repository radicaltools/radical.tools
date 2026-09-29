// ─── Tool catalogue ──────────────────────────────────────────────────────────
// Built fresh from the live metamodel every run — same "no code changes for a
// custom type" promise as TableView.tsx's deriveNodeCols/propToCol — so a
// type added via the Metamodel Editor gets full AI support automatically.

import type { Metamodel } from '../../metamodel'
import { buildModelToolDefs, buildModelToolHandlers } from './modelTools'
import { buildNodeToolDefs, buildNodeToolHandlers } from './nodeTools'
import { buildRelationToolDefs, buildRelationToolHandlers } from './relationTools'
import { buildViewToolDefs, buildViewToolHandlers } from './viewTools'
import type { ToolDef, ToolHandler } from './types'

export function buildToolDefs(metamodel: Metamodel | undefined): ToolDef[] {
  return [
    ...buildNodeToolDefs(metamodel),
    ...buildRelationToolDefs(metamodel),
    ...buildViewToolDefs(),
    ...buildModelToolDefs(),
  ]
}

export function buildToolHandlers(): Map<string, ToolHandler> {
  return new Map(Object.entries({
    ...buildNodeToolHandlers(),
    ...buildRelationToolHandlers(),
    ...buildViewToolHandlers(),
    ...buildModelToolHandlers(),
  }))
}

export type { ToolDef, ToolHandler, ToolRunContext, ToolResult } from './types'
