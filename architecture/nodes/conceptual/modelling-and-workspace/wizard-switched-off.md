---
id: "a464d10e-ab1e-43a1-97c4-ac990648651f"
type: "scenario"
label: "Wizard switched off"
given: "Wizard on create is turned off"
tests: "packages/ui/tests/nodeWizard.test.ts › requestCreateNode › creates at once when wizards are turned off or skipped"
then: "it is created at once and no wizard opens"
when: "an ADR is created"
---
