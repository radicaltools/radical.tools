// ─── Radical Forge — clarifying questions ───────────────────────────────────
// Studio's clarify call: the prompt and the parsing live in
// @radical/common/ai/forge. This is a SEPARATE, tool-less call to the provider
// adapter, not a tool inside the runAIPrompt loop: that loop (ai/runner.ts)
// runs every tool call to completion with no mechanism to pause mid-run for
// human input, and teaching it to do so would mean real surgery on
// already-shipped infrastructure. A plain second call is simpler and
// provider-agnostic — same pattern AISettingsModal.tsx already uses for its
// "Test connection" button: getAdapter(id).chat({...}, cfg) then textOf(res.content).

import { buildClarifyPrompt, parseClarifyReply, withConcernQuestions, type ClarifyStageQuestion, type ConcernsClarifyOptions } from '@radical/common/ai/forge'
import type { ConcernPack } from '@radical/common/concerns'
import { getAdapter } from './registry'
import { textOf, type AISettings, type TokenUsage } from './types'

export interface ClarifyResult {
  questions: ClarifyStageQuestion[]
  /** The concern packs proposed (Requirements stage: the model's picks and
   *  the baseline packs; Review: the open concerns); the concerns question
   *  in which the user unchecks them, and their questions, are among
   *  `questions`. */
  picked: ConcernPack[]
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
  concernPacks: ConcernPack[] | undefined,
  settings: AISettings,
  signal?: AbortSignal,
  priorQA?: string,
  concerns: ConcernsClarifyOptions = {},
): Promise<ClarifyResult> {
  const adapter = getAdapter(settings.active)
  const cfg = settings.providers[settings.active]
  // Deliberately ignores cfg.model (the user's chosen *generation* model,
  // which may be a pricier tier for quality) — clarify is a small, cheap,
  // structured-output task, and every adapter's defaultModel is already
  // that provider's fast/cheap tier (see providers/*.ts), so this always
  // routes clarify there regardless of what generation is configured to use.
  const res = await adapter.chat({
    model: adapter.defaultModel,
    messages: [{ role: 'user', content: buildClarifyPrompt(stageTitle, description, concernPacks, priorQA, 'json', concerns) }],
    maxTokens: 900,
    temperature: 0.3,
    signal,
  }, cfg)
  // A reply that is no JSON array asks nothing, but the packs proposed
  // whatever the model picks (the baseline packs) still are.
  const reply = parseClarifyReply(textOf(res.content)) ?? []
  const { questions, picked } = withConcernQuestions(reply, concernPacks ?? [], concerns.stage)
  return { questions, picked, usage: res.usage }
}
