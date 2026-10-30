---
id: "62c5e5d0-69af-434c-8618-5c7e1651836b"
type: "scenario"
label: "First visit shows welcome"
gherkin: "And the URL hash stays empty"
given: "a browser where Studio has been set up and holds no model yet"
metrics: "test(apps/e2e/tests/studio/boot.spec.ts › first visit › shows the welcome screen) passed"
then: "the Welcome screen offers New model and Open, with Try the sample model under them, and the URL hash stays empty"
when: "the user opens Studio without a URL hash"
---
