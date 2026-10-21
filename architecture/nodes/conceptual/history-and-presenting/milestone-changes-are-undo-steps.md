---
id: "ba5fdafe-5f7e-4fe0-8f4c-19a5881ea99a"
type: "requirement"
label: "Milestone changes are undo steps"
action: "Studio shall record it as one undo step, so that Undo of an earlier edit never takes a milestone away; keep it, and a view renamed or a type added while a milestone was shown, when Undo after a look at a milestone takes back a step made on the live model, which takes back only that step; show the live model on the slides that showed a deleted milestone until the delete is undone; keep a space typed into a new milestone's name as part of the name; and leave a milestone with nothing unsaved once every edit made in it is undone, Redo making it unsaved again"
ears_type: "event-driven"
rationale: "Exploratory runs 45 to 64 (2026-10-21, items 228 and 229) found that deleting a milestone could not be undone and left its slides pointing at nothing, that Undo of an earlier edit took a milestone just made away, and that a space typed into a new milestone's name was swallowed. Exploratory runs 65 to 69 (2026-10-21, item 231) found that Undo of a live step after a look at a milestone took away a milestone made there by Save as new, a milestone or view renamed and a type added while it was shown. Evidence: packages/ui/src/store/diagramStore.ts (createSnapshot, renameSnapshot, removeSnapshot, _historyEntersMilestone, _liveAtVisit, _liveHistoryKeepsVisit), packages/ui/src/components/RightPanel.tsx"
trigger: "the user makes (on the live model or by Save as new), renames or deletes a milestone in Designer"
---
