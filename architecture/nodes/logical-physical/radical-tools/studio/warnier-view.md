---
id: "524d63c4-9a7b-4a79-b14f-11c2c2475a1e"
type: "component"
label: "Warnier view"
technology: "React (@radical/ui)"
---

packages/ui/src/components/WarnierView.tsx. Draws a view of kind warnier as a Warnier–Orr diagram from @radical/common/warnier (warnierTree): columns left to right, each element with a brace around what is under it, a step's repetition and condition under its name, ⊕ between alternatives and + beside concurrent parts. A click selects the element and opens its properties card. In the Designer, over a containment tree, a bar over the diagram and the keyboard edit it like an outline (Enter adds after, Tab and Shift+Tab indent and outdent, Alt+Up and Alt+Down move, F2 or a double-click renames, Delete asks to delete, Up and Down select; Add inside, Repeat and Children run on the bar), each edit one undo step with the siblings' order renumbered (outlinePlan, insertPlan); a chain's tree is renamed only.
