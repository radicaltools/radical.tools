---
id: "edb56456-52f6-4f09-b11c-3148f5f45c95"
type: "scenario"
label: "Collapse stays in its view"
given: "a named view and All elements showing the same container"
metrics: |
  test(packages/ui/tests/viewCollapse.test.ts › collapse in named view does not affect the default (all-elements) view) passed
  test(packages/ui/tests/viewCollapse.test.ts › a container collapsed at its parent's edge › stays where it is after a view switch (item 222)) passed
  test(packages/ui/tests/viewCollapse.test.ts › a container a view shows without its children › keeps its place there on a reload (item 180)) passed
then: "the container stays expanded on All elements; a container folded at its parent's edge stays where it is after a view switch, and one the view shows without its children keeps its place there on a reload"
when: "the user collapses the container in the named view"
---
