---
id: "4b62e8bd-8ce0-4edf-a0ce-c862ef2e2367"
type: "requirement"
label: "The Inspector's links show the element"
action: "Studio shall show the element in the perspective open (Presenter going to Viewer), on the active view when it shows it, else on the view a Quick Search pick opens (a canvas first, the smallest), selected with its properties card and in sight, its containers open on a canvas, its page on a wiki, the Inspector giving the view back; the card's Views list offers the other views that show it; an element only the live model has, while a milestone is shown, is said to be missing from it"
ears_type: "event-driven"
rationale: "An element usually sits on several views; the one Quick Search would pick is a good first guess, and the card's Views list has the others. The Inspector is a place of the rail, so the view it gives back is the perspective's own (Inspector is a place of the rail). Evidence: apps/studio/src/renderer/src/navigation.ts (showElement, pickViewFor), apps/studio/src/renderer/src/components/Inspector.tsx (show)"
trigger: "the user follows a link to an element in the Inspector (a chip, Open, Show on the verification path)"
---
