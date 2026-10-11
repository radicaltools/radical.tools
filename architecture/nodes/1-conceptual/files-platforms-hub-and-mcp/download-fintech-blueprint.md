---
id: "52cd00fd-e72c-4a3f-8973-589736f3ab62"
type: "scenario"
label: "Download fintech blueprint"
gherkin: "# Covered by: apps/e2e/tests/hub/hub.spec.ts › download a concept as a .radical file"
given: "the fintech blueprint is open on the canvas in the Hub"
then: "a .radical file is downloaded whose hub.id is the concept id and which has elements and relations"
when: "the user clicks Download"
---
