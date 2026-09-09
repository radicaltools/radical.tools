// ─── AI integration: shared types ───────────────────────────────────────────

export type AIProviderId = 'ollama' | 'openai' | 'anthropic' | 'gemini'

// ─── Chat wire format (provider-agnostic) ───────────────────────────────────
//
// Canonical shape follows Anthropic's: a tool result is a content block
// inside a `user`-role message, with no separate 'tool' role. Every other
// provider's adapter expands/repacks from this shape (not the other way
// round) — see providers/*.ts.

export type ChatContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; toolCallId: string; content: string; isError?: boolean }

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  /** A bare string is sugar for a single text block. Only an assistant turn
   *  that made tool calls, and the turn reporting their results, use blocks. */
  content: string | ChatContentBlock[]
}

export interface ToolDef {
  name: string
  description: string
  /** Conservative common-subset JSON Schema (type/properties/required/enum/
   *  items/description/additionalProperties) — kept identical across every
   *  adapter so none has to translate a provider-specific schema dialect. */
  inputSchema: Record<string, unknown>
}

export interface ChatRequest {
  model: string
  messages: ChatMessage[]
  tools?: ToolDef[]
  /** Max tokens for the response. */
  maxTokens?: number
  /** Sampling temperature, 0..1. Provider adapters may drop this where it
   *  conflicts with a model's default reasoning mode (see providers/claude.ts). */
  temperature?: number
  /** Abort signal for cancellation. */
  signal?: AbortSignal
}

export interface ChatResponse {
  /** Ordered blocks the assistant produced, in emission order. Push this
   *  straight back as the next assistant ChatMessage.content — providers
   *  that echo tool-call ids need to see their own prior ones on the next turn. */
  content: ChatContentBlock[]
  /** Provider-reported model name (if available). */
  model?: string
  stopReason: 'tool_calls' | 'end_turn' | 'max_tokens' | 'other'
}

export function textOf(content: ChatContentBlock[]): string {
  return content
    .filter((b): b is Extract<ChatContentBlock, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('')
}

export function toolCallsOf(content: ChatContentBlock[]): Array<Extract<ChatContentBlock, { type: 'tool_call' }>> {
  return content.filter((b): b is Extract<ChatContentBlock, { type: 'tool_call' }> => b.type === 'tool_call')
}

/** Flattens any message content — including tool_call/tool_result blocks —
 *  to plain text. Used by providers that don't implement real tool-calling
 *  yet, so a message inherited from a tool-calling-capable provider (e.g.
 *  after a mid-session provider switch) degrades to readable text instead of
 *  crashing the request. */
export function contentToText(content: string | ChatContentBlock[]): string {
  if (typeof content === 'string') return content
  return content.map((b) => {
    if (b.type === 'text') return b.text
    if (b.type === 'tool_call') return `[called ${b.name}(${JSON.stringify(b.input)})]`
    return `[tool result: ${b.content}]`
  }).join('\n')
}

/** Provider configuration entry stored in settings. */
export interface ProviderConfig {
  /** API key (not used for Ollama). */
  apiKey?: string
  /** Base URL override. Defaults to provider-default if empty. */
  baseUrl?: string
  /** Default model name to use for this provider. */
  model?: string
}

export interface AISettings {
  /** Master enable/disable switch for the whole AI feature. When false,
   *  the AI UI (Quick Search ✨ toggle, Ask-AI shortcuts, etc.) stays
   *  hidden even if a provider is fully configured. */
  enabled: boolean
  /** Currently active provider. */
  active: AIProviderId
  providers: Record<AIProviderId, ProviderConfig>
}

/** Function signature implemented by every provider adapter. */
export type ChatFn = (req: ChatRequest, cfg: ProviderConfig) => Promise<ChatResponse>

export interface ProviderAdapter {
  id: AIProviderId
  label: string
  /** Human-friendly default model (used as a hint in the UI). */
  defaultModel: string
  /** Default base URL — providers may ignore if hard-coded. */
  defaultBaseUrl?: string
  chat: ChatFn
}
