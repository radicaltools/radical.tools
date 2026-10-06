---
id: "30338aa6-aa0b-487f-a9ab-913edcb6d690"
type: "scenario"
label: "Collapsed container hides children"
gherkin: "# Covered by: packages/layout/tests/smartLayout.test.ts › runs every candidate when a collapsed container hides related children"
given: "a view whose collapsed container hides children that have relations"
then: "all ten candidates run and the hidden children get no position"
when: "the user runs Smart Layout"
---
