---
id: "edb56456-52f6-4f09-b11c-3148f5f45c95"
type: "scenario"
label: "Collapse stays in its view"
gherkin: ""
given: "a named view and All elements showing the same container"
tests: "packages/ui/tests/viewCollapse.test.ts › collapse in named view does not affect the default (all-elements) view"
then: "the container stays expanded on All elements"
when: "the user collapses the container in the named view"
---
