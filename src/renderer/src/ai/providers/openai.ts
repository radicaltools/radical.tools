// ─── OpenAI / ChatGPT provider ──────────────────────────────────────────────
// Chat Completions API (POST /v1/chat/completions) — confirmed current and
// still documenting `tools`/`tool_calls` (OpenAI's newer Responses API
// exists too, but Chat Completions remains supported and is what this app
// already targets).

import type { ChatContentBlock, ChatMessage, ChatRequest, ChatResponse, ProviderAdapter, ProviderConfig, TokenUsage } from '../types'

const DEFAULT_BASE = 'https://api.openai.com/v1'

interface OAToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

/** Generic canonical content -> OpenAI's message shapes. Assistant turns may
 *  mix text + tool_call blocks in one message; a tool-result-carrying user
 *  turn (always a pure batch per this app's runner) has no OpenAI bundle —
 *  it expands into one `role: 'tool'` message per result. */
function toOpenAIMessages(messages: ChatMessage[]): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = []
  for (const m of messages) {
    if (typeof m.content === 'string') {
      out.push({ role: m.role, content: m.content })
      continue
    }
    const textParts = m.content.filter((b): b is Extract<ChatContentBlock, { type: 'text' }> => b.type === 'text')
    const toolCalls = m.content.filter((b): b is Extract<ChatContentBlock, { type: 'tool_call' }> => b.type === 'tool_call')
    const toolResults = m.content.filter((b): b is Extract<ChatContentBlock, { type: 'tool_result' }> => b.type === 'tool_result')

    if (toolCalls.length > 0) {
      out.push({
        role: 'assistant',
        content: textParts.length ? textParts.map((b) => b.text).join('') : null,
        tool_calls: toolCalls.map((c): OAToolCall => ({
          id: c.id,
          type: 'function',
          function: { name: c.name, arguments: JSON.stringify(c.input ?? {}) },
        })),
      })
    } else if (textParts.length > 0) {
      out.push({ role: m.role, content: textParts.map((b) => b.text).join('') })
    }
    for (const r of toolResults) {
      out.push({
        role: 'tool',
        tool_call_id: r.toolCallId,
        content: r.isError ? `Error: ${r.content}` : r.content,
      })
    }
  }
  return out
}

function fromOpenAIMessage(message: { content?: string | null; tool_calls?: OAToolCall[] }): ChatContentBlock[] {
  const out: ChatContentBlock[] = []
  if (message.content) out.push({ type: 'text', text: message.content })
  for (const c of message.tool_calls ?? []) {
    let input: unknown = {}
    try {
      input = JSON.parse(c.function.arguments)
    } catch {
      // Malformed JSON from the model — leave input empty so the handler's
      // own required-field checks produce a self-correcting tool_result
      // instead of crashing the run.
    }
    out.push({ type: 'tool_call', id: c.id, name: c.function.name, input })
  }
  return out
}

function parseUsage(usage: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } } | undefined): TokenUsage | undefined {
  if (!usage) return undefined
  return {
    inputTokens: usage.prompt_tokens ?? 0,
    outputTokens: usage.completion_tokens ?? 0,
    // OpenAI caches automatically (no code needed to enable it) for prompts
    // sharing an identical >=1024-token prefix with a recent request.
    ...(usage.prompt_tokens_details?.cached_tokens !== undefined ? { cachedInputTokens: usage.prompt_tokens_details.cached_tokens } : {}),
  }
}

function toStopReason(finishReason: unknown): ChatResponse['stopReason'] {
  if (finishReason === 'tool_calls') return 'tool_calls'
  if (finishReason === 'stop') return 'end_turn'
  if (finishReason === 'length') return 'max_tokens'
  return 'other'
}

async function openaiChat(req: ChatRequest, cfg: ProviderConfig): Promise<ChatResponse> {
  if (!cfg.apiKey) throw new Error('OpenAI: API key is required')
  const base = (cfg.baseUrl || DEFAULT_BASE).replace(/\/+$/, '')
  const url = `${base}/chat/completions`
  const body: Record<string, unknown> = {
    model: req.model,
    messages: toOpenAIMessages(req.messages),
    temperature: req.temperature ?? 0.2,
    max_tokens: req.maxTokens ?? 2048,
  }
  if (req.tools?.length) {
    body.tools = req.tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.inputSchema },
    }))
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
    choices?: Array<{ message?: { content?: string | null; tool_calls?: OAToolCall[] }; finish_reason?: string }>
    usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } }
  }
  const choice = data?.choices?.[0]
  return {
    content: choice?.message ? fromOpenAIMessage(choice.message) : [],
    model: data?.model,
    stopReason: toStopReason(choice?.finish_reason),
    usage: parseUsage(data?.usage),
  }
}

export const openaiAdapter: ProviderAdapter = {
  id: 'openai',
  label: 'OpenAI (ChatGPT)',
  defaultModel: 'gpt-4o-mini',
  defaultBaseUrl: DEFAULT_BASE,
  chat: openaiChat,
}
