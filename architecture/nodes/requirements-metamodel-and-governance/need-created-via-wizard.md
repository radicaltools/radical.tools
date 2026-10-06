---
id: "c49e9ed9-578f-4c43-8399-827396363a20"
type: "scenario"
label: "Need created via wizard"
gherkin: "# Covered by: apps/e2e/tests/studio/need.spec.ts › a Need is created through its wizard and shows the start of its text on the canvas"
given: "a governance model is open on the canvas"
then: "the need appears on the canvas showing the start of its text, and is stored with type need, the brief as description, kind brief and no status"
when: "the user drops a Need from the palette, names it \"Click & collect brief\", enters the brief as its Text and presses Create"
---
