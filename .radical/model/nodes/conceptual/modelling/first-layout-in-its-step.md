---
id: "301c6b07-b811-4aa8-a751-3ab1d4559dbe"
type: "requirement"
label: "First layout in its step"
action: "Studio shall make that first layout part of the undo step that made the view, so that one Undo takes back New view with its layout, take no undo step for opening a view that already exists (an Undo after it keeps its layout), never replace that layout with All elements' places saved before it lands, and open a view saved without positions as one not laid out yet"
ears_type: "event-driven"
rationale: "The maintainer decided on 2026-10-21 (D16, exploratory runs 45 to 64) that the first layout of a new view belongs to the step that created it: as a step of its own, Undo after New view left the view behind laid out, and an Undo after opening a view took its layout away. Evidence: packages/ui/src/store/diagramStore.ts (arrangeOnFirstOpen), packages/ui/tests/firstCanvasPositions.test.ts"
trigger: "Studio lays out a view for the first time: a new view of a viewpoint, or a view opened in Designer that has no positions of its own"
---
