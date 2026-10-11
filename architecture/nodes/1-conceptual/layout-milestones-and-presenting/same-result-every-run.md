---
id: "7759f831-f353-4832-ace7-71eff83ccecd"
type: "scenario"
label: "Same result every run"
gherkin: "# Covered by: apps/e2e/tests/studio/layout.spec.ts › the result is the same on every run"
given: "the bookstore fixture is open on the Containers view in two separate sessions"
then: "the saved element geometry and view positions are identical"
when: "Smart Layout runs in each session"
---
