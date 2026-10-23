---
id: "a7bbb330-ad7b-4c5b-8c69-ed0300e292bb"
type: "scenario"
label: "An element nested by the special key"
given: "the bookstore's Containers view, with Customer in a group Shoppers"
tests: "apps/e2e/tests/studio/nesting.spec.ts › the special key nests an element, and takes it out on the empty canvas"
then: "Shoppers reads \"holds\" while the key is held; the drop on the empty canvas takes Customer out to the top of the model; dragged onto Shoppers, which reads \"inside\", its only offer, it goes back in"
when: "the user selects Customer and holds the special key, then drags from it onto the empty canvas; and drags it back onto the group"
---
