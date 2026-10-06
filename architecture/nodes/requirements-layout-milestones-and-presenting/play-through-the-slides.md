---
id: "6440e750-eed6-438b-9e41-e62f58a43050"
type: "scenario"
label: "Play through the slides"
gherkin: |
  And the URL follows each slide (/p/pres-main/play/1/sl/0, /sl/1) and drops the playback part after Escape
  # Covered by: apps/e2e/tests/studio/presentation.spec.ts › play through the slides
given: "the bookstore fixture is open in the Presenter perspective with presentation Main of two slides (Context, Containers)"
then: "slide 1 shows three elements with 1 / 2, slide 2 shows six elements with 2 / 2, Left arrow returns to slide 1, and Escape ends the presentation with the Present button visible again"
when: "the user clicks Present, then presses Right arrow, Left arrow and Escape"
---
