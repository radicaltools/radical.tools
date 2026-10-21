---
id: "1bf60eca-11dc-4322-a2ab-051b732474f5"
type: "requirement"
label: "Typing is one undo step"
action: "Studio shall record what was typed as one undo step, not one per letter"
ears_type: "event-driven"
rationale: "Undo after typing a name gave it back one letter at a time (exploratory run 43, 2026-10-21); the maintainer decided typing is one step. Evidence: packages/ui/src/store/diagramStore.ts (beginTyping, endTyping, _pushTextEdit), packages/ui/src/components/RightPanel.tsx"
trigger: "the user types into a field of the properties card (a name, a description, any text or number) and leaves it"
---
