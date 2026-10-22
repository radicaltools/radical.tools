---
id: "a25e105e-01ca-4b65-8d0f-cb48ca5882cb"
type: "scenario"
label: "Concern questions in clarify"
given: "the Hub's concern packs and a description of a shop people sign in to"
tests: |
  packages/common/tests/forgeConcerns.test.ts › concern packs in Forge › the clarify prompt lists the packs and the picked pack's questions come back with their options
  packages/common/tests/forgeConcerns.test.ts › concern packs in Forge › later stages are told the concern is decided and C4 is told what to link
  packages/common/tests/forgeConcerns.test.ts › concern packs in Forge › binds what the C4 stage left unbound where the pack's trigger points, and nothing it linked
  apps/studio/tests/forgeClarify.test.ts › askClarifyingQuestions › returns the concern packs the model picked, their questions added
then: "the clarify prompt lists every pack with its concern and asks for the picks; the picked pack's questions come back as select questions with its options and defaults; later prompts say authentication is decided and write nothing for it; the C4 prompt names the pack's decision to link"
when: "the Requirements stage's clarify prompt is built, the model's reply picks the Authentication pack, and a later stage's prompt and the C4 stage's prompt are built"
---
