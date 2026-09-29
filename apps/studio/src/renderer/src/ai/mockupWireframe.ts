// ─── Mockup wireframe generation ────────────────────────────────────────────
// Generates a low-fidelity SVG wireframe for a Mockup node from the model
// context around it: its own label / description / screen, the requirements
// and scenarios it `illustrates`, the container it is `presented-by`, and the
// screens it `navigates-to`. Like forgeClarify.ts this is a single tool-less
// call to the provider adapter, not a runAIPrompt loop — the output is one
// blob of markup, not a sequence of model edits.
//
// Sanitising and rendering the stored SVG live in @radical/common/wireframe,
// so views can show wireframes without pulling in the AI providers.

import { getAdapter } from './registry'
import { textOf, type AISettings, type TokenUsage } from '@radical/common/ai/types'
import type { C4Node, C4Relation } from '@radical/common/c4'
import { WIREFRAME_HEIGHT, WIREFRAME_WIDTH, sanitizeWireframeSvg } from '@radical/common/wireframe'

type NodeMap = Record<string, C4Node>
type RelationMap = Record<string, C4Relation>

function prop(node: C4Node, key: string): string {
  const v = (node as unknown as Record<string, unknown>)[key]
  return typeof v === 'string' ? v.trim() : ''
}

function describeRequirement(n: C4Node): string {
  const action = prop(n, 'action')
  return action ? `${n.label}: the system shall ${action}` : n.label
}

function describeScenario(n: C4Node): string {
  const parts = [
    prop(n, 'given') && `Given ${prop(n, 'given')}`,
    prop(n, 'when') && `When ${prop(n, 'when')}`,
    prop(n, 'then') && `Then ${prop(n, 'then')}`,
  ].filter(Boolean)
  return parts.length ? `${n.label}: ${parts.join('; ')}` : n.label
}

export function buildWireframePrompt(mockupId: string, nodes: NodeMap, relations: RelationMap): string {
  const mockup = nodes[mockupId]
  if (!mockup) throw new Error(`Unknown mockup node: ${mockupId}`)

  const outgoing = Object.values(relations)
    .filter((r) => r.sourceId === mockupId)
    .map((r) => ({ rel: r, target: nodes[r.targetId] }))
    .filter((x): x is { rel: C4Relation; target: C4Node } => !!x.target)

  const requirements = outgoing.filter((x) => x.target.type === 'requirement').map((x) => describeRequirement(x.target))
  const scenarios = outgoing.filter((x) => x.target.type === 'scenario').map((x) => describeScenario(x.target))
  const presentedBy = outgoing
    .filter((x) => x.rel.relationType === 'presented-by')
    .map((x) => [x.target.label, x.target.technology].filter(Boolean).join(' — '))
  const navigatesTo = outgoing
    .filter((x) => x.target.type === 'mockup')
    .map((x) => (x.rel.label ? `${x.target.label} (via ${x.rel.label})` : x.target.label))

  const lines = [
    `Draw a low-fidelity UI wireframe for the screen "${mockup.label}".`,
  ]
  const screen = prop(mockup, 'screen')
  if (screen) lines.push(`Screen / route: ${screen}`)
  const description = prop(mockup, 'description')
  if (description) lines.push('', 'Screen description:', '"""', description, '"""')
  const section = (title: string, items: string[]): void => {
    if (items.length) lines.push('', title, ...items.map((i) => `- ${i}`))
  }
  section('Requirements this screen must illustrate:', requirements)
  section('Scenarios this screen must support:', scenarios)
  section('Rendered by:', presentedBy)
  section('Navigation targets (show as buttons/links leading there):', navigatesTo)

  lines.push(
    '',
    'Output rules:',
    `- Respond with ONLY one <svg> element: xmlns="http://www.w3.org/2000/svg", viewBox="0 0 ${WIREFRAME_WIDTH} ${WIREFRAME_HEIGHT}".`,
    '- Low-fi grayscale style: white background, #333 strokes, #eee/#ccc fills, one accent colour at most.',
    '- Use only rect, line, circle, path, polygon, text and g. No images, no scripts, no foreignObject, no external references, no CSS.',
    '- Short realistic labels (font-family="sans-serif", font-size 9-14); grey bars for body copy.',
    '- Show the elements the requirements and scenarios need (inputs, buttons, lists, states).',
    '- Keep it compact: well under 8000 characters.',
  )
  return lines.join('\n')
}

export interface WireframeResult {
  svg: string
  usage?: TokenUsage
}

export async function generateWireframe(
  mockupId: string,
  nodes: NodeMap,
  relations: RelationMap,
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
