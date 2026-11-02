---
id: "52e76363-475f-4670-88df-ea1768423af2"
type: "requirement"
label: "Warnier view"
action: "Studio shall draw what the view shows as a Warnier–Orr diagram in its standard notation, each element with the elements under it (its chain, or with one level or none their containment) to its right in a brace, siblings top to bottom by their order and then as the view orders them, a step's repetition ((0,1), (1,n), (0,n)) and condition under its name, ⊕ between the children of a choice with (0,1) under each that does not repeat otherwise, + between those of a concurrent one, a state machine's states with ⊕ for a compound state's children and + for a parallel state's regions, and open an element's properties card when it is clicked"
ears_type: "state-driven"
precondition: "a view of kind Warnier is shown"
rationale: "Any hierarchy reads as an outline in braces, left to right, without a layout to arrange; process logic shows what repeats and what is an alternative. Evidence: packages/common/src/warnier.ts (warnierTree), packages/ui/src/components/WarnierView.tsx, apps/studio/src/renderer/src/App.tsx"
---
