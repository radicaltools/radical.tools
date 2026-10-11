---
id: "edb56456-52f6-4f09-b11c-3148f5f45c95"
type: "scenario"
label: "Collapse stays in its view"
gherkin: "# Covered by: packages/ui/tests/viewCollapse.test.ts › collapse in named view does not affect the default (all-elements) view"
given: "a named view and the default Structure view showing the same container"
then: "the container stays expanded in the default Structure view"
when: "the user collapses the container in the named view"
---
