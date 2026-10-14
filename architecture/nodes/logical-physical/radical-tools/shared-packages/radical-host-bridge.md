---
id: "72ab7d8a-0466-44d3-a97b-8a5675f2dbed"
type: "component"
label: "@radical/host-bridge"
technology: "TypeScript"
---

packages/host-bridge: the typed contract between Studio's renderer and its host. HostCapabilities (every method optional, failures resolve with success: false): file and folder dialogs, file and md-folder read/write with conflicts, folder watching, the --file watched path, and the .radical/ selection, Forge-run and check files. ./vscode holds the webview ↔ extension postMessage protocol, the webview-side host and the boot script; the Electron side is apps/studio/src/preload; the browser host has no methods.
