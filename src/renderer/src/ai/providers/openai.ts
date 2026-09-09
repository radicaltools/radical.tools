// ─── OpenAI / ChatGPT provider ──────────────────────────────────────────────
// Real tool-calling for this provider isn't implemented yet (Stage 0 ships
// Anthropic only) — this adapter stays usable as plain chat: it ignores
// `req.tools` and flattens any tool_call/tool_result blocks (e.g. inherited
// from a prior run on a tool-calling-capable provider) to plain text rather
// than erroring.

import type { ChatRequest, ChatResponse, ProviderAdapter, ProviderConfig } from '../types'
import { contentToText } from '../types'

const DEFAULT_BASE = 'https://api.openai.com/v1'

async function openaiChat(req: ChatRequest, cfg: ProviderConfig): Promise<ChatResponse> {
  if (!cfg.apiKey) throw new Error('OpenAI: API key is required')
  const base = (cfg.baseUrl || DEFAULT_BASE).replace(/\/+$/, '')
  const url = `${base}/chat/completions`
  const body: Record<string, unknown> = {
    model: req.model,
    messages: req.messages.map((m) => ({ role: m.role, content: contentToText(m.content) })),
    temperature: req.temperature ?? 0.2,
    max_tokens: req.maxTokens ?? 2048,
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: req.signal,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OpenAI HTTP ${res.status}: ${text || res.statusText}`)
  }
  const data = await res.json() as {
    model?: string
    choices?: Array<{ message?: { content?: string }; finish_reason?: string }>
  }
  const text = data?.choices?.[0]?.message?.content ?? ''
  return {
    content: text ? [{ type: 'text', text }] : [],
    model: data?.model,
    stopReason: data?.choices?.[0]?.finish_reason === 'length' ? 'max_tokens' : 'end_turn',
  }
}

export const openaiAdapter: ProviderAdapter = {
  id: 'openai',
  label: 'OpenAI (ChatGPT)',
  defaultModel: 'gpt-4o-mini',
  defaultBaseUrl: DEFAULT_BASE,
  chat: openaiChat,
}
