---
id: "4273bb3f-8209-47ce-abdd-26c701b5348e"
type: "need"
label: "Tests out of the model"
kind: "stakeholder-note"
source: "Product owner, 2026-11-02"
---

"OK, I see another problem. We are doing everything to keep the model generic; look at the scenarios: test(apps/e2e/tests/hub/hub.spec.ts › concept wiki view) passed." Asked one by one: the binding of scenarios and fitness functions to tests goes into .radical/radical.json ("verifies", beside "implements"); nothing of it stays in the model: a scenario passes when its bound tests pass, and Metrics keeps the metric conditions, in scenarios as in fitness functions; all in one pull request. Then: "Who will check that the mapping of scenarios to tests is complete?"

Translated from Polish.
