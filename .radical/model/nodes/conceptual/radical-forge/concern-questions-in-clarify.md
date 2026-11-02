---
id: "a25e105e-01ca-4b65-8d0f-cb48ca5882cb"
type: "scenario"
label: "Concern questions in clarify"
given: "the Hub's concern packs and a description of a shop people sign in to"
then: "the clarify prompt lists every pack with its concern and asks for the picks; the picked pack's questions come back as select questions with its options and defaults; later prompts say authentication is decided and write nothing for it; the C4 prompt names the pack's decision to link"
when: "the Requirements stage's clarify prompt is built, the model's reply picks the Authentication pack, and a later stage's prompt and the C4 stage's prompt are built"
---
