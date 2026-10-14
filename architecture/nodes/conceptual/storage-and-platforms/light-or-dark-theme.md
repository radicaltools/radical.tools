---
id: "7f88f753-6de7-4ff1-949d-04a3450f0825"
type: "requirement"
label: "Light or dark theme"
action: "Studio shall switch to that theme and open in it again in this browser, dark by default."
ears_type: "event-driven"
rationale: "Inside VS Code the editor's theme wins (Follow VS Code theme). Evidence: apps/studio/src/renderer/src/components/Toolbar.tsx (theme state, radical-theme in localStorage, data-theme)."
trigger: "the user chooses Light mode or Dark mode in the Radical menu outside VS Code"
---
