---
id: "22500ddb-c41a-4f6e-96d5-a574cfd33d5e"
type: "requirement"
label: "Configurable connect key"
action: "Studio shall let the user choose the connect key (Alt/Option by default, or Shift, Ctrl, Cmd/Win) under Connect key in the Radical menu."
ears_type: "ubiquitous"
rationale: "Alt can clash with the operating system or personal habits, so the gesture key must be changeable. Evidence: apps/studio/src/renderer/src/components/Toolbar.tsx:416-430; packages/ui/src/store/diagramStore.ts:1349,3093-3095; packages/ui/src/components/Canvas.tsx:160-190,570-576; manual#relations"
---
