---
id: "bdbec29b-c4db-46df-9c56-8190594b90a2"
type: "requirement"
label: "Per-view tree layout mode"
action: "Studio shall run the top-down tree layout instead of the Smart Layout ensemble when Smart Layout is invoked on that view."
ears_type: "optional"
feature: "a Structure view's layout mode is set to Hierarchical nested tree"
rationale: "Deep containment hierarchies read better as trees than as force or layered graphs. Evidence: packages/ui/src/components/RightPanel.tsx:908-922; packages/common/src/c4.ts:100-109; manual#view-structure"
---
