// ─── Anthropic Claude provider ──────────────────────────────────────────────
// The Messages API takes the system prompt as a top-level field and excludes
// it from `messages`. The header `anthropic-dangerous-direct-browser-access`
// is required when calling from a browser with a user-provided key.
//
// Tool calling: this is the canonical shape the app's generic ChatMessage/
// ChatContentBlock types already mirror — a tool result is a content block
// inside a `user`-role message, no separate 'tool' role. Every other
// provider's adapter expands/repacks from this shape.

import type { ChatContentBlock, ChatMessage, ChatRequest, ChatResponse, ProviderAdapter, ProviderConfig } from '../types'

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
}

function toAnthropicContent(content: string | ChatContentBlock[]): string | AnthropicBlock[] {
  if (typeof content === 'string') return content
  return content.map((b): AnthropicBlock => {
    if (b.type === 'text') return { type: 'text', text: b.text }
    if (b.type === 'tool_call') return { type: 'tool_use', id: b.id, name: b.name, input: b.input }
    return { type: 'tool_result', tool_use_id: b.toolCallId, content: b.content, is_error: b.isError }
  })
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

function splitSystem(messages: ChatMessage[]): { system: string; rest: ChatMessage[] } {
  const systems: string[] = []
  const rest: ChatMessage[] = []
  for (const m of messages) {
    if (m.role === 'system') systems.push(typeof m.content === 'string' ? m.content : '')
    else rest.push(m)
  }
  return { system: systems.join('\n\n'), rest }
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
    messages: rest.map((m) => ({ role: m.role, content: toAnthropicContent(m.content) })),
  }
  if (system) body.system = system
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
  }
  return {
    content: fromAnthropicContent(data?.content ?? []),
    model: data?.model,
    stopReason: toStopReason(data?.stop_reason),
  }
}

export const claudeAdapter: ProviderAdapter = {
  id: 'anthropic',
  label: 'Anthropic (Claude)',
  defaultModel: 'claude-haiku-4-5',
  defaultBaseUrl: DEFAULT_BASE,
  chat: claudeChat,
}
