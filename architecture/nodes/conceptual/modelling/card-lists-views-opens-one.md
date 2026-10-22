---
id: "3052c400-750a-4f28-af08-ee8924c3fa32"
type: "scenario"
label: "Card lists views, opens one"
given: "the bookstore System Context view in Designer"
tests: |
  apps/e2e/tests/studio/properties-card.spec.ts › the card lists the views that show the element and opens one
  packages/common/tests/viewsShowingNode.test.ts › the views that show an element › are those whose list or chain has it, and those of the whole model, in model order
  packages/common/tests/viewsShowingNode.test.ts › the views that show an element › leave out a group of views per element, whose views stand for it
then: "the section reads Views · 3 and lists System Context (open), Containers and Element Table but not Place Order Flow, which leaves Bookstore out; Containers opens with Bookstore selected and its card open, Containers now marked open; Element Table opens with Bookstore still in the card; a view that lists none of the elements, a chain view and a group of views per element (through its views) are counted as the view list counts them, and an element on no view has none"
when: "the user selects Bookstore, clicks Containers in the card's Views section, then Element Table"
---
