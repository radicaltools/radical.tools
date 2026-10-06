---
id: "90a97c4f-0d1f-48d4-aa6a-b2d11bb12a58"
type: "scenario"
label: "Idle nested canvas stays still"
gherkin: |
  And this is a known bug: the live WebCoLa layout never converges on nested views (marked test.fail)
  # Covered by: apps/e2e/tests/studio/known-issues.spec.ts › an idle canvas with nested elements stays still
given: "the bookstore fixture is open on the Containers view, which shows nested elements"
then: "every element keeps its position"
when: "nobody touches the canvas for two seconds"
---
