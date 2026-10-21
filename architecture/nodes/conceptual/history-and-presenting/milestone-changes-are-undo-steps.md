---
id: "ba5fdafe-5f7e-4fe0-8f4c-19a5881ea99a"
type: "requirement"
label: "Milestone changes are undo steps"
action: "Studio shall record it as one undo step, so that Undo of an earlier edit never takes a milestone away; show the live model on the slides that showed a deleted milestone until the delete is undone; keep a space typed into a new milestone's name as part of the name; and leave a milestone with nothing unsaved once every edit made in it is undone, Redo making it unsaved again"
ears_type: "event-driven"
rationale: "Exploratory runs 45 to 64 (2026-10-21, items 228 and 229) found that deleting a milestone could not be undone and left its slides pointing at nothing, that Undo of an earlier edit took a milestone just made away, and that a space typed into a new milestone's name was swallowed. Evidence: packages/ui/src/store/diagramStore.ts (createSnapshot, renameSnapshot, removeSnapshot), packages/ui/src/components/RightPanel.tsx"
trigger: "the user makes, renames or deletes a milestone in Designer"
---
