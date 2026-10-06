---
id: "21970ab4-f4b1-4215-9f92-6e56d9648013"
type: "component"
label: "Host adapter"
technology: "@radical/host-bridge"
---

renderer/src/platform/host.ts. Picks the Electron, VS Code or web host at start-up; the web host has no methods, so the browser uses its own storage APIs.
