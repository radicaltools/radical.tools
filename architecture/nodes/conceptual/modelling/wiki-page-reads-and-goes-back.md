---
id: "9ead6977-1de8-48ea-8954-566cfd35f5ba"
type: "scenario"
label: "Wiki page reads and goes back"
given: "the sample's Architecture Wiki on its Overview, and Product Wiki on Strong customer authentication"
tests: |
  apps/e2e/tests/studio/wiki.spec.ts › wiki › Back from the first page read goes to the Overview
  apps/e2e/tests/studio/wiki.spec.ts › wiki › a requirement's sentence sits beside the facts box, not over it
then: "Back shows the Overview and Forward the page again; the requirement's sentence sits beside its facts box, not over it"
when: "the user opens Core Banking Platform from the Overview and presses ‹ Back, then Forward; and reads the requirement's page"
---
