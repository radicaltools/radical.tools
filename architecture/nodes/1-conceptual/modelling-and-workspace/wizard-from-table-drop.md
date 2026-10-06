---
id: "973484de-a4e1-4748-90d0-05ffa26d04bc"
type: "scenario"
label: "Wizard from table drop"
gherkin: "# Covered by: apps/e2e/tests/studio/wizard.spec.ts › dropping an ADR on the table view opens the same wizard"
given: "the bookstore table view on the Governance metamodel"
then: "the wizard closes and the new ADR is listed"
when: "the user drops an ADR on the table, names it and presses ⌘/Ctrl+Enter"
---
