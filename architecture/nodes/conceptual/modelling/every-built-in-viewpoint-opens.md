---
id: "15864ce3-4394-4e6f-9ca7-09b93a3db4c1"
type: "scenario"
label: "Every built-in viewpoint opens"
given: "the Fintech sample on the Radical metamodel, which has no domains, entities, events or state machines"
tests: |
  apps/e2e/tests/studio/viewpoints.spec.ts › every viewpoint of the Radical metamodel opens as a view of its type
  apps/e2e/tests/studio/viewpoints.spec.ts › the New view menu stays inside the window in a model without views
  packages/common/tests/viewpoints.test.ts › built-in viewpoints › name only the types, relations and properties their metamodel has
  packages/common/tests/viewpoints.test.ts › viewpoints › come with both presets, grouped by concern: all of them with Radical, the C4 ones with C4
  packages/common/tests/viewpoints.test.ts › viewpoints › stay with a document on a preset when the preset is swapped in on load
then: "the menu shows the groups C4, Domain, Requirements, Decisions, UX and States; each new view is of its viewpoint's view type and named after it, nothing fails, the fourteen with elements in the sample show some and the five for domains, entities and state machines show none; in the model without views the menu opens below the button, inside the window; every built-in viewpoint names only what its metamodel has, C4 brings the four C4 ones, and a document saved with fewer viewpoints gets those its preset has gained"
when: "the user opens + New view and picks each of the nineteen viewpoints in turn; and opens + New view in a model without views"
---
