---
id: "a03dc344-8c3e-4d03-b81c-224b0c8e78b6"
type: "scenario"
label: "Pack gets its view"
given: "a model with a shop system holding a web app and a view already named Authentication"
tests: |
  packages/common/tests/check.test.ts › radical check: concerns › an imported pack gets a view of its own, with what it is bound to
  apps/mcp/src/forge.test.ts › forge_import_hub_concept › binds a concern pack to an element
  packages/common/tests/concernPacks.test.ts › the pack's view lists and places each bound element with what holds it, on the left of the pack
  apps/e2e/tests/studio/hub-import.spec.ts › a pack bound to an element inside a container opens its view as saved, the container holding it on the left
  apps/studio/tests/concernImportMilestone.test.ts › a concern pack imported in a milestone and discarded leaves the live views as they were
  apps/studio/tests/concernImportMilestone.test.ts › a concern pack imported in a milestone and propagated brings its view into the live model
  apps/e2e/tests/studio/hub-import.spec.ts › a concern pack imported in a milestone brings its view with its elements: Discard takes it back, Propagate keeps it
then: "the first import adds the view \"Authentication 2\" in the folder Concerns listing the pack's elements and the web app, the pack's decision right of its requirements and the shop on their left; the second adds \"Authentication 3\" with the pack's elements only"
when: "the Authentication pack is imported bound to the web app, and again unbound"
---
