// ─── Ollama provider (local, no key needed) ─────────────────────────────────
// Uses /api/chat with stream:false. Ollama must be running with OLLAMA_ORIGINS
// set so the browser can talk to it from radical.tools (or localhost during dev).
//
// Tool calling: OpenAI-compatible `tools` request shape, but — confirmed via
// docs — responses carry no call id: a tool_calls[] entry is just
// {function:{name, arguments}} (arguments already a parsed object, not a
// JSON string), and results are correlated back by `tool_name`, not an id.
// Best-effort: not every locally-hosted model actually honors `tools` — a
// model that ignores it just returns plain text, which the generic "zero
// tool calls -> final answer" runner behavior already treats as a normal
// finish. Don't add heuristics for a model that emits malformed
// pseudo-tool-call text in `content` instead of populating `tool_calls` —
// documented limitation, not a bug to chase here.

import type { ChatContentBlock, ChatMessage, ChatRequest, ChatResponse, ProviderAdapter, ProviderConfig, TokenUsage } from '../types'

const DEFAULT_BASE = 'http://localhost:11434'

function makeCallId(name: string, index: number): string {
  return `${name}#${index}`
}

function callIdToName(id: string): string {
  const i = id.lastIndexOf('#')
  return i === -1 ? id : id.slice(0, i)
}

interface OllamaToolCall {
  function: { name: string; arguments: Record<string, unknown> }
}

function toOllamaMessages(messages: ChatMessage[]): Array<Record<string, unknown>> {
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
        content: textParts.length ? textParts.map((b) => b.text).join('') : '',
        tool_calls: toolCalls.map((c): OllamaToolCall => ({
          function: { name: c.name, arguments: (c.input ?? {}) as Record<string, unknown> },
        })),
      })
    } else if (textParts.length > 0) {
      out.push({ role: m.role, content: textParts.map((b) => b.text).join('') })
    }
    for (const r of toolResults) {
      out.push({
        role: 'tool',
        content: r.isError ? `Error: ${r.content}` : r.content,
        tool_name: callIdToName(r.toolCallId),
      })
    }
  }
  return out
}

function fromOllamaMessage(message: { content?: string; tool_calls?: OllamaToolCall[] }): ChatContentBlock[] {
  const out: ChatContentBlock[] = []
  if (message.content) out.push({ type: 'text', text: message.content })
  let i = 0
  for (const c of message.tool_calls ?? []) {
    out.push({ type: 'tool_call', id: makeCallId(c.function.name, i++), name: c.function.name, input: c.function.arguments ?? {} })
  }
  return out
}

// No "usage" object like the cloud providers — counts are two top-level
// fields, and there's no cache concept for a locally-run model.
function parseUsage(promptEvalCount: number | undefined, evalCount: number | undefined): TokenUsage | undefined {
  if (promptEvalCount === undefined && evalCount === undefined) return undefined
  return { inputTokens: promptEvalCount ?? 0, outputTokens: evalCount ?? 0 }
}

async function ollamaChat(req: ChatRequest, cfg: ProviderConfig): Promise<ChatResponse> {
  const base = (cfg.baseUrl || DEFAULT_BASE).replace(/\/+$/, '')
  const url = `${base}/api/chat`
  const body: Record<string, unknown> = {
    model: req.model,
    messages: toOllamaMessages(req.messages),
    stream: false,
    options: {
      temperature: req.temperature ?? 0.2,
      num_predict: req.maxTokens ?? 2048,
    },
  }
  if (req.tools?.length) {
    body.tools = req.tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.inputSchema },
    }))
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
  const data = await res.json() as {
    message?: { content?: string; tool_calls?: OllamaToolCall[] }
    model?: string
    done_reason?: string
    prompt_eval_count?: number
    eval_count?: number
  }
  const content = data?.message ? fromOllamaMessage(data.message) : []
  const hasToolCalls = content.some((b) => b.type === 'tool_call')
  return {
    content,
    model: data?.model,
    stopReason: hasToolCalls ? 'tool_calls' : (data?.done_reason === 'length' ? 'max_tokens' : 'end_turn'),
    usage: parseUsage(data?.prompt_eval_count, data?.eval_count),
  }
}

export const ollamaAdapter: ProviderAdapter = {
  id: 'ollama',
  label: 'Ollama (local)',
  defaultModel: 'llama3.1',
  defaultBaseUrl: DEFAULT_BASE,
  chat: ollamaChat,
}
