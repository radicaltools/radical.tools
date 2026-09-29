# @radical/host-bridge

The contract between Studio's renderer and the host it runs in.

| Host | Implementation |
|---|---|
| Electron desktop app | `apps/studio/src/preload`: one IPC channel per capability |
| VS Code webview | `createVsCodeWebviewHost` in `./vscode`, backed by `apps/vscode` over postMessage |
| Browser | `WEB_HOST`: no native capabilities |

- `@radical/host-bridge`: `HostBridge`, `HostCapabilities`, result types. Every
  capability is optional; callers check for a method before using it. A failed
  operation resolves with `success: false` and never throws.
- `@radical/host-bridge/vscode`: the webview ↔ extension message protocol
  (`WebviewMessage`, `ExtensionMessage`), the webview-side host, and
  `vscodeBootScript`, which the extension uses to pass the edited file to the page.

Studio reaches its host only through `host()` in
`apps/studio/src/renderer/src/platform/host.ts`.

No DOM or Node dependencies, so both the renderer and the extension can import it.
