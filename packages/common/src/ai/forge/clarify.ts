// ─── Radical Forge — clarifying questions ───────────────────────────────────
// Before generating a stage, ask the model whether it needs 1-4 short
// clarifying questions from the user (about the description), and in the
// Requirements stage have it pick the Hub's concern packs the description
// calls for, whose own questions are then asked too (./concerns.ts). In Studio this
// is a SEPARATE, tool-less call to the provider adapter (askClarifyingQuestions
// in apps/studio's ai/forgeClarify.ts), not a tool inside the runAIPrompt
// loop: that loop runs every tool call to completion with no mechanism to
// pause mid-run for human input. Its JSON answer becomes the wizard's form.
// Over MCP the client's own model reads the same prompt in 'ask' mode and
// asks the user itself (apps/mcp's forge_clarify).

import type { ConcernPack } from '../../concerns'
import { CONCERNS_QUESTION_ID, CONCERN_QUESTION_PREFIX, concernQuestionLines, concernsClarifyLines } from './concerns'

export interface ClarifyStageQuestion {
  id: string
  question: string
  kind: 'text' | 'select'
  options?: string[]
  multiSelect?: boolean
  /** The option chosen to begin with (a concern pack's default answer). */
  defaultOption?: string
}

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
  return parseClarifyReply(text) ?? []
}

/** Like parseClarifyResponse, but null when the reply is not a JSON array at
 *  all. */
export function parseClarifyReply(text: string): ClarifyStageQuestion[] | null {
  try {
    let s = text.trim()
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fence) s = fence[1].trim()
    const start = s.indexOf('[')
    const end = s.lastIndexOf(']')
    if (start === -1 || end === -1 || end < start) return null
    const parsed: unknown = JSON.parse(s.slice(start, end + 1))
    if (!Array.isArray(parsed)) return null
    return parsed.filter(isValidQuestion)
  } catch {
    return null
  }
}

/** 'json': the model answers with the questions as a JSON array (Studio's
 *  wizard turns them into a form). 'ask': the model asks the user itself,
 *  in its own chat (an MCP client). */
export type ClarifyMode = 'json' | 'ask'

/** `concernPacks` are the Hub's concern packs, offered in the Requirements
 *  stage: the model picks those the description calls for. */
export function buildClarifyPrompt(
  stageTitle: string,
  description: string,
  concernPacks: ConcernPack[] | undefined,
  priorQA?: string,
  mode: ClarifyMode = 'json',
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

  lines.push(
    '',
    'Task: decide whether you need up to 4 SHORT clarifying questions from the',
    'user before generating this stage — only ask about things that would',
    'meaningfully change what you generate, not everything conceivable.',
  )

  if (mode === 'ask') {
    lines.push(
      'Ask the user those questions and wait for the answers; offer options where',
      'an answer is a choice. If nothing needs clarifying, ask nothing.',
      ...concernsClarifyLines(concernPacks ?? [], 'ask'),
      ...concernQuestionLines(concernPacks ?? []),
    )
    return lines.join('\n')
  }

  lines.push(
    'Respond with ONLY a JSON array (no prose, no markdown fences) of objects:',
    '{"id": string, "question": string, "kind": "text" | "select", "options"?: string[], "multiSelect"?: boolean}',
    'If nothing needs clarifying, respond with exactly: []',
  )

  lines.push(...concernsClarifyLines(concernPacks ?? [], 'json'))
  return lines.join('\n')
}

/** Formats answered questions as a "Q: ...\nA: ..." block for
 *  ./prompts.ts's `clarifications` param. The concern packs' questions are
 *  left out: what they decide is in the model and in the stage's concerns
 *  block. Questions with no answer (skipped, or left blank) are omitted. */
export function formatClarificationAnswers(
  questions: ClarifyStageQuestion[] | undefined,
  answers: Record<string, string | string[]> | undefined,
): string {
  if (!questions?.length || !answers) return ''
  const lines: string[] = []
  for (const q of questions) {
    if (q.id === CONCERNS_QUESTION_ID || q.id.startsWith(CONCERN_QUESTION_PREFIX)) continue
    const a = answers[q.id]
    const text = Array.isArray(a) ? a.join(', ') : (a ?? '').trim()
    if (!text) continue
    lines.push(`Q: ${q.question}\nA: ${text}`)
  }
  return lines.join('\n\n')
}
