---
id: "01922289-6b7d-4fce-8377-0abefb6d471a"
type: "requirement"
label: "Branch changes on the canvas"
action: "Studio shall mark on the canvas the elements and relations added and changed since the base, draw the removed elements as dashed ghosts, and show over every view a chip with the base commit, its age and the numbers of elements added, changed and removed, all recomputed as the model is edited, until it is turned off or a milestone is shown"
ears_type: "state-driven"
precondition: "the open model folder holds .radical/base.json and Changes on branch is on"
rationale: "The product owner sees what they hand over to the agent, and the agent's work as it lands, with the same marks as a milestone's diff; the milestone's own diff takes the overlay while one is shown. Evidence: apps/studio/src/renderer/src/persistence/branchChanges.ts (poll, recompute, showOverlay), apps/studio/src/renderer/src/components/BranchChanges.tsx (BranchChangesButton, BranchChip), packages/ui/src/store/diagramStore.ts (branch, showBranchChanges), packages/common/src/branchChanges.ts (branchChanges), apps/studio/src/renderer/src/persistence/descriptions.ts"
---
