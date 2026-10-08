// ─── Radical Forge — clarifying questions ───────────────────────────────────
// Before generating a stage, ask the model whether it needs 1-4 short
// clarifying questions from the user (about the description), and have it
// pick, from the stage's Hub candidates (./hubMatches.ts), the few that fit
// this system, which the user then confirms. In Studio this
// is a SEPARATE, tool-less call to the provider adapter (askClarifyingQuestions
// in apps/studio's ai/forgeClarify.ts), not a tool inside the runAIPrompt
// loop: that loop runs every tool call to completion with no mechanism to
// pause mid-run for human input. Its JSON answer becomes the wizard's form.
// Over MCP the client's own model reads the same prompt in 'ask' mode and
// asks the user itself (apps/mcp's forge_clarify).

import type { HubConceptSummary } from '../../hubFormat'

export interface ClarifyStageQuestion {
  id: string
  question: string
  kind: 'text' | 'select'
  options?: string[]
  multiSelect?: boolean
}

/** Reserved id for the (optional) question offering the Hub concepts the
 *  model picked, for the user to confirm which should inform generation. */
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
  return parseClarifyReply(text) ?? []
}

/** Like parseClarifyResponse, but null when the reply is not a JSON array at
 *  all — so a failed reply can fall back to the lexical Hub suggestions,
 *  while a valid one without a hub_matches question means none fits. */
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

/** Most Hub concepts the model may pick for one stage. */
export const HUB_PICK_LIMIT = 5
const CANDIDATE_DESCRIPTION_MAX = 110

/** One line per candidate, compact enough for 60 of them. */
function candidateLine(c: HubConceptSummary): string {
  const description = c.description.length > CANDIDATE_DESCRIPTION_MAX
    ? `${c.description.slice(0, CANDIDATE_DESCRIPTION_MAX).replace(/\s+\S*$/, '')}…`
    : c.description
  return `- ${c.id} | [${c.category}] ${c.name}: ${description}${c.tags.length ? ` (${c.tags.join(', ')})` : ''}`
}

/** The concepts the model picked: the hub_matches question's options matched
 *  to the candidates by name, in its order. The question is rewritten to the
 *  exact names (and dropped when none match). [] when it picked none. */
export function pickedHubConcepts(
  questions: ClarifyStageQuestion[], candidates: HubConceptSummary[],
): { questions: ClarifyStageQuestion[]; picked: HubConceptSummary[] } {
  const byName = new Map(candidates.map((c) => [c.name.trim().toLowerCase(), c]))
  const byId = new Map(candidates.map((c) => [c.id, c]))
  const picked: HubConceptSummary[] = []
  const rest: ClarifyStageQuestion[] = []
  for (const q of questions) {
    if (q.id !== HUB_MATCHES_QUESTION_ID) { rest.push(q); continue }
    for (const option of q.options ?? []) {
      const key = option.trim()
      const c = byName.get(key.toLowerCase()) ?? byId.get(key)
      if (c && !picked.includes(c) && picked.length < HUB_PICK_LIMIT) picked.push(c)
    }
    if (picked.length) rest.push({ ...q, kind: 'select', multiSelect: true, options: picked.map((c) => c.name) })
  }
  return { questions: rest, picked }
}

/** 'json': the model answers with the questions as a JSON array (Studio's
 *  wizard turns them into a form). 'ask': the model asks the user itself,
 *  in its own chat (an MCP client). */
export type ClarifyMode = 'json' | 'ask'

/** `hubCandidates` are the stage's ranked Hub candidates; the model picks
 *  the ones that fit (at most HUB_PICK_LIMIT) for the user to confirm. */
export function buildClarifyPrompt(
  stageTitle: string,
  description: string,
  hubCandidates: HubConceptSummary[] | undefined,
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

  if (hubCandidates?.length) {
    lines.push(
      '',
      'Hub catalogue candidates for this stage (id | [category] name: description (tags)), best',
      'keyword match first. The ranking is only a hint and the description may be in any language:',
      ...hubCandidates.map(candidateLine),
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
    )
    if (hubCandidates?.length) {
      lines.push(
        '',
        `Additionally pick the Hub candidates that clearly fit THIS system — at most ${HUB_PICK_LIMIT}, the most`,
        'useful first, none if none fits — and ask the user which of your picks to apply (several can be',
        'kept; all of them unless the user deselects some). Pass the ids they keep as hubConcepts.',
      )
    }
    return lines.join('\n')
  }

  lines.push(
    'Respond with ONLY a JSON array (no prose, no markdown fences) of objects:',
    '{"id": string, "question": string, "kind": "text" | "select", "options"?: string[], "multiSelect"?: boolean}',
    'If nothing needs clarifying, respond with exactly: []',
  )

  if (hubCandidates?.length) {
    lines.push(
      '',
      `Additionally pick the Hub candidates that clearly fit THIS system — at most ${HUB_PICK_LIMIT}, the most`,
      `useful first — and include one question with id "${HUB_MATCHES_QUESTION_ID}", kind "select",`,
      'multiSelect true, whose options are the names of your picks exactly as written above, asking',
      'which of them the user wants applied. If none fits, leave that question out.',
    )
  }

  return lines.join('\n')
}

/** Formats answered questions as a "Q: ...\nA: ..." block for
 *  ./prompts.ts's `clarifications` param. The `hub_matches` question
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
