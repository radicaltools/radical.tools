---
id: "4b62e8bd-8ce0-4edf-a0ce-c862ef2e2367"
type: "requirement"
label: "Choose the view to show it on"
action: "Studio shall list the canvas views that show the element, the smallest first with how many elements each shows, or All elements when none does, and open the one picked in Designer with the element selected, its containers open and the camera on it"
ears_type: "event-driven"
rationale: "An element usually sits on several views; the smallest is a good first guess but not always the one wanted. Evidence: apps/studio/src/renderer/src/navigation.ts (canvasViewsFor, revealOnCanvas), apps/studio/src/renderer/src/components/inspector/shared.tsx (ShowOnCanvas)"
trigger: "the user picks Show on canvas for an element in the Inspector (its panel, or its card in the Changes tab)"
---
