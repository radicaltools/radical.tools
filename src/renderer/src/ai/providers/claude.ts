// ─── Anthropic Claude provider ──────────────────────────────────────────────
// The Messages API takes the system prompt as a top-level field and excludes
// it from `messages`. The header `anthropic-dangerous-direct-browser-access`
// is required when calling from a browser with a user-provided key.
//
// Tool calling: this is the canonical shape the app's generic ChatMessage/
// ChatContentBlock types already mirror — a tool result is a content block
// inside a `user`-role message, no separate 'tool' role. Every other
// provider's adapter expands/repacks from this shape.

import type { ChatContentBlock, ChatMessage, ChatRequest, ChatResponse, ProviderAdapter, ProviderConfig, TokenUsage } from '../types'

const DEFAULT_BASE = 'https://api.anthropic.com/v1'
const ANTHROPIC_VERSION = '2023-06-01'

interface AnthropicBlock {
  type: string
  text?: string
  id?: string
  name?: string
  input?: unknown
  tool_use_id?: string
  content?: string
  is_error?: boolean
  cache_control?: { type: 'ephemeral' }
}

/** `cacheBreakpoint` on a message (see ai/runner.ts's rolling within-stage
 *  breakpoint) needs to land on that message's LAST content block — a plain
 *  string message is lifted into single-block array form so it has
 *  somewhere to carry it; a message with no flag is untouched either way. */
function toAnthropicContent(content: string | ChatContentBlock[], cacheBreakpoint?: boolean): string | AnthropicBlock[] {
  if (typeof content === 'string') {
    if (!cacheBreakpoint) return content
    return [{ type: 'text', text: content, cache_control: { type: 'ephemeral' } }]
  }
  const blocks = content.map((b): AnthropicBlock => {
    if (b.type === 'text') return { type: 'text', text: b.text }
    if (b.type === 'tool_call') return { type: 'tool_use', id: b.id, name: b.name, input: b.input }
    return { type: 'tool_result', tool_use_id: b.toolCallId, content: b.content, is_error: b.isError }
  })
  if (cacheBreakpoint && blocks.length) blocks[blocks.length - 1].cache_control = { type: 'ephemeral' }
  return blocks
}

function fromAnthropicContent(blocks: AnthropicBlock[]): ChatContentBlock[] {
  const out: ChatContentBlock[] = []
  for (const b of blocks) {
    if (b.type === 'text' && typeof b.text === 'string') out.push({ type: 'text', text: b.text })
    else if (b.type === 'tool_use' && b.id && b.name) out.push({ type: 'tool_call', id: b.id, name: b.name, input: b.input })
    // Anthropic responses never contain tool_result blocks — those only
    // appear in outgoing user turns — so nothing else to map here.
  }
  return out
}

interface AnthropicSystemBlock {
  type: 'text'
  text: string
  cache_control?: { type: 'ephemeral' }
}

/** Pulls every `system`-role message out into Anthropic's separate `system`
 *  field, as an array of blocks (not one joined string) so a message flagged
 *  `cacheBreakpoint` can carry its own `cache_control` — everything up to and
 *  including that block is then reusable cache across rounds/stages that
 *  share the identical prefix (see ai/systemPrompt.ts for which block that
 *  is and why). A `system` array with no cache_control block behaves exactly
 *  like the plain string this replaced — this is a superset, not a behavior
 *  change for callers that don't set the flag. */
function splitSystem(messages: ChatMessage[]): { system: AnthropicSystemBlock[]; rest: ChatMessage[] } {
  const system: AnthropicSystemBlock[] = []
  const rest: ChatMessage[] = []
  for (const m of messages) {
    if (m.role === 'system') {
      const text = typeof m.content === 'string' ? m.content : ''
      if (!text) continue
      system.push({
        type: 'text',
        text,
        ...(m.cacheBreakpoint ? { cache_control: { type: 'ephemeral' } } : {}),
      })
    } else {
      rest.push(m)
    }
  }
  return { system, rest }
}

/** Anthropic's `input_tokens` is deliberately ONLY the fresh, non-cached
 *  portion of the prompt — a cache hit/write moves those tokens into
 *  `cache_read_input_tokens`/`cache_creation_input_tokens` instead, so a
 *  well-cached request can report `input_tokens: 21` even for a 10K-token
 *  prompt. `TokenUsage.inputTokens` is meant to be the TOTAL (matching
 *  OpenAI's `prompt_tokens`, which already includes its cached portion —
 *  see providers/openai.ts) — folding all three in here is what makes the
 *  displayed counter track real spend instead of silently undercounting
 *  every cached request (i.e. nearly every request, once caching is on). */
function parseUsage(usage: {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
} | undefined): TokenUsage | undefined {
  if (!usage) return undefined
  const cacheRead = usage.cache_read_input_tokens ?? 0
  const cacheCreation = usage.cache_creation_input_tokens ?? 0
  return {
    inputTokens: (usage.input_tokens ?? 0) + cacheRead + cacheCreation,
    outputTokens: usage.output_tokens ?? 0,
    ...(usage.cache_read_input_tokens !== undefined ? { cachedInputTokens: usage.cache_read_input_tokens } : {}),
  }
}

function toStopReason(stopReason: unknown): ChatResponse['stopReason'] {
  if (stopReason === 'tool_use') return 'tool_calls'
  if (stopReason === 'end_turn') return 'end_turn'
  if (stopReason === 'max_tokens') return 'max_tokens'
  return 'other'
}

async function claudeChat(req: ChatRequest, cfg: ProviderConfig): Promise<ChatResponse> {
  if (!cfg.apiKey) throw new Error('Anthropic: API key is required')
  const base = (cfg.baseUrl || DEFAULT_BASE).replace(/\/+$/, '')
  const url = `${base}/messages`
  const { system, rest } = splitSystem(req.messages)
  const body: Record<string, unknown> = {
    model: req.model,
    max_tokens: req.maxTokens ?? 2048,
    messages: rest.map((m) => ({ role: m.role, content: toAnthropicContent(m.content, m.cacheBreakpoint) })),
  }
  if (system.length) body.system = system
  if (req.tools?.length) {
    body.tools = req.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema }))
  }
  // No `temperature`: current-generation models (Opus 5, Sonnet 5, ...) run
  // adaptive extended thinking by default, and thinking rejects sampling
  // params (temperature/top_p/top_k) with a 400. Omitting it works across
  // every model version instead of hardcoding which ones allow it.

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
    signal: req.signal,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Anthropic HTTP ${res.status}: ${text || res.statusText}`)
  }
  const data = await res.json() as {
    model?: string
    content?: AnthropicBlock[]
    stop_reason?: string
    usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number }
  }
  return {
    content: fromAnthropicContent(data?.content ?? []),
    model: data?.model,
    stopReason: toStopReason(data?.stop_reason),
    usage: parseUsage(data?.usage),
  }
}

export const claudeAdapter: ProviderAdapter = {
  id: 'anthropic',
  label: 'Anthropic (Claude)',
  defaultModel: 'claude-haiku-4-5',
  defaultBaseUrl: DEFAULT_BASE,
  chat: claudeChat,
}
