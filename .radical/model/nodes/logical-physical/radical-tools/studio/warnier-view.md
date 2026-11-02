---
id: "524d63c4-9a7b-4a79-b14f-11c2c2475a1e"
type: "component"
label: "Warnier view"
technology: "React (@radical/ui)"
---

packages/ui/src/components/WarnierView.tsx. Draws a view of kind warnier as a Warnier–Orr diagram from @radical/common/warnier (warnierTree): columns left to right, each element with a brace around what is under it, a step's repetition and condition under its name, ⊕ between alternatives and + between concurrent parts. A click selects the element and opens its properties card. In the Designer, over a containment tree, it is edited where it is drawn: a faint + under each brace, + beside an element with nothing in it, + Process under the processes; the selected card, or the one under the pointer, has its actions in its type line (repetition, up, down, outdent, indent, delete), shown without changing its size; the repetition popover sets repeat and condition; a click on a brace or its sign changes how the children run. The keyboard does the same (Enter adds after, Tab and Shift+Tab, Alt+Up and Alt+Down, F2 or a double-click, Delete, Up and Down). Controls keep the focus, so a + pressed while a name is typed keeps the name first; each edit is one undo step with the siblings' order renumbered (outlinePlan, insertPlan); a chain's tree is renamed only.
