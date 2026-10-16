---
id: "a29749fa-95ab-4cc2-8677-a4d6dcb8aa56"
type: "requirement"
label: "Changed fields on the card"
action: "the properties card shall show a Changes on branch section that marks the element as changed and lists each changed field with the words removed from and added to its value at the base (a move as the old and the new place), or says that the element is new on the branch"
ears_type: "state-driven"
precondition: "the selected element changed since the base, and Changes on branch is on or the card was opened from the Inspector's Changes tab"
rationale: "A changed requirement often differs in a few words of a long text; marking only those words shows what to implement. A description an md folder has not loaded yet counts as unchanged. Evidence: packages/ui/src/components/RightPanel.tsx (BranchFieldChanges, WordChanges), packages/common/src/branchChanges.ts (wordDiff), packages/common/src/modelChanges.ts (modelFieldChanges)"
---
