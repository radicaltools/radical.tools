---
id: "152a5514-7df3-4e87-8a6d-15da13c9e89a"
type: "scenario"
label: "Structurizr views imported"
given: "Structurizr DSL workspaces with hierarchical identifiers, archetypes, text blocks, tags, a group inside a container, a workspace-level !include, deployment, custom elements, and system landscape, context, container, component and dynamic views"
tests: |
  packages/common/tests/structurizrDsl.test.ts › hierarchical identifiers
  packages/common/tests/structurizrDsl.test.ts › the metamodel the model gets
  packages/common/tests/structurizrDsl.test.ts › what an element says inside its block
  packages/common/tests/structurizrDsl.test.ts › what the import cannot read
  packages/common/tests/structurizrDsl.test.ts › views
  apps/e2e/tests/studio/files.spec.ts › Open → Structurizr DSL… brings the views, opens the first, and says what it left out
then: "each relationship joins the elements its path names and those it cannot place are listed; Big Bank plc comes in with nothing Validation flags; the group in a container is left out with its components in the container, and the notice says so; an existing or external system is external; each view becomes a Radical view with what it includes, elements shown without contents folded and the dynamic view playing a sequence; the first view opens laid out; the import says what it left out"
when: "the user imports one with Open → Structurizr DSL…"
---
