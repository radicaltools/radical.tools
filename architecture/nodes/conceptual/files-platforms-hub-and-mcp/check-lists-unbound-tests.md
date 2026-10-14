---
id: "bf0b3a9c-e312-4eb5-9d9f-8b54b26bca0b"
type: "requirement"
label: "Check lists unbound tests"
action: "list per included test file the tests that no scenario or fitness function names by title or describe block, a whole file or directory not counting"
ears_type: "optional"
feature: "the model's check.json includes test files for test-unbound"
rationale: "Coverage both ways: a scenario without a test, and a tested behaviour the specification does not describe. Evidence: unboundTests in packages/common/src/check/rules.ts"
---
