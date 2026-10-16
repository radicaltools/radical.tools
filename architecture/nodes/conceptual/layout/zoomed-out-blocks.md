---
id: "c619c194-0b2c-4792-a08b-b383277edf30"
type: "scenario"
label: "Zoomed-out blocks"
given: "six systems with four containers each, fitted on the canvas below zoom 0.27"
tests: "apps/e2e/tests/studio/canvas-detail.spec.ts › zoomed out the canvas draws blocks with names, zoomed in cards, and a block still folds"
then: "all 30 elements are blocks with their names and no card label, a container has two handles and a system with containers is a frame; the system's containers go and come back; zoomed in, no block is left and each card has its label and eight handles"
when: "the user folds and opens a system from its block, then zooms in with the wheel past 0.5"
---
