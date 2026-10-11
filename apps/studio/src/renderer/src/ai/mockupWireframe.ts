// ─── Mockup wireframe generation ────────────────────────────────────────────
// Studio's wireframe call: one tool-less call to the provider adapter with the
// prompt from @radical/common/ai/forge, not a runAIPrompt loop — the output
// is one blob of markup, not a sequence of model edits.

import { buildWireframePrompt } from '@radical/common/ai/forge'
import type { C4Node, C4Relation } from '@radical/common/c4'
import { sanitizeWireframeSvg } from '@radical/common/wireframe'
import { getAdapter } from './registry'
import { textOf, type AISettings, type TokenUsage } from './types'

export interface WireframeResult {
  svg: string
  usage?: TokenUsage
}

export async function generateWireframe(
  mockupId: string,
  nodes: Record<string, C4Node>,
  relations: Record<string, C4Relation>,
  settings: AISettings,
  signal?: AbortSignal,
): Promise<WireframeResult> {
  const adapter = getAdapter(settings.active)
  const cfg = settings.providers[settings.active]
  const res = await adapter.chat({
    // Layout quality matters here, so use the user's generation model.
    model: cfg.model || adapter.defaultModel,
    messages: [{ role: 'user', content: buildWireframePrompt(mockupId, nodes, relations) }],
    maxTokens: 6000,
    temperature: 0.4,
    signal,
  }, cfg)
  const svg = sanitizeWireframeSvg(textOf(res.content))
  if (!svg) throw new Error('The model did not return a usable SVG wireframe.')
  return { svg, usage: res.usage }
}
