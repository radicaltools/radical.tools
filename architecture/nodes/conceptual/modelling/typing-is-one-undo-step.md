---
id: "1bf60eca-11dc-4322-a2ab-051b732474f5"
type: "requirement"
label: "Typing is one undo step"
action: "Studio shall record what was typed as one undo step, not one per letter, also when a milestone is shown and its question about keeping the edits comes between the letters typed into one field; a field typed into after the question is a step of its own"
ears_type: "event-driven"
rationale: "Undo after typing a name gave it back one letter at a time (exploratory run 43, 2026-10-21); the maintainer decided typing is one step. In a milestone the question asked at the first letter split the name into two steps; the maintainer decided on 2026-10-21 (exploratory runs 65 to 69) that typing across the question is one step. Evidence: packages/ui/src/store/diagramStore.ts (beginTyping, endTyping, _pushTextEdit, _typingAtQuestion), packages/ui/src/components/RightPanel.tsx"
trigger: "the user types into a field of the properties card (a name, a description, any text or number) and leaves it"
---
