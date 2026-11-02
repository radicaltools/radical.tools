---
id: "683429ce-65c5-416f-9490-eea5e0c6098f"
type: "scenario"
label: "Slides keep what was captured"
given: "a presentation whose slides show a view with a container folded, a hierarchy drilled to a level, a view linked with Link view, and a view since deleted"
metrics: |
  test(packages/ui/tests/presenterSlides.test.ts › a slide captured with a container folded or open in its view (item 171)) passed
  test(packages/ui/tests/presenterSlides.test.ts › Capture again on a hierarchy slide (item 197)) passed
  test(packages/ui/tests/presenterSlides.test.ts › a hierarchy slide with no drill level of its own) passed
  test(packages/ui/tests/presenterSlides.test.ts › Link view (item 198)) passed
  test(packages/ui/tests/presenterSlides.test.ts › the slide list replaced from outside (item 200)) passed
  test(packages/ui/tests/presenterSlides.test.ts › a slide of a deleted view) passed
  test(apps/e2e/tests/studio/presentation.spec.ts › a click in the middle of another slide's card shows that slide, it does not capture it) passed
  test(packages/ui/tests/presenterSlides.test.ts › draws what an explore view gained since where the view draws it, on none of the elements captured) passed
  test(packages/ui/tests/presenterSlides.test.ts › draws what an explore view gained since beside the elements captured when the view has it where one of them was) passed
  test(packages/ui/tests/presenterSlides.test.ts › places an element a structure view gained since as the view does, on none of the elements captured) passed
then: "the slide shows the container folded as captured; Capture takes the drill level shown now, and a hierarchy slide without one shows the top; the linked view is drawn at its own places; the slide of the deleted view shows All elements; the slide shown stays current after the outside change; the click shows that slide and does not capture it"
when: "the container is opened on the view later, Capture is pressed on the hierarchy slide, the slides are played, the slide list is replaced from outside, and the user clicks in the middle of another slide's card"
---
