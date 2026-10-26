---
id: "a7bbb330-ad7b-4c5b-8c69-ed0300e292bb"
type: "scenario"
label: "An element nested by the special key"
given: "the bookstore's Containers view, with Customer in a group Shoppers; and a folded container with a line ending at it"
tests: |
  apps/e2e/tests/studio/nesting.spec.ts › the special key nests an element, and takes it out on the empty canvas
  apps/e2e/tests/studio/nesting.spec.ts › the pills lie over the lines: a drop on the inside pill of a folded container nests, with a line ending at it
  apps/e2e/tests/studio/nesting.spec.ts › a drop on the holds pill says the element is there already
  apps/e2e/tests/studio/nesting.spec.ts › zoomed out, a drop or a click with the special key on an element goes to that element, not to another element's pill over it
then: "Shoppers reads \"holds\" while the key is held; the drop on the empty canvas takes Customer out to the top of the model; dragged onto Shoppers, which reads \"inside\", its only offer, it goes back in; the pills lie over the line and the drop on inside nests the element; the drop on holds says the element is there already; zoomed out, the drop and the click go to the element under the pointer, not to the pill over it"
when: "the user selects Customer and holds the special key, then drags from it onto the empty canvas; and drags it back onto the group; and drops an element on the folded container's inside pill, where the line ends, and one on the holds pill of its own container; and, zoomed out, drops and clicks with the key on an element a neighbour's pill lies over"
---
