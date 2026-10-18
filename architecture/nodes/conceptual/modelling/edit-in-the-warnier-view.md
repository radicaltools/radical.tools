---
id: "cc126186-6fbd-4fd3-b241-8f3333905236"
type: "requirement"
label: "Edit in the Warnier view"
action: "Studio shall let the user add an element after it or inside it, indent it under the element before it, outdent it after its parent, move it up or down among its siblings, rename it in place, set a step's repetition and how its children run, and delete it, each as one undo step, from a bar over the diagram and from the keyboard (Enter, Tab, Shift+Tab, Alt+Up and Alt+Down, F2 or a double-click, Delete; Up and Down select the element before or after)"
ears_type: "state-driven"
precondition: "a Warnier view is shown in the Designer and an element in it is selected"
rationale: "Process logic is written like an outline: a step after a step, one level in, one level out, without a canvas or the card. Evidence: packages/ui/src/components/WarnierView.tsx (the bar and the keys), packages/common/src/warnier.ts (outlinePlan, insertPlan), packages/ui/src/store/diagramStore.ts (asOneStep)"
---
