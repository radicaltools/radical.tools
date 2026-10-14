---
id: "8eb99c23-dc21-4c58-8ad2-e9bd66f877ec"
type: "requirement"
label: "Links open in browser"
action: "The desktop app shall open the link in the system's default browser and not in a window of its own."
ears_type: "event-driven"
rationale: "Evidence: apps/studio/src/main/index.ts (setWindowOpenHandler → shell.openExternal, action deny)"
trigger: "a page in the desktop app opens a link in a new window"
---
