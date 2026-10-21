---
id: "e3c635b4-8735-4278-a4df-769824e40127"
type: "scenario"
label: "Relation type asked on drop"
given: "two entities, between which part-of and references both fit, two aggregate roots, and a relation without a type between a pair the metamodel has several types for"
tests: |
  packages/ui/tests/connectNodes.test.ts › a relation drawn where several types fit
  apps/e2e/tests/studio/view-pipeline.spec.ts › a relation drawn between two entities asks for its type
  packages/common/tests/propertyValues.test.ts › a relation without a type
then: "the relation chosen is added, the dismissed one is not; between aggregate roots part-of is not offered and references is it; Validation warns about the untyped relation"
when: "the user draws a relation between the entities and picks a type, draws another and dismisses the question, draws one between the aggregate roots, and the model is validated"
---
