---
id: "d0f89494-9f0e-486c-9036-e4f52e0c7e3c"
type: "scenario"
label: "Dependencies of dependencies"
given: "payments depends on billing, whose deps.json pins orders v1, and in a second case payments pins orders v2 itself"
metrics: |
  test(apps/cli/src/federation.test.ts › transitive dependencies › brings a dependency's own dependencies, so the relations between them hold) passed
  test(apps/cli/src/federation.test.ts › transitive dependencies › composes a model pinned twice at the nearest pin, and says which one it left) passed
  test(apps/cli/src/federation.test.ts › transitive dependencies › knows the model itself and one model under two names by repository and model folder) passed
then: "orders comes in through billing, so billing's relation to Orders and payments' own relation to Orders hold; pinned twice, orders is composed at v2 and the check says that billing's v1 was left out; when billing names payments under another name, payments is not fetched as another model, and a model two models name differently is fetched once"
when: "radical check runs on payments"
---
