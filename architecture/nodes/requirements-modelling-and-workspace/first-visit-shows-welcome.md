---
id: "62c5e5d0-69af-434c-8618-5c7e1651836b"
type: "scenario"
label: "First visit shows welcome"
gherkin: |
  And the URL hash stays empty
  # Covered by: apps/e2e/tests/studio/boot.spec.ts › first visit › shows the welcome screen
given: "a browser that has never opened Studio"
then: "the Welcome screen offers Explore the sample, New model and Open file…"
when: "the user opens Studio without a URL hash"
---
