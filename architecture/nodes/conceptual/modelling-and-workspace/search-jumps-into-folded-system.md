---
id: "ebcf797e-7a8f-49d0-9f48-017d76b03651"
type: "scenario"
label: "Search jumps into folded system"
gherkin: "# Not covered by an automated test"
given: "a container inside a collapsed system that the active view does not show"
tests: |
  apps/e2e/tests/studio/physics.spec.ts › Quick Search shows what it finds
  packages/ui/tests/viewCollapse.test.ts › showing an element that is searched for (expandAncestors)
then: "Studio switches to a view containing it, expands the system, selects the container and zooms onto it"
when: "the user presses ⌘/Ctrl+P, types its name and presses Enter"
---
