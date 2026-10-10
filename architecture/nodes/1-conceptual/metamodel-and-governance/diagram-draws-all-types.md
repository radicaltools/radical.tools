---
id: "77d3b097-de63-442a-a465-7f28b2703927"
type: "scenario"
label: "Diagram draws all types"
gherkin: |
  And the ADR box shows a "↻ Supersedes" chip instead of a loop
  And Show Contains and Show properties on boxes are on, with 35 containment edges and ears_type listed on the Requirement box
  And unchecking Show Contains leaves only the 2 edges from Domain and Group to Blueprint
  And "none" then Show Constrains leaves 24 edges between 11 types
  And unchecking Show properties on boxes removes ears_type from the Requirement box
  # Covered by: apps/e2e/tests/studio/metamodel-diagram.spec.ts › the Diagram tab draws every node type and its relations
given: "a model running under the Radical metamodel, stored only by its preset id"
then: "all 16 node types are drawn as non-overlapping boxes in the frames C4, Domain, Governance, Requirements, UX and Other, with relation names on the lines"
when: "the user opens the metamodel editor and switches to the Diagram tab"
---
