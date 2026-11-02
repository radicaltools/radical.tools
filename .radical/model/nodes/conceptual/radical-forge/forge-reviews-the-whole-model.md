---
id: "fb856c4f-fd5c-40fb-a2f0-b3d4fb95b7b3"
type: "scenario"
label: "Forge reviews the whole model"
given: "a Forge run whose C4 stage is completed"
then: "it comes ninth of nine after the C4 model; its task asks to check the whole model against the brief, carries the open gaps and says that every change to the model goes to the user as a proposal first; every stage prompt from the domain model on has the gaps rule and the C4 prompt no longer forbids adding requirements"
when: "the Review stage is generated"
---
