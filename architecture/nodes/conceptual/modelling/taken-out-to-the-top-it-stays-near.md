---
id: "ebe1a759-8a7c-4cfc-9fb4-5289a9a251c6"
type: "scenario"
label: "Taken out to the top, it stays near"
given: "an element inside a container, with places on several canvases; and views that draw its container only as an invisible frame"
tests: |
  packages/ui/tests/reparentOnEveryCanvas.test.ts › Move to… the root › keeps it near where it stood, clear of what it was taken out of, on every canvas
  packages/layout/tests/geometry.test.ts › settleMovedNodes › puts one taken out to the top in the free place nearest where it stood
  packages/ui/tests/reparentOnEveryCanvas.test.ts › Move to… the root, on views that do not draw what it left › keeps its place there and on the other such view (taken out on systems)
  packages/ui/tests/reparentOnEveryCanvas.test.ts › Move to… the root, on views that do not draw what it left › keeps its place there and on the other such view (taken out on alone)
  packages/ui/tests/reparentOnEveryCanvas.test.ts › Move to… the root, on views that do not draw what it left › goes clear of what the frame holds where it lies on it
then: "on every canvas it lies in the free place nearest where it stood, clear of the container it left; on a view that draws the container only as an invisible frame it keeps its place, there and on the other such view, and goes clear only of what the frame holds where it lies on it"
when: "it is moved to the top of the model"
---
