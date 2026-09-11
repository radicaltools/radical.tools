// ─── Radical Forge — clarifying questions ───────────────────────────────────
// Before generating a stage, ask the model whether it needs 1-4 short
// clarifying questions from the user (about the description, and — when
// there are Hub matches — which of them to actually apply). This is a
// SEPARATE, tool-less call to the provider adapter, not a tool inside the
// runAIPrompt loop: that loop (ai/runner.ts) runs every tool call to
// completion with no mechanism to pause mid-run for human input, and
// teaching it to do so would mean real surgery on already-shipped
// infrastructure. A plain second call is simpler and provider-agnostic —
// same pattern AISettingsModal.tsx already uses for its "Test connection"
// button: getAdapter(id).chat({...}, cfg) then textOf(res.content).

import { getAdapter } from './registry'
import { textOf, type AISettings, type TokenUsage } from './types'
import type { HubConceptSummary } from '../store/hubStore'

export interface ClarifyStageQuestion {
  id: string
  question: string
  kind: 'text' | 'select'
  options?: string[]
  multiSelect?: boolean
}

/** Reserved id for the (optional) question offering to pick which Hub
 *  matches should actually inform generation. */
export const HUB_MATCHES_QUESTION_ID = 'hub_matches'

function isValidQuestion(v: unknown): v is ClarifyStageQuestion {
  if (!v || typeof v !== 'object') return false
  const q = v as Record<string, unknown>
  if (typeof q.id !== 'string' || !q.id) return false
  if (typeof q.question !== 'string' || !q.question) return false
  if (q.kind !== 'text' && q.kind !== 'select') return false
  if (q.kind === 'select' && !(Array.isArray(q.options) && q.options.every((o) => typeof o === 'string'))) return false
  if (q.multiSelect !== undefined && typeof q.multiSelect !== 'boolean') return false
  return true
}

/** Permissive JSON-array extraction — strips a ```json fence if present,
 *  takes the outermost [...] block, parses and validates it. Returns []
 *  on any failure (malformed JSON, prose instead of an array, a model that
 *  ignored the format entirely) so a bad response degrades straight to "no
 *  questions" rather than blocking the wizard. */
export function parseClarifyResponse(text: string): ClarifyStageQuestion[] {
  try {
    let s = text.trim()
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fence) s = fence[1].trim()
    const start = s.indexOf('[')
    const end = s.lastIndexOf(']')
    if (start === -1 || end === -1 || end < start) return []
    const parsed: unknown = JSON.parse(s.slice(start, end + 1))
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidQuestion)
  } catch {
    return []
  }
}

export function buildClarifyPrompt(
  stageTitle: string,
  description: string,
  hubMatches: HubConceptSummary[] | undefined,
  priorQA?: string,
): string {
  const lines = [
    `You are about to generate the "${stageTitle}" stage of a Radical Forge run for the system described below.`,
    '',
    'System description:',
    '"""',
    description.trim(),
    '"""',
  ]

  if (priorQA?.trim()) {
    lines.push(
      '',
      'Already answered in earlier stages of this run — do NOT ask about these',
      'again unless something is still genuinely unclear:',
      priorQA.trim(),
    )
  }

  if (hubMatches?.length) {
    lines.push(
      '',
      'Hub catalogue matches available for this stage:',
      ...hubMatches.map((m) => `- ${m.name}: ${m.description}`),
    )
  }

  lines.push(
    '',
    'Task: decide whether you need up to 4 SHORT clarifying questions from the',
    'user before generating this stage — only ask about things that would',
    'meaningfully change what you generate, not everything conceivable.',
    'Respond with ONLY a JSON array (no prose, no markdown fences) of objects:',
    '{"id": string, "question": string, "kind": "text" | "select", "options"?: string[], "multiSelect"?: boolean}',
    'If nothing needs clarifying, respond with exactly: []',
  )

  if (hubMatches?.length) {
    lines.push(
      '',
      `Additionally include exactly one question with id "${HUB_MATCHES_QUESTION_ID}",`,
      'kind "select", multiSelect true, and options exactly equal to (same order):',
      JSON.stringify(hubMatches.map((m) => m.name)),
      'asking which of these Hub matches, if any, the user wants applied.',
    )
  }

  return lines.join('\n')
}

/** Formats answered questions as a "Q: ...\nA: ..." block for
 *  ai/forgePrompts.ts's `clarifications` param. The `hub_matches` question
 *  (if present) is deliberately excluded — its answer changes *which*
 *  concepts the caller even passes as `hubMatches`, so it belongs in the
 *  structural Hub-guidance list, not repeated here as prose. Questions with
 *  no answer (skipped, or left blank) are omitted. */
export function formatClarificationAnswers(
  questions: ClarifyStageQuestion[] | undefined,
  answers: Record<string, string | string[]> | undefined,
): string {
  if (!questions?.length || !answers) return ''
  const lines: string[] = []
  for (const q of questions) {
    if (q.id === HUB_MATCHES_QUESTION_ID) continue
    const a = answers[q.id]
    const text = Array.isArray(a) ? a.join(', ') : (a ?? '').trim()
    if (!text) continue
    lines.push(`Q: ${q.question}\nA: ${text}`)
  }
  return lines.join('\n\n')
}

export interface ClarifyResult {
  questions: ClarifyStageQuestion[]
  /** From this call alone — the caller sums it into whatever running total
   *  it's tracking (the clarify call is real token spend too, same as any
   *  generation round; it just doesn't touch the diagram). */
  usage?: TokenUsage
}

/** Fires the clarify call and returns parsed questions (never throws for a
 *  malformed model response — only for a genuine network/auth failure,
 *  which the caller surfaces the same way a generation failure would). */
export async function askClarifyingQuestions(
  stageTitle: string,
  description: string,
  hubMatches: HubConceptSummary[] | undefined,
  settings: AISettings,
  signal?: AbortSignal,
  priorQA?: string,
): Promise<ClarifyResult> {
  const adapter = getAdapter(settings.active)
  const cfg = settings.providers[settings.active]
  const model = cfg.model || adapter.defaultModel
  const res = await adapter.chat({
    model,
    messages: [{ role: 'user', content: buildClarifyPrompt(stageTitle, description, hubMatches, priorQA) }],
    maxTokens: 700,
    temperature: 0.3,
    signal,
  }, cfg)
  return { questions: parseClarifyResponse(textOf(res.content)), usage: res.usage }
}
