---
id: "cc126186-6fbd-4fd3-b241-8f3333905236"
type: "requirement"
label: "Edit in the Warnier view"
action: "Studio shall let the user edit the diagram where it is drawn: a faint + under each brace adds an element at its end and one beside an element without children adds its first, + Process under the processes (the only control of an empty view, and none in a view of one process) adds a process, each keeping a name being typed first, also through the question how to save a milestone; on the selected card, or the one under the pointer, actions in its type line, shown without changing its size, set its repetition ((0,1), (1,n), (0,n) and the condition, as a click on its repetition mark does), move it up or down, indent, outdent and delete it; a click on a brace or its ⊕ or + changes how the children run; and the keyboard does the same (Enter adds after, or in a view of one process on the process its last step, Tab and Shift+Tab, Alt+Up and Alt+Down, F2 renames, a double-click opens the properties card, Delete; Up and Down select; Escape closes the delete prompt), each edit one undo step without a notice; in a view of one process nothing is added or moved out of that process"
ears_type: "state-driven"
precondition: "a Warnier view is shown in the Designer"
rationale: "Process logic is written like an outline, where it goes, as rows are added in the table: no bar away from the element, no card for its notation. Evidence: packages/ui/src/components/WarnierView.tsx (inline adds, the repeat popover, the brace, the card actions, the keys), packages/common/src/warnier.ts (outlinePlan, insertPlan), packages/ui/src/store/diagramStore.ts (runAsOneStep, reparentNodes quiet)"
---
