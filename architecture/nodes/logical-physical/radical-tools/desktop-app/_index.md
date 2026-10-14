---
id: "60fb9531-8072-4f6d-804d-4a00a373a6ba"
type: "container"
label: "Desktop app"
technology: "Electron 29"
---

Studio's renderer in an Electron 29 shell (apps/studio, electron-vite; product radical.studio, appId com.radical.diagram): native file and folder dialogs, Markdown folders read and written on disk through @radical/node-files without browser permission prompts, the --file/RADICAL_FILE watcher, and the .radical/ files shared with the MCP server and radical check (canvas selection, an agent's Forge run, test results). .github/workflows/release.yml builds a macOS dmg (arm64, x64), a Windows NSIS installer and a Linux AppImage (x64) with npm run dist on a v* tag and drafts a GitHub Release; no version has been released yet.
