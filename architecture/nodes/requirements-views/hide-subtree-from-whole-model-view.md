---
id: "8db2e300-6298-47d3-945c-f87c55428ccc"
type: "scenario"
label: "Hide subtree from whole-model view"
gherkin: "# Covered by: packages/ui/tests/views.test.ts › removeNodeFromView from \"show all\" view excludes node and descendants"
given: "a named view with an empty element list that shows the whole model"
then: "the view lists every other element and excludes the container and all its descendants"
when: "the user removes a container from the view"
---
