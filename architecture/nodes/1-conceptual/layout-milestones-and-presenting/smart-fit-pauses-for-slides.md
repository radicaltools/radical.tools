---
id: "c10076c1-53da-4753-a594-f63b9c22f063"
type: "scenario"
label: "Smart Fit pauses for slides"
gherkin: "# Covered by: packages/ui/tests/autoFit.test.ts › does not fit while a presentation is active"
given: "Smart Fit is on and a presentation is running"
then: "the camera is not re-fitted and keeps the slide's captured viewport"
when: "the 300 ms re-fit interval elapses"
---
