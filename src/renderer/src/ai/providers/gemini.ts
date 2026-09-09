// ─── Google Gemini provider ─────────────────────────────────────────────────
// Uses the v1beta generateContent endpoint — confirmed current (Google's
// newer "Interactions API" is a separate, additional surface, not a
// replacement for generateContent). System prompts go into
// `system_instruction`, the rest into `contents`.
//
// Tool calling: a `functionCall` part carries only `name` + `args` (an
// object, not a JSON string) — no call id, confirmed across every
// documented example. Two parallel calls to the SAME function name in one
// turn can't be disambiguated on the way back (functionResponse also
// matches by name only) — this app synthesizes a `${name}#${index}` id
// purely for the generic runner's own bookkeeping and strips it back off
// when building the request. Flagged as an open risk: parallel-same-name
// calls route by name only, so if Gemini itself doesn't guarantee ordering
// there's no way to tell two such results apart on this end either.

import type { ChatContentBlock, ChatMessage, ChatRequest, ChatResponse, ProviderAdapter, ProviderConfig } from '../types'

const DEFAULT_BASE = 'https://generativelanguage.googleapis.com/v1beta'

function makeCallId(name: string, index: number): string {
  return `${name}#${index}`
}

function callIdToName(id: string): string {
  const i = id.lastIndexOf('#')
  return i === -1 ? id : id.slice(0, i)
}

interface GeminiPart {
  text?: string
  functionCall?: { name: string; args?: Record<string, unknown> }
  functionResponse?: { name: string; response: Record<string, unknown> }
}

function toGeminiContents(messages: ChatMessage[]): {
  system?: { parts: Array<{ text: string }> }
  contents: Array<{ role: 'user' | 'model'; parts: GeminiPart[] }>
} {
  const systems: string[] = []
  const contents: Array<{ role: 'user' | 'model'; parts: GeminiPart[] }> = []
  for (const m of messages) {
    if (m.role === 'system') {
      systems.push(typeof m.content === 'string' ? m.content : '')
      continue
    }
    const role = m.role === 'assistant' ? 'model' : 'user'
    if (typeof m.content === 'string') {
      contents.push({ role, parts: [{ text: m.content }] })
      continue
    }
    const parts: GeminiPart[] = m.content.map((b): GeminiPart => {
      if (b.type === 'text') return { text: b.text }
      if (b.type === 'tool_call') return { functionCall: { name: b.name, args: (b.input ?? {}) as Record<string, unknown> } }
      return { functionResponse: { name: callIdToName(b.toolCallId), response: { result: b.isError ? `Error: ${b.content}` : b.content } } }
    })
    contents.push({ role, parts })
  }
  return {
    system: systems.length ? { parts: [{ text: systems.join('\n\n') }] } : undefined,
    contents,
  }
}

function fromGeminiParts(parts: GeminiPart[]): ChatContentBlock[] {
  // Gemini often splits one logical response across several adjacent text
  // parts — join them into a single block rather than one-per-part.
  const text = parts.map((p) => p.text ?? '').join('')
  const out: ChatContentBlock[] = text ? [{ type: 'text', text }] : []
  let callIndex = 0
  for (const p of parts) {
    if (p.functionCall) {
      out.push({ type: 'tool_call', id: makeCallId(p.functionCall.name, callIndex++), name: p.functionCall.name, input: p.functionCall.args ?? {} })
    }
  }
  return out
}

// The presence of functionCall parts is a more reliable "the model wants to
// call a tool" signal than Gemini's finishReason (whose exact tool-calling
// value isn't consistently documented) — this app's runner only branches on
// content anyway, so lean on that instead of the field.
function toStopReason(finishReason: unknown, hasToolCalls: boolean): ChatResponse['stopReason'] {
  if (hasToolCalls) return 'tool_calls'
  if (finishReason === 'MAX_TOKENS') return 'max_tokens'
  if (finishReason === 'STOP') return 'end_turn'
  return 'other'
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
  if (req.tools?.length) {
    body.tools = [{
      functionDeclarations: req.tools.map((t) => ({ name: t.name, description: t.description, parameters: t.inputSchema })),
    }]
  }

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
    candidates?: Array<{ content?: { parts?: GeminiPart[] }; finishReason?: string }>
    modelVersion?: string
  }
  const parts = data?.candidates?.[0]?.content?.parts ?? []
  const content = fromGeminiParts(parts)
  const hasToolCalls = content.some((b) => b.type === 'tool_call')
  return {
    content,
    model: data?.modelVersion,
    stopReason: toStopReason(data?.candidates?.[0]?.finishReason, hasToolCalls),
  }
}

export const geminiAdapter: ProviderAdapter = {
  id: 'gemini',
  label: 'Google Gemini',
  defaultModel: 'gemini-1.5-flash',
  defaultBaseUrl: DEFAULT_BASE,
  chat: geminiChat,
}
