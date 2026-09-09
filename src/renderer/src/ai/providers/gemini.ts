// ─── Google Gemini provider ─────────────────────────────────────────────────
// Uses the v1beta generateContent endpoint with API key in the query string.
// System prompts go into `system_instruction`, the rest into `contents`.
//
// Real tool-calling for this provider isn't implemented yet (Stage 0 ships
// Anthropic only) — this adapter stays usable as plain chat: it ignores
// `req.tools` and flattens any tool_call/tool_result blocks to plain text.

import type { ChatMessage, ChatRequest, ChatResponse, ProviderAdapter, ProviderConfig } from '../types'
import { contentToText } from '../types'

const DEFAULT_BASE = 'https://generativelanguage.googleapis.com/v1beta'

function toGeminiContents(messages: ChatMessage[]): {
  system?: { parts: Array<{ text: string }> }
  contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>
} {
  const systems: string[] = []
  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = []
  for (const m of messages) {
    if (m.role === 'system') {
      systems.push(contentToText(m.content))
    } else {
      contents.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: contentToText(m.content) }],
      })
    }
  }
  return {
    system: systems.length ? { parts: [{ text: systems.join('\n\n') }] } : undefined,
    contents,
  }
}

async function geminiChat(req: ChatRequest, cfg: ProviderConfig): Promise<ChatResponse> {
  if (!cfg.apiKey) throw new Error('Gemini: API key is required')
  const base = (cfg.baseUrl || DEFAULT_BASE).replace(/\/+$/, '')
  const url = `${base}/models/${encodeURIComponent(req.model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`
  const { system, contents } = toGeminiContents(req.messages)
  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: req.temperature ?? 0.2,
      maxOutputTokens: req.maxTokens ?? 2048,
    },
  }
  if (system) body.system_instruction = system

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: req.signal,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Gemini HTTP ${res.status}: ${text || res.statusText}`)
  }
  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>
    modelVersion?: string
  }
  const parts = data?.candidates?.[0]?.content?.parts ?? []
  const text = parts.map((p) => p?.text ?? '').join('')
  return {
    content: text ? [{ type: 'text', text }] : [],
    model: data?.modelVersion,
    stopReason: data?.candidates?.[0]?.finishReason === 'MAX_TOKENS' ? 'max_tokens' : 'end_turn',
  }
}

export const geminiAdapter: ProviderAdapter = {
  id: 'gemini',
  label: 'Google Gemini',
  defaultModel: 'gemini-1.5-flash',
  defaultBaseUrl: DEFAULT_BASE,
  chat: geminiChat,
}
