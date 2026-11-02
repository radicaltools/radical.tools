---
id: "54215859-48cb-4f1a-bc8e-e42a8f216a93"
type: "requirement"
label: "Forge answers from the brief"
action: "propose an answer to each such question with the words of the description it rests on, show those answers apart from the questions still open, marked as answered from the description and open to change, and import the packs only after the user accepts them or changes them; a proposal that is none of the question's options is dropped and the question asked"
ears_type: "event-driven"
rationale: "A brief that says \"sign in with Google\" or \"microservices on Kafka\" has answered those questions; asking them again turns a few packs into twenty questions, while an answer nobody saw would decide a concern behind the user's back. The concern wizard in Studio still asks every question. ADR Forge settles concerns, C4 binds them."
trigger: "the model picks concern packs in the Requirements stage's clarify step and the description settles some of their questions"
---
