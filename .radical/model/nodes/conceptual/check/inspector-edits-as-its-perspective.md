---
id: "d36cccb3-3df7-4866-bfd0-d94733b24f61"
type: "requirement"
label: "Inspector edits as its perspective"
action: "offer no edit of its own: each one-step fix shall read '… in Designer' and make the edit in Designer, which Studio then shows (Offered edits are Designer's); in Designer the fix shall be made at once; while a milestone is shown in the perspective or parked in Designer, the fixes shall be greyed out, saying that they edit the live model"
ears_type: "state-driven"
precondition: "the Inspector is open in Viewer or Presenter"
rationale: "What the Inspector may do is what the perspective it is open in may do; a read-only switch of its own would say the same twice (Inspector is a place of the rail). Evidence: apps/studio/src/renderer/src/components/inspector/fixes.ts (useFixOffer, startFix), packages/ui/src/store/designerEdit.ts (liveModelEditRefused, editAsDesigner), OverviewTab.tsx"
---
