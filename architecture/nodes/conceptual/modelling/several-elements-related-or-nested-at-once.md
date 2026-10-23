---
id: "3214006a-c156-431b-90dc-f6fe59669a59"
type: "scenario"
label: "Several elements related or nested at once"
given: "the bookstore's Containers view with a group Shoppers and a person Clerk beside it"
tests: |
  apps/e2e/tests/studio/nesting.spec.ts › several selected elements are related or nested at once
  apps/e2e/tests/studio/nesting.spec.ts › the special key › one gesture on several selected elements is one undo step, relations and nests alike
then: "the drop relates both to the Orders DB; Shoppers reads \"inside\", and both people go into it at once; each gesture, relating or nesting, also of elements of different parents, shows one notice and is taken back whole by one Ctrl/Cmd+Z"
when: "the user selects the Web App and Payment Provider with the special key and drags from Payment Provider onto the Orders DB with it held; and, with Customer and the Clerk selected, drags onto the group Shoppers; and undoes each gesture"
---
