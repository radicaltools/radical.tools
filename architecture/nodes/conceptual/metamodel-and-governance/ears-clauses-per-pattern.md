---
id: "a4dd00cc-3337-4a71-943a-628dba26e9f2"
type: "scenario"
label: "EARS clauses per pattern"
given: "the requirement wizard's EARS step"
tests: "packages/common/tests/nodeWizard.test.ts › wizardStepFields › only shows the clauses the chosen EARS type uses"
then: "only ears_type and action are shown, then ears_type, trigger and action"
when: "the EARS type is ubiquitous, then event-driven"
---
