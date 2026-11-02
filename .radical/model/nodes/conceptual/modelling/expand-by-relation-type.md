---
id: "f6b1f703-b70f-4d12-b6fc-0e5838db6c1b"
type: "scenario"
label: "Expand by relation type"
given: "an exploration of API in the bookstore model"
metrics: |
  test(packages/ui/tests/exploreView.test.ts › choosing the relations of a +) passed
  test(apps/e2e/tests/studio/explore.spec.ts › the + of an element adds the relations of the types and direction chosen) passed
then: "the outgoing column lists reads/writes 1 and charges card 1, the incoming column calls 1 and Contained in 1 (the bookstore's relations have no type and are listed by their labels); Contained in adds Bookstore a level below API with a dashed Contains arrow from Bookstore to API; Show checked adds Orders DB and Web App with only their relations drawn; nothing is saved"
when: "the user clicks API's +, reads the two columns, clicks Contained in, then opens the + again, checks reads/writes and calls and clicks Show checked"
---
