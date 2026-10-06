---
id: "0b820fa7-ebc8-401c-82d9-eb566524ca24"
type: "scenario"
label: "Outside edit shows on canvas"
gherkin: |
  And three seconds later the file still says Book Lover and no file says Customer
  # Covered by: apps/e2e/tests/studio/folders.spec.ts › an edit made outside the app shows up on the canvas
given: "the sample model is saved as a folder and open in Studio"
then: "the Customer element shows Book Lover on the canvas within a few seconds"
when: "another program changes the label in nodes/customer.md to Book Lover"
---
