// ─── System messages ─────────────────────────────────────────────────────────
// The system prompt and the diagram-state context message live in
// @radical/common/ai/systemPrompt (the MCP server's Forge briefs use them
// too); this file assembles Studio's cacheable system-role prefix.

import type { C4Node } from '@radical/common/c4'
import type { Metamodel } from '@radical/common/metamodel'
import { buildMetamodelMessage } from '@radical/common/ai/metamodelContext'
import { AI_SYSTEM_PROMPT } from '@radical/common/ai/systemPrompt'
import type { ChatMessage } from './types'

/** The system-role messages for one round — rebuilt fresh every round, but
 *  byte-identical for the whole life of an open document (the diagram-state
 *  message that used to live here as a third, ever-changing block has moved
 *  into the conversation turns themselves — see ai/runner.ts — so this
 *  prefix can stay stable and fully cacheable instead of being invalidated
 *  every round). The metamodel message carries `cacheBreakpoint: true` so a
 *  caching-capable provider (see providers/claude.ts) can reuse this prefix
 *  across every round AND every stage of a run instead of reprocessing it
 *  from scratch. `relevantTypeIds` is passed straight through to
 *  `buildMetamodelMessage` (see there) — Radical Forge scopes it to the
 *  active stage's primary type(s); QuickSearch's freeform chat omits it for
 *  full detail always. `nodes` is needed even though this no longer builds
 *  the diagram-state message — `buildMetamodelMessage` uses it to keep
 *  full property detail for any type already in use. */
export function buildSystemMessages(
  metamodel: Metamodel | undefined,
  nodes: Record<string, C4Node>,
  relevantTypeIds?: Set<string>,
): ChatMessage[] {
  return [
    { role: 'system', content: AI_SYSTEM_PROMPT },
    { role: 'system', content: buildMetamodelMessage(metamodel, relevantTypeIds, nodes), cacheBreakpoint: true },
  ]
}
