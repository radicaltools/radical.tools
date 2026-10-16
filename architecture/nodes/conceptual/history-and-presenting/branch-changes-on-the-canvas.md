---
id: "01922289-6b7d-4fce-8377-0abefb6d471a"
type: "requirement"
label: "Branch changes on the canvas"
action: "Studio shall mark on the canvas the elements and relations added and changed since the base and draw the removed elements as dashed ghosts, recomputed as the model is edited, until it is turned off or a milestone is shown; the toolbar button counts the changed elements"
ears_type: "state-driven"
precondition: "the open model folder holds .radical/base.json and Changes on branch is on"
rationale: "The product owner sees what they hand over to the agent, and the agent's work as it lands, with the same marks as a milestone's diff; the milestone's own diff takes the overlay while one is shown. The base, its age and the list of changes are in the Inspector, not over the canvas. Evidence: apps/studio/src/renderer/src/persistence/branchChanges.ts (poll, recompute, showOverlay), apps/studio/src/renderer/src/components/BranchChanges.tsx (BranchChangesButton), packages/ui/src/store/diagramStore.ts (branch, showBranchChanges), packages/common/src/branchChanges.ts (branchChanges), apps/studio/src/renderer/src/persistence/descriptions.ts"
---
