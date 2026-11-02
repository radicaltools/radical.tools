---
id: "c654cbb0-9875-4bc6-8a6a-ae0e1799961a"
type: "scenario"
label: "Two packs from a Hub link"
given: "Studio opened with a Hub link naming the Authentication and Secrets packs"
metrics: "test(apps/e2e/tests/studio/hub-import.spec.ts › several concern packs from a Hub link open their wizards one after another, each with its view) passed"
then: "the Authentication wizard opens by itself marked 1 of 2; after its import the Secrets wizard opens marked 2 of 2; after that the dialog closes, and the model holds both packs, each with its view in the folder Concerns"
when: "the user adds the first pack in its wizard, then the second"
---
