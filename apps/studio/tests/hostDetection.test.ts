/**
 * host() picks the Electron preload API, the VS Code webview bridge or the
 * plain browser host. The VS Code case runs last: that host is cached for
 * the module's lifetime because acquireVsCodeApi() may only be called once.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { host } from '../src/renderer/src/platform/host'

const g = globalThis as Record<string, unknown>

afterEach(() => {
  delete g.electronAPI
})

describe('host()', () => {
  it('is the capability-less web host in a plain browser', () => {
    expect(host().kind).toBe('web')
    expect(host().readFile).toBeUndefined()
  })

  it('wraps the Electron preload API, read on every call', async () => {
    const readFile = vi.fn(async () => ({ success: true, content: '{}' }))
    g.electronAPI = { readFile }
    const h = host()
    expect(h.kind).toBe('electron')
    expect(await h.readFile!('/m.radical')).toEqual({ success: true, content: '{}' })
    expect(readFile).toHaveBeenCalledWith('/m.radical')
    delete g.electronAPI
    expect(host().kind).toBe('web')
  })

  it('builds the VS Code webview host once, from the injected boot data', async () => {
    const postMessage = vi.fn()
    const acquireVsCodeApi = vi.fn(() => ({ postMessage }))
    g.acquireVsCodeApi = acquireVsCodeApi
    g.__RADICAL_VSCODE__ = { filePath: '/work/model.radical' }
    const addEventListener = vi.fn() // the webview's window; node has none
    g.addEventListener = addEventListener
    try {
      const h = host()
      expect(h.kind).toBe('vscode')
      expect(addEventListener).toHaveBeenCalledWith('message', expect.any(Function))
      expect(host()).toBe(h)
      expect(acquireVsCodeApi).toHaveBeenCalledTimes(1)
      expect(await h.getWatchedPath!()).toBe('/work/model.radical')
      await h.writeFile!('/work/model.radical', '{}')
      expect(postMessage).toHaveBeenCalledWith({ type: 'writeFile', filePath: '/work/model.radical', content: '{}' })
    } finally {
      delete g.acquireVsCodeApi
      delete g.__RADICAL_VSCODE__
      delete g.addEventListener
    }
  })
})
