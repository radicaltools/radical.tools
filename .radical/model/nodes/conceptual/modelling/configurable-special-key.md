---
id: "22500ddb-c41a-4f6e-96d5-a574cfd33d5e"
type: "requirement"
label: "Configurable special key"
action: "Studio shall let the user choose the special key (Alt/Option by default, or Shift, Ctrl, Cmd/Win) under Special key in the activity rail's Settings menu or in the Setup wizard, and open with it again in this browser: the one key held to connect elements, to pick several elements and to add an element from the palette without its wizard."
ears_type: "ubiquitous"
rationale: "Alt can clash with the operating system or personal habits, so the gesture key must be changeable, and a choice that is lost on a reload is no choice. Evidence: apps/studio/src/renderer/src/components/Toolbar.tsx (Special key row); packages/ui/src/studioSettings.ts (specialKey); packages/ui/src/store/diagramStore.ts (setConnectionModifier); packages/ui/src/components/Canvas.tsx; manual#relations"
---
