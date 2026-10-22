---
id: "27e47629-f2d6-453f-808e-b335d207add5"
type: "scenario"
label: "Explore in Viewer"
given: "the sample model in Viewer with milestone v1 shown"
tests: |
  packages/ui/tests/exploreView.test.ts › an explore view in Viewer
  apps/e2e/tests/studio/explore.spec.ts › Explore from here in Viewer follows the milestone shown and saves nothing
then: "the exploration shows the element and its neighbours in v1, then in the live model; it offers no Save as view; nothing is saved and Designer's undo history is unchanged"
when: "the user chooses Explore from here on an element, clicks its +, then shows Current (live)"
---
