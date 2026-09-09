// ─── Ollama provider (local, no key needed) ─────────────────────────────────
// Uses /api/chat with stream:false. Ollama must be running with OLLAMA_ORIGINS
// set so the browser can talk to it from radical.tools (or localhost during dev).
//
// Real tool-calling for this provider isn't implemented yet (Stage 0 ships
// Anthropic only) — this adapter stays usable as plain chat: it ignores
// `req.tools` and flattens any tool_call/tool_result blocks to plain text.

import type { ChatRequest, ChatResponse, ProviderAdapter, ProviderConfig } from '../types'
import { contentToText } from '../types'

const DEFAULT_BASE = 'http://localhost:11434'

async function ollamaChat(req: ChatRequest, cfg: ProviderConfig): Promise<ChatResponse> {
  const base = (cfg.baseUrl || DEFAULT_BASE).replace(/\/+$/, '')
  const url = `${base}/api/chat`
  const body = {
    model: req.model,
    messages: req.messages.map((m) => ({ role: m.role, content: contentToText(m.content) })),
    stream: false,
    options: {
      temperature: req.temperature ?? 0.2,
      num_predict: req.maxTokens ?? 2048,
    },
  }
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: req.signal,
    })
  } catch (err) {
    // Network-level failure. The most common case from a hosted page is a
    // CORS-blocked preflight: Ollama needs OLLAMA_ORIGINS to whitelist the
    // page's origin. We can't tell the difference between "server is down"
    // and "CORS rejected" from JS — both surface as TypeError — so the
    // message points at both possibilities and includes the exact env var
    // string the user needs to set on their machine.
    const origin = typeof window !== 'undefined' ? window.location.origin : '*'
    throw new Error(
      `Cannot reach Ollama at ${base}. ` +
      `If Ollama is running, this is almost certainly a CORS/preflight block — ` +
      `restart it with OLLAMA_ORIGINS allowing this page. macOS example:\n` +
      `  launchctl setenv OLLAMA_ORIGINS "${origin}"\n` +
      `  # then restart the Ollama app\n` +
      `Underlying error: ${(err as Error).message}`,
    )
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Ollama HTTP ${res.status}: ${text || res.statusText}`)
  }
  const data = await res.json() as { message?: { content?: string }; model?: string; done_reason?: string }
  const text = data?.message?.content ?? ''
  return {
    content: text ? [{ type: 'text', text }] : [],
    model: data?.model,
    stopReason: data?.done_reason === 'length' ? 'max_tokens' : 'end_turn',
  }
}

export const ollamaAdapter: ProviderAdapter = {
  id: 'ollama',
  label: 'Ollama (local)',
  defaultModel: 'llama3.1',
  defaultBaseUrl: DEFAULT_BASE,
  chat: ollamaChat,
}
