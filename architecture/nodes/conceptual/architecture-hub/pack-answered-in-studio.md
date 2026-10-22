---
id: "ed65d41b-a352-4a52-91c1-1a9b33c60322"
type: "scenario"
label: "Pack answered in Studio"
given: "a model in Studio where a person uses two web apps of a shop system, with one web app selected"
tests: |
  apps/e2e/tests/studio/hub-import.spec.ts › a concern pack is imported with its answers and bound to the element in one undo step
  packages/common/tests/concernPacks.test.ts › refuses a pack the model's metamodel cannot hold, saying which types it lacks
  apps/e2e/tests/studio/hub-import.spec.ts › a concern pack is not added to a model whose metamodel cannot hold it, and the wizard says why
then: "the wizard suggests the shop, which covers both web apps, says how many of them the elements checked cover, and offers every other element too; it asks one question a step and drops the question the answers make moot; the review shows what the answers bring; the model gains that slice, its ADR constrains both web apps and each satisfies its requirements; one undo removes it all"
when: "the user opens Import from Hub, picks the Authentication pack, unchecks the shop and checks both web apps, changes the answers, imports it, then undoes once"
---
