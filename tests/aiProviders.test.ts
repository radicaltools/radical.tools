import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ollamaAdapter } from '../src/renderer/src/ai/providers/ollama'
import { openaiAdapter } from '../src/renderer/src/ai/providers/openai'
import { claudeAdapter } from '../src/renderer/src/ai/providers/claude'
import { geminiAdapter } from '../src/renderer/src/ai/providers/gemini'
import { ADAPTERS, getAdapter, listAdapters } from '../src/renderer/src/ai/registry'
import type { ChatMessage, ChatRequest } from '../src/renderer/src/ai/types'

interface CapturedCall {
  url: string
  init: RequestInit
  bodyParsed: any
}

function installFetch(response: any, status = 200): { calls: CapturedCall[] } {
  const calls: CapturedCall[] = []
  ;(globalThis as any).fetch = vi.fn(async (url: string, init: RequestInit) => {
    const bodyText = typeof init?.body === 'string' ? init.body : ''
    calls.push({ url, init, bodyParsed: bodyText ? JSON.parse(bodyText) : null })
    return new Response(JSON.stringify(response), {
      status,
      headers: { 'content-type': 'application/json' },
    }) as any
  })
  return { calls }
}

const SAMPLE: ChatMessage[] = [
  { role: 'system', content: 'sys-1' },
  { role: 'user', content: 'hello' },
]

describe('AI providers', () => {
  beforeEach(() => {
    delete (globalThis as any).fetch
  })

  it('registry exposes all four adapters', () => {
    const ids = listAdapters().map((a) => a.id).sort()
    expect(ids).toEqual(['anthropic', 'gemini', 'ollama', 'openai'])
    expect(getAdapter('ollama').label).toMatch(/Ollama/)
    expect(ADAPTERS.openai).toBe(openaiAdapter)
  })

  it('Ollama: posts to /api/chat with stream:false and parses message.content', async () => {
    const { calls } = installFetch({ message: { content: 'hi from llama' }, model: 'llama3.1' })
    const req: ChatRequest = { model: 'llama3.1', messages: SAMPLE }
    const out = await ollamaAdapter.chat(req, { baseUrl: 'http://h:1234' })
    expect(out.content).toEqual([{ type: 'text', text: 'hi from llama' }])
    expect(out.model).toBe('llama3.1')
    expect(out.stopReason).toBe('end_turn')
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('http://h:1234/api/chat')
    expect(calls[0].bodyParsed.stream).toBe(false)
    expect(calls[0].bodyParsed.messages).toEqual([
      { role: 'system', content: 'sys-1' },
      { role: 'user', content: 'hello' },
    ])
  })

  it('Ollama: throws on non-2xx', async () => {
    installFetch({ error: 'nope' }, 500)
    await expect(ollamaAdapter.chat({ model: 'm', messages: SAMPLE }, {})).rejects.toThrow(/Ollama HTTP 500/)
  })

  it('Ollama: flattens tool_call/tool_result blocks to plain text (real tool-calling not implemented yet)', async () => {
    const { calls } = installFetch({ message: { content: 'ok' }, model: 'llama3.1' })
    await ollamaAdapter.chat({
      model: 'llama3.1',
      messages: [
        { role: 'user', content: 'do it' },
        { role: 'assistant', content: [{ type: 'tool_call', id: 'c1', name: 'add_node', input: { label: 'X' } }] },
        { role: 'user', content: [{ type: 'tool_result', toolCallId: 'c1', content: 'Created node n1.' }] },
      ],
    }, {})
    expect(calls[0].bodyParsed.messages[1].content).toMatch(/called add_node/)
    expect(calls[0].bodyParsed.messages[2].content).toMatch(/tool result: Created node n1/)
  })

  describe('OpenAI — real tool-calling', () => {
    it('requires key, sends Bearer auth, forwards tools as {type:function,function:{...}}', async () => {
      await expect(openaiAdapter.chat({ model: 'm', messages: SAMPLE }, {})).rejects.toThrow(/API key/)
      const { calls } = installFetch({
        model: 'gpt-4o-mini',
        choices: [{ message: { content: 'reply' }, finish_reason: 'stop' }],
      })
      const out = await openaiAdapter.chat(
        {
          model: 'gpt-4o-mini',
          messages: SAMPLE,
          tools: [{ name: 'add_node', description: 'Add a node', inputSchema: { type: 'object', properties: {} } }],
        },
        { apiKey: 'sk-x' },
      )
      expect(out.content).toEqual([{ type: 'text', text: 'reply' }])
      expect(out.stopReason).toBe('end_turn')
      expect(calls[0].url).toBe('https://api.openai.com/v1/chat/completions')
      expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer sk-x')
      expect(calls[0].bodyParsed.tools).toEqual([
        { type: 'function', function: { name: 'add_node', description: 'Add a node', parameters: { type: 'object', properties: {} } } },
      ])
    })

    it('maps tool_calls response entries to generic tool_call blocks, parsing JSON arguments', async () => {
      installFetch({
        model: 'gpt-4o-mini',
        choices: [{
          message: {
            content: null,
            tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'add_node', arguments: '{"tempId":"t1","type":"system","label":"X"}' } }],
          },
          finish_reason: 'tool_calls',
        }],
      })
      const out = await openaiAdapter.chat({ model: 'm', messages: SAMPLE }, { apiKey: 'k' })
      expect(out.stopReason).toBe('tool_calls')
      expect(out.content).toEqual([
        { type: 'tool_call', id: 'call_1', name: 'add_node', input: { tempId: 't1', type: 'system', label: 'X' } },
      ])
    })

    it('falls back to an empty input object when arguments is malformed JSON', async () => {
      installFetch({
        model: 'gpt-4o-mini',
        choices: [{
          message: { content: null, tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'add_node', arguments: '{not json' } }] },
          finish_reason: 'tool_calls',
        }],
      })
      const out = await openaiAdapter.chat({ model: 'm', messages: SAMPLE }, { apiKey: 'k' })
      expect(out.content).toEqual([{ type: 'tool_call', id: 'call_1', name: 'add_node', input: {} }])
    })

    it('expands an assistant tool_call turn into tool_calls, and a tool_result turn into N role:tool messages', async () => {
      const { calls } = installFetch({ model: 'm', choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] })
      await openaiAdapter.chat({
        model: 'm',
        messages: [
          { role: 'user', content: 'go' },
          {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Working on it.' },
              { type: 'tool_call', id: 'call_1', name: 'add_node', input: { label: 'X' } },
            ],
          },
          {
            role: 'user',
            content: [{ type: 'tool_result', toolCallId: 'call_1', content: 'Created node n1.', isError: false }],
          },
        ],
      }, { apiKey: 'k' })
      expect(calls[0].bodyParsed.messages).toEqual([
        { role: 'user', content: 'go' },
        {
          role: 'assistant',
          content: 'Working on it.',
          tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'add_node', arguments: '{"label":"X"}' } }],
        },
        { role: 'tool', tool_call_id: 'call_1', content: 'Created node n1.' },
      ])
    })
  })

  describe('Claude — real tool-calling', () => {
    it('splits system, sets x-api-key + version + browser-access headers, forwards tools, omits temperature', async () => {
      await expect(claudeAdapter.chat({ model: 'm', messages: SAMPLE }, {})).rejects.toThrow(/API key/)
      const { calls } = installFetch({
        model: 'claude-haiku-4-5',
        content: [{ type: 'text', text: 'hello' }],
        stop_reason: 'end_turn',
      })
      const out = await claudeAdapter.chat(
        {
          model: 'claude-haiku-4-5',
          messages: SAMPLE,
          temperature: 0.2,
          tools: [{ name: 'add_node', description: 'Add a node', inputSchema: { type: 'object', properties: {} } }],
        },
        { apiKey: 'k-claude' },
      )
      expect(out.content).toEqual([{ type: 'text', text: 'hello' }])
      expect(out.stopReason).toBe('end_turn')
      expect(calls[0].url).toBe('https://api.anthropic.com/v1/messages')
      const headers = calls[0].init.headers as Record<string, string>
      expect(headers['x-api-key']).toBe('k-claude')
      expect(headers['anthropic-version']).toBe('2023-06-01')
      expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true')
      expect(calls[0].bodyParsed.system).toBe('sys-1')
      expect(calls[0].bodyParsed.messages).toEqual([{ role: 'user', content: 'hello' }])
      expect(calls[0].bodyParsed.tools).toEqual([
        { name: 'add_node', description: 'Add a node', input_schema: { type: 'object', properties: {} } },
      ])
      expect(calls[0].bodyParsed.temperature).toBeUndefined()
    })

    it('maps tool_use response blocks to generic tool_call blocks with stopReason "tool_calls"', async () => {
      installFetch({
        model: 'claude-haiku-4-5',
        content: [
          { type: 'text', text: 'Adding a node.' },
          { type: 'tool_use', id: 'call_1', name: 'add_node', input: { tempId: 't1', type: 'system', label: 'X' } },
        ],
        stop_reason: 'tool_use',
      })
      const out = await claudeAdapter.chat({ model: 'm', messages: SAMPLE }, { apiKey: 'k' })
      expect(out.stopReason).toBe('tool_calls')
      expect(out.content).toEqual([
        { type: 'text', text: 'Adding a node.' },
        { type: 'tool_call', id: 'call_1', name: 'add_node', input: { tempId: 't1', type: 'system', label: 'X' } },
      ])
    })

    it('maps a tool_result-carrying user turn to Anthropic tool_result content blocks', async () => {
      const { calls } = installFetch({ model: 'm', content: [], stop_reason: 'end_turn' })
      await claudeAdapter.chat({
        model: 'm',
        messages: [
          { role: 'user', content: 'go' },
          { role: 'assistant', content: [{ type: 'tool_call', id: 'call_1', name: 'add_node', input: { label: 'X' } }] },
          { role: 'user', content: [{ type: 'tool_result', toolCallId: 'call_1', content: 'Created node n1.', isError: false }] },
        ],
      }, { apiKey: 'k' })
      expect(calls[0].bodyParsed.messages).toEqual([
        { role: 'user', content: 'go' },
        { role: 'assistant', content: [{ type: 'tool_use', id: 'call_1', name: 'add_node', input: { label: 'X' } }] },
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'call_1', content: 'Created node n1.', is_error: false }] },
      ])
    })
  })

  it('Gemini: uses key in query string, separates system_instruction (tools not implemented yet)', async () => {
    await expect(geminiAdapter.chat({ model: 'm', messages: SAMPLE }, {})).rejects.toThrow(/API key/)
    const { calls } = installFetch({
      modelVersion: 'gemini-1.5-flash',
      candidates: [{ content: { parts: [{ text: 'gem' }, { text: 'ini' }] } }],
    })
    const out = await geminiAdapter.chat(
      { model: 'gemini-1.5-flash', messages: SAMPLE },
      { apiKey: 'g-key' },
    )
    expect(out.content).toEqual([{ type: 'text', text: 'gemini' }])
    expect(calls[0].url).toContain('/models/gemini-1.5-flash:generateContent')
    expect(calls[0].url).toContain('key=g-key')
    expect(calls[0].bodyParsed.system_instruction.parts[0].text).toBe('sys-1')
    expect(calls[0].bodyParsed.contents).toEqual([
      { role: 'user', parts: [{ text: 'hello' }] },
    ])
  })

  it('Gemini: maps assistant role to "model"', async () => {
    const { calls } = installFetch({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] })
    await geminiAdapter.chat(
      {
        model: 'gemini-1.5-flash',
        messages: [
          { role: 'user', content: 'q1' },
          { role: 'assistant', content: 'a1' },
          { role: 'user', content: 'q2' },
        ],
      },
      { apiKey: 'g' },
    )
    expect(calls[0].bodyParsed.contents.map((c: any) => c.role)).toEqual(['user', 'model', 'user'])
  })
})
