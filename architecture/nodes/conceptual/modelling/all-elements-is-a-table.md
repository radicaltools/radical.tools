---
id: "c92e6c44-7fb6-4d32-820e-0b974f895405"
type: "requirement"
label: "All elements is a table"
action: "Studio shall always list, first among the views and not deletable, All elements: the whole model as a table by containment, with the + rows to add and the properties card on a click; open a model on it; and make + New view's blank view a table of the whole model too, a canvas of the whole model being a structure view that lists no elements."
ears_type: "ubiquitous"
rationale: "There must always be a complete reading of the model to fall back to, and new elements an agent adds must show somewhere at once. A canvas of every element was rarely readable and was a layout to keep up; a table lists everything without arranging, and a user who wants the whole model drawn makes a structure view of it. Links to the former canvas (#/…/v/canvas) open All elements. Evidence: apps/studio/src/renderer/src/App.tsx (activeViewKind), apps/studio/src/renderer/src/route.ts (ALL_ELEMENTS), packages/ui/src/components/RightPanel.tsx (ViewList, New view), packages/ui/src/store/diagramStore.ts (addView, suggestSmartLayoutIfUnarranged), packages/layout/src/viewInput.ts; apps/studio/tests/route.test.ts; manual#views"
---
