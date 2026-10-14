---
id: "a7d0acb4-d02a-419c-b640-fefed7250de5"
type: "scenario"
label: "Perspective switch keeps view"
gherkin: ""
given: "the bookstore Containers view open in the Designer perspective"
tests: "apps/e2e/tests/studio/views.spec.ts › switching perspective keeps the view and updates the URL"
then: "the URL changes to /m/presenter/v/v-containers and back to /m/designer/v/v-containers, the Present button appears in Presenter and the palette returns in Designer"
when: "the user switches to Presenter and then back to Designer"
---
