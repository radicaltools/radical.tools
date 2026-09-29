import { describe, it, expect } from 'vitest'
import { createVsCodeWebviewHost, vscodeBootScript, type ExtensionMessage, type WebviewMessage } from '../src/vscode'

function harness(filePath: string | null = '/work/model.radical') {
  const sent: WebviewMessage[] = []
  let deliver: (event: { data: unknown }) => void = () => {}
  const host = createVsCodeWebviewHost(
    { postMessage: (m) => { sent.push(m) } },
    { filePath },
    { addEventListener: (_type, listener) => { deliver = listener } },
  )
  const reply = (msg: ExtensionMessage): void => deliver({ data: msg })
  return { host, sent, reply }
}

describe('VS Code webview host', () => {
  it('reports its kind and the file it was opened for', async () => {
    const { host } = harness()
    expect(host.kind).toBe('vscode')
    expect(await host.getWatchedPath!()).toBe('/work/model.radical')
  })

  it('reads a file through a request / response pair', async () => {
    const { host, sent, reply } = harness()
    const pending = host.readFile!('/work/model.radical')
    expect(sent).toEqual([{ type: 'readFile', id: '1', filePath: '/work/model.radical' }])
    reply({ type: 'readFile:response', id: '1', success: true, content: '{}' })
    expect(await pending).toEqual({ success: true, content: '{}' })
  })

  it('resolves a failed read with success: false instead of throwing', async () => {
    const { host, reply } = harness()
    const pending = host.readFile!('/missing')
    reply({ type: 'readFile:response', id: '1', success: false, error: 'ENOENT' })
    expect(await pending).toEqual({ success: false, error: 'ENOENT' })
  })

  it('ignores responses for unknown requests and unrelated messages', async () => {
    const { host, reply } = harness()
    const pending = host.readFile!('/a')
    reply({ type: 'readFile:response', id: '99', success: true, content: 'wrong' })
    ;(reply as (m: unknown) => void)({ unrelated: true })
    reply({ type: 'readFile:response', id: '1', success: true, content: 'right' })
    expect(await pending).toEqual({ success: true, content: 'right' })
  })

  it('posts writes and resolves immediately', async () => {
    const { host, sent } = harness()
    expect(await host.writeFile!('/work/model.radical', '{"nodes":[]}')).toEqual({ success: true })
    expect(sent).toEqual([{ type: 'writeFile', filePath: '/work/model.radical', content: '{"nodes":[]}' }])
  })

  it('forwards external changes to every listener', () => {
    const { host, reply } = harness()
    const seen: string[] = []
    host.onFileChanged!((c) => seen.push(`a:${c.content}`))
    host.onFileChanged!((c) => seen.push(`b:${c.content}`))
    reply({ type: 'file:external-change', filePath: '/work/model.radical', content: 'v2' })
    expect(seen).toEqual(['a:v2', 'b:v2'])
  })
})

describe('vscodeBootScript', () => {
  it('sets the boot global and escapes "<" so a path cannot close the script tag', () => {
    const html = vscodeBootScript({ filePath: '/x/</script><b>.radical' })
    expect(html).toBe('<script>window.__RADICAL_VSCODE__ = {"filePath":"/x/\\u003c/script>\\u003cb>.radical"};</script>')
  })
})
