---
id: "d0f89494-9f0e-486c-9036-e4f52e0c7e3c"
type: "scenario"
label: "Dependencies of dependencies"
given: "payments depends on billing, whose deps.json pins orders v1, and in a second case payments pins orders v2 itself"
then: "orders comes in through billing, so billing's relation to Orders and payments' own relation to Orders hold; pinned twice, orders is composed at v2 and the check says that billing's v1 was left out; when billing names payments under another name, payments is not fetched as another model, and a model two models name differently is fetched once"
when: "radical check runs on payments"
---
