---
id: "3052c400-750a-4f28-af08-ee8924c3fa32"
type: "scenario"
label: "Card lists views, opens one"
given: "the bookstore System Context view in Designer; a bookstore with 80 more people, Target among them with a long description, on a canvas of its own, on 30 more canvases and in two wikis"
tests: |
  apps/e2e/tests/studio/properties-card.spec.ts › the card lists the views that show the element and opens one
  apps/e2e/tests/studio/show-in-view.spec.ts › views that are lists › a view opened from the card is scrolled into sight in the list of views
  apps/e2e/tests/studio/show-in-view.spec.ts › views that are lists › a table opened from the card scrolls to the element's row, again on a second click
  apps/e2e/tests/studio/show-in-view.spec.ts › views that are lists › a wiki opened from the card shows the element's page from its top, also after another wiki
  packages/common/tests/viewsShowingNode.test.ts › the views that show an element › are those whose list or chain has it, and those of the whole model, in model order
  packages/common/tests/viewsShowingNode.test.ts › the views that show an element › leave out a group of views per element, whose views stand for it
then: "the section reads Views · 3 and lists System Context (open), Containers and Element Table but not Place Order Flow, which leaves Bookstore out; Containers opens with Bookstore selected and its card open, Containers now marked open; Element Table opens with Bookstore still in the card; a view that lists none of the elements, a chain view and a group of views per element (through its views) are counted as the view list counts them, and an element on no view has none; More 29 is marked and scrolled into sight in the list of views; Target's row is selected and in sight, and in sight again after the second click; each wiki shows Target's page from its top, also the open one asked for again"
when: "the user selects Bookstore, clicks Containers in the card's Views section, then Element Table; selects Target, opens More 29, out of sight in the list of views, from the card; opens Element Table from the card, scrolls the row away and clicks Element Table again; opens Wiki A, scrolls its page down, opens Wiki B, scrolls down and clicks Wiki B again"
---
