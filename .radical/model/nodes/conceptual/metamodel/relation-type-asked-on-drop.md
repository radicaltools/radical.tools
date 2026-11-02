---
id: "e3c635b4-8735-4278-a4df-769824e40127"
type: "scenario"
label: "Relation type asked on drop"
given: "two entities, between which part-of and references both fit, two aggregate roots, a metamodel with a relation type that has no pairs, and a relation without a type between a pair the metamodel has several types for"
metrics: |
  test(packages/ui/tests/connectNodes.test.ts › a relation drawn where several types fit) passed
  test(packages/ui/tests/connectNodes.test.ts › a relation drawn with an any-pair type in the metamodel) passed
  test(apps/e2e/tests/studio/view-pipeline.spec.ts › a relation drawn between two entities asks for its type) passed
  test(apps/e2e/tests/studio/matrix.spec.ts › an empty cell where several relation types fit asks which) passed
  test(packages/common/tests/propertyValues.test.ts › a relation without a type) passed
  test(apps/e2e/tests/studio/view-pipeline.spec.ts › a relation's end moved onto a pair where several types fit) passed
  test(packages/common/tests/relationEndpoints.test.ts › the type of a relation whose end moves) passed
then: "the relation chosen is added, the dismissed one is not; between aggregate roots part-of is not offered and references is it; where only the any-pair type fits the relation gets it, where it fits beside another Studio asks, and so does the matrix cell; Validation warns about the untyped relation, an any-pair type counting as one that fits"
when: "the user draws a relation between the entities and picks a type, draws another and dismisses the question, draws one between the aggregate roots, draws relations where only the any-pair type fits and where it fits beside another, clicks an empty matrix cell where several types fit, and the model is validated"
---
