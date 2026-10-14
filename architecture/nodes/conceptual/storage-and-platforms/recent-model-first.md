---
id: "e9b4d0df-3cb0-4610-9e6d-be405907ceea"
type: "scenario"
label: "Recent model first"
given: "a model was opened before"
tests: "apps/e2e/tests/studio/boot.spec.ts › returning visit › Open lists recent models, the last one first and focused"
then: "that model is listed first and focused, and Enter opens it on the canvas"
when: "the user chooses Open on the welcome screen and presses Enter"
---
