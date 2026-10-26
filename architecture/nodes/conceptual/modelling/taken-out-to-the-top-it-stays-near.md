---
id: "ebe1a759-8a7c-4cfc-9fb4-5289a9a251c6"
type: "scenario"
label: "Taken out to the top, it stays near"
given: "an element inside a container, with places on several canvases"
tests: |
  packages/ui/tests/reparentOnEveryCanvas.test.ts › Move to… the root › keeps it near where it stood, clear of what it was taken out of, on every canvas
  packages/layout/tests/geometry.test.ts › settleMovedNodes › puts one taken out to the top in the free place nearest where it stood
then: "on every canvas it lies in the free place nearest where it stood, clear of the container it left"
when: "it is moved to the top of the model"
---
