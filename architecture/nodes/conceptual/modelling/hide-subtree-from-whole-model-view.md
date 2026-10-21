---
id: "8db2e300-6298-47d3-945c-f87c55428ccc"
type: "scenario"
label: "Hide subtree from whole-model view"
given: "a named view with an empty element list that shows the whole model"
tests: "packages/ui/tests/views.test.ts › removeNodeFromView from \"show all\" view excludes node and descendants"
then: "the view lists every other element and excludes the container and all its descendants"
when: "the user removes a container from the view"
---
