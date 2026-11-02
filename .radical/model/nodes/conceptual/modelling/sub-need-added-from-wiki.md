---
id: "621b0901-e8f1-463a-bb28-e03471d1acb2"
type: "scenario"
label: "Sub-need added from wiki"
gherkin: "And the table's chain shows the sub-need under its parent"
given: "a discovery need with a sub-need and a derived requirement"
metrics: "test(apps/e2e/tests/studio/need.spec.ts › needs nest under a broader need: a tree in the table's chain, and Add child on its wiki page) passed"
then: "the new need is stored with a Derives relation to the discovery need"
when: "the user clicks Add child › Need on the discovery need's wiki page and creates \"Customer survey\" in the wizard"
---
