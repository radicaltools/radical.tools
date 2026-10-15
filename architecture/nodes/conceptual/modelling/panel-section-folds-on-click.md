---
id: "d5067236-a05e-4d95-a09c-2d5e0a6b7ce2"
type: "scenario"
label: "Panel section folds on click"
given: "the bookstore System Context view in Designer, with Views open on the left and Nodes on the right"
tests: "apps/e2e/tests/studio/editing.spec.ts › a click on an open panel section folds it; another section opens alone"
then: "Views folds, opens again, and folds when Milestones opens; on the right Nodes folds leaving no section open, and Relations opens alone"
when: "the user clicks Views twice, then Milestones; and Nodes, then Relations"
---
