---
id: "26ed4e50-dee8-4b39-ad02-e08eb7aa248a"
type: "scenario"
label: "Selection dims the rest"
given: "the sample model's All elements canvas"
tests: |
  apps/e2e/tests/studio/selection-focus.spec.ts › a selected node brings its relations forward and dims the rest
  apps/e2e/tests/studio/selection-focus.spec.ts › a selected relation brings forward itself and its two ends
  apps/e2e/tests/studio/selection-focus.spec.ts › the camera frames a selection and goes back when it is cleared
  packages/ui/tests/canvasFocus.test.ts › nothing selected: no focus
  packages/ui/tests/canvasFocus.test.ts › a selected node focuses its relations, their other ends and the containers they sit in
  packages/ui/tests/canvasFocus.test.ts › a selected container focuses the relations of everything inside it
  packages/ui/tests/canvasFocus.test.ts › several selected nodes focus all their relations
  packages/ui/tests/canvasFocus.test.ts › a selected relation focuses itself and its two ends
  packages/ui/tests/canvasFocus.test.ts › a selection that is not on this canvas focuses nothing
  packages/ui/tests/canvasFocus.test.ts › elements the view hides take no part
  apps/e2e/tests/studio/selection-focus.spec.ts › a click on the empty canvas during the framing flight brings back the camera from before
then: "Accounts Service, its relations and their other ends stay as they are and every other element and relation is dimmed; the click on the empty canvas undims everything; the selected relation alone stays with its two ends; the camera zooms onto Accounts Service and its neighbours to at most 120 % and goes back to the camera from before, but stays where the user zoomed; a click during the flight brings back the camera from before too"
when: "the user selects Accounts Service, clicks the empty canvas, then selects one of its relations; and, far zoomed out, clicks Accounts Service, clicks the empty canvas, clicks it again and zooms in before clicking the empty canvas; and clicks the empty canvas while a framing is still on its way"
---
