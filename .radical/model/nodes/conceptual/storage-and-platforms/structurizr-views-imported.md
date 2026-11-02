---
id: "152a5514-7df3-4e87-8a6d-15da13c9e89a"
type: "scenario"
label: "Structurizr views imported"
given: "Structurizr DSL workspaces with hierarchical identifiers, archetypes, text blocks, tags, groups (one inside a container), a workspace-level !include, deployment, custom elements, two relationships between one pair, a workspace with no name, and system landscape, context, container, component and dynamic views"
metrics: |
  test(packages/common/tests/structurizrDsl.test.ts › hierarchical identifiers) passed
  test(packages/common/tests/structurizrDsl.test.ts › the metamodel the model gets) passed
  test(packages/common/tests/structurizrDsl.test.ts › what an element says inside its block) passed
  test(packages/common/tests/structurizrDsl.test.ts › what the import cannot read) passed
  test(packages/common/tests/structurizrDsl.test.ts › views) passed
  test(packages/common/tests/structurizrDsl.test.ts › the name the model gets) passed
  test(packages/common/tests/structurizrDsl.test.ts › groups on the views) passed
  test(packages/common/tests/structurizrDsl.test.ts › a dynamic step between a pair with two relationships) passed
  test(apps/e2e/tests/studio/files.spec.ts › Open → Structurizr DSL… brings the views, opens the first, and says what it left out) passed
  test(apps/e2e/tests/studio/files.spec.ts › Open → Structurizr DSL… names the model after the file, and draws the workspace's groups) passed
then: "each relationship joins the elements its path names and those it cannot place are listed; Big Bank plc comes in with nothing Validation flags; the group in a container is left out with its components in the container, and the notice says so; an existing or external system is external; each view becomes a Radical view with what it includes, the groups drawn round the elements it shows and not folded (none on the dynamic view), elements shown without contents folded and the dynamic view playing a sequence, each step on the relationship its description names; the model is named after the workspace, or after the file when the workspace has no name; the first view opens laid out; the import says what it left out"
when: "the user imports one with Open → Structurizr DSL…"
---
