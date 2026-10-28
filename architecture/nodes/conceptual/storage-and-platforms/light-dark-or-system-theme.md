---
id: "7f88f753-6de7-4ff1-949d-04a3450f0825"
type: "requirement"
label: "Light, dark or system theme"
action: "Studio shall switch to that theme, System following the operating system's appearance as it changes, and open in it again in this browser, System by default."
ears_type: "event-driven"
rationale: "Inside VS Code the editor's theme wins (Follow VS Code theme). Evidence: apps/studio/src/renderer/src/theme.ts (radical-theme in localStorage, prefers-color-scheme, data-theme); apps/studio/src/renderer/src/components/Toolbar.tsx (Theme row)."
trigger: "the user chooses Light, Dark or System under Theme in the activity rail's Settings menu or in the Setup wizard, outside VS Code"
---
