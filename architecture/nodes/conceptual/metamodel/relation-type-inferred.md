---
id: "22a97807-a8c9-461a-b8a3-26e7193c782b"
type: "scenario"
label: "Relation type inferred"
given: "two elements whose pair one restricted relation type allows"
metrics: |
  test(packages/common/tests/modelFacade.test.ts › createModelFacade › infers the relation type and refuses pairs the metamodel does not allow) passed
  test(packages/common/tests/forgeWireframe.test.ts › mockup metamodel › infers the specific relation type for each mockup pair) passed
then: "it gets that type (uses between systems; illustrates, presented-by or navigates-to for mockups), and a pair no type allows is refused"
when: "a relation is added between them without a type"
---
