---
id: "60fb9531-8072-4f6d-804d-4a00a373a6ba"
type: "container"
label: "Desktop app"
technology: "Electron 29"
---

Studio's renderer in an Electron shell (apps/studio, electron-vite) with native file dialogs. .github/workflows/release.yml builds macOS, Windows and Linux installers (npm run dist) on a v* tag and drafts a GitHub Release; no version has been released yet.
