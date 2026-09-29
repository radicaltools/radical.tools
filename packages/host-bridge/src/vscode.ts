// ─── VS Code webview host ────────────────────────────────────────────────────
//
// Studio runs inside a VS Code webview and reaches the file system through
// postMessage. Both sides of that protocol live here: the extension
// (apps/vscode) handles WebviewMessage and sends ExtensionMessage, and the
// webview side is createVsCodeWebviewHost, which Studio's renderer builds when
// it finds itself in a webview.
//
// The extension passes boot data (the file being edited) through a global set
// by an inline script; vscodeBootScript renders it.

import type { FileChange, HostBridge } from './index'

/** Webview → extension. */
export type WebviewMessage =
  | { type: 'readFile'; id: string; filePath: string }
  | { type: 'writeFile'; filePath: string; content: string }

/** Extension → webview. */
export type ExtensionMessage =
  | { type: 'readFile:response'; id: string; success: true; content: string }
  | { type: 'readFile:response'; id: string; success: false; error: string }
  | ({ type: 'file:external-change' } & FileChange)

export interface VsCodeBoot {
  /** The file the webview was opened for, or null for a blank editor. */
  filePath: string | null
}

export const VSCODE_BOOT_GLOBAL = '__RADICAL_VSCODE__'

/** Inline <script> for the webview HTML that hands boot data to the renderer. */
export function vscodeBootScript(boot: VsCodeBoot): string {
  // JSON inside a <script>: escape "<" so a path cannot close the tag.
  const json = JSON.stringify(boot).replace(/</g, '\\u003c')
  return `<script>window.${VSCODE_BOOT_GLOBAL} = ${json};</script>`
}

/** The subset of the object returned by acquireVsCodeApi() that we use. */
export interface VsCodeApi {
  postMessage(message: WebviewMessage): void
}

/** Where extension messages arrive: the webview's window. */
export interface MessageTarget {
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void
}

export function createVsCodeWebviewHost(api: VsCodeApi, boot: VsCodeBoot, target: MessageTarget): HostBridge {
  const listeners: Array<(change: FileChange) => void> = []
  const pending = new Map<string, (result: { success: boolean; content?: string; error?: string }) => void>()
  let seq = 0

  target.addEventListener('message', (event) => {
    const msg = event.data as ExtensionMessage | null
    if (!msg || typeof msg !== 'object' || !('type' in msg)) return
    if (msg.type === 'file:external-change') {
      for (const listener of listeners) listener({ filePath: msg.filePath, content: msg.content })
    } else if (msg.type === 'readFile:response') {
      const resolve = pending.get(msg.id)
      if (!resolve) return
      pending.delete(msg.id)
      resolve(msg.success ? { success: true, content: msg.content } : { success: false, error: msg.error || 'readFile failed' })
    }
  })

  return {
    kind: 'vscode',
    getWatchedPath: () => Promise.resolve(boot.filePath),
    onFileChanged: (listener) => { listeners.push(listener) },
    readFile: (filePath) => new Promise((resolve) => {
      const id = String(++seq)
      pending.set(id, resolve)
      api.postMessage({ type: 'readFile', id, filePath })
    }),
    // The extension applies the write asynchronously and does not report back.
    writeFile: (filePath, content) => {
      api.postMessage({ type: 'writeFile', filePath, content })
      return Promise.resolve({ success: true })
    },
  }
}
