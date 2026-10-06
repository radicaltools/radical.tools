---
id: "d72f71fa-a388-4a7e-b5b0-1c681468857e"
type: "requirement"
label: "Tree layout mode"
action: "Studio shall run a hierarchical top-down ELK layered layout at root and nested levels instead of the Smart Layout ensemble, and label the button Tree Layout."
ears_type: "optional"
feature: "the active view's layout mode is set to Tree"
rationale: "Some views read as hierarchies, and a tree arrangement shows them better than the general ensemble. Evidence: packages/ui/src/store/diagramStore.ts:2424, packages/ui/src/store/diagramStore.ts:2811-2873; packages/layout/src/elkLayout.ts:215-268; packages/ui/src/components/SmartLayoutButton.tsx:131-160; packages/ui/src/components/RightPanel.tsx:915-916; manual#layout"
---
