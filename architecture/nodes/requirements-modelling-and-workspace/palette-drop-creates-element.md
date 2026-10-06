---
id: "e6f624c1-8d05-4204-b2d0-143ce4a658c1"
type: "requirement"
label: "Palette drop creates element"
action: "Studio shall create an element of that type centred at the drop point, as a child of the deepest container under the pointer when that container is an allowed parent."
ears_type: "event-driven"
rationale: "Dragging from the palette is the primary way to add architecture elements and to nest them. Evidence: packages/ui/src/components/Canvas.tsx:668-758; packages/ui/src/components/RightPanel.tsx:67-79,1160-1215; manual#elements"
trigger: "the user drops a palette element type on the canvas in the Designer perspective"
---
