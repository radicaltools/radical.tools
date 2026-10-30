---
id: "b8844ea0-f1b5-4e82-8e6d-7926a1de82ec"
type: "scenario"
label: "Table adds along the chain"
given: "the Fintech sample's Requirements Register with the chain needs → requirements, the requirements filtered to EARS type event-driven"
metrics: |
  test(apps/e2e/tests/studio/view-pipeline.spec.ts › the table adds an element under a row, on the next level of the chain as its filters ask, and one at the top) passed
  test(apps/e2e/tests/studio/view-pipeline.spec.ts › the table's + row names each type it adds once) passed
then: "the + row reads Requirement · refined into · EARS type: event-driven, naming each type it adds once; the requirement is event-driven, shows under the need and derives from it, there is no + row under it, and the need shows at the top"
when: "the user adds a requirement from the + row after a need's requirements and a need from the + row at the end, naming each in its wizard"
---
