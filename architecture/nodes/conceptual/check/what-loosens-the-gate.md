---
id: "f2c49906-babb-46e7-91ab-74ffffe5dd7c"
type: "scenario"
label: "What loosens the gate"
given: "a check.json with baselines, goals and the test files test-unbound looks at"
tests: "packages/common/tests/checkGoals.test.ts › check.json changes"
then: "a higher or new baseline, a lower severity, a lower or removed goal and an added exclude loosen the gate, while a higher severity, a removed baseline and a new goal do not"
when: "a setting changes"
---
