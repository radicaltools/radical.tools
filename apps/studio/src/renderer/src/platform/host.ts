// ─── Host detection ──────────────────────────────────────────────────────────
//
// The one place that knows how Studio finds its host. Everything else calls
// host() and checks for the capability it needs (see @radical/host-bridge).
//
//   Electron  the preload script exposes `window.electronAPI`
//   VS Code   the webview provides acquireVsCodeApi(); apps/vscode injects the
//             boot data (the file being edited)
//   browser   neither: WEB_HOST, no native capabilities
//
// Resolved on every call rather than once at import, so tests can install a
// fake Electron API after the stores have loaded. The VS Code host is cached:
// acquireVsCodeApi() may only be called once per webview.

import { WEB_HOST, type HostBridge, type HostCapabilities } from '@radical/host-bridge'
import {
  VSCODE_BOOT_GLOBAL,
  createVsCodeWebviewHost,
  type MessageTarget,
  type VsCodeApi,
  type VsCodeBoot,
} from '@radical/host-bridge/vscode'

interface HostGlobals {
  electronAPI?: HostCapabilities
  acquireVsCodeApi?: () => VsCodeApi
  [VSCODE_BOOT_GLOBAL]?: VsCodeBoot
}

let vscodeHost: HostBridge | undefined

export function host(): HostBridge {
  const g = globalThis as unknown as HostGlobals
  if (g.electronAPI) return { ...g.electronAPI, kind: 'electron' }
  if (vscodeHost) return vscodeHost
  if (typeof g.acquireVsCodeApi === 'function') {
    const boot = g[VSCODE_BOOT_GLOBAL] ?? { filePath: null }
    vscodeHost = createVsCodeWebviewHost(g.acquireVsCodeApi(), boot, globalThis as unknown as MessageTarget)
    return vscodeHost
  }
  return WEB_HOST
}
