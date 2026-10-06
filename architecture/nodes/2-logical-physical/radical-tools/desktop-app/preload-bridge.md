---
id: "88f411d4-5ba5-4620-a32b-933cc622a5a0"
type: "component"
label: "Preload bridge"
technology: "Electron contextBridge"
---

apps/studio/src/preload/index.ts. Exposes window.electronAPI, which satisfies the full HostCapabilities contract and maps one-to-one to the IPC channels.
