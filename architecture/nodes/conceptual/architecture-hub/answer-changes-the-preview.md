---
id: "206b85a7-a2ab-4dbf-94ad-07721b919d78"
type: "scenario"
label: "Answer changes the preview"
given: "the Authentication pack open in the Hub, with its default answers"
tests: "apps/e2e/tests/hub/hub.spec.ts › the answers panel previews what an answer brings in"
then: "the table lists the decision to sign users in with our own user store and no longer the identity provider one, the count of elements in changes, and the elements the answer added are lit"
when: "the reader picks our own user store for Sign-in"
---
