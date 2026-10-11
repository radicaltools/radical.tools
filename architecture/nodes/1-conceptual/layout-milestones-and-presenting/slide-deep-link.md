---
id: "9863181f-4c79-4545-a405-bbaf82dc217a"
type: "scenario"
label: "Slide deep link"
gherkin: "# Covered by: apps/e2e/tests/studio/presentation.spec.ts › a slide deep link opens the running presentation"
given: "the bookstore fixture with presentation Main"
then: "the presentation runs on slide 2 of 2 showing six elements"
when: "the user opens the URL …/m/presenter/v/v-containers/p/pres-main/play/1/sl/1"
---
