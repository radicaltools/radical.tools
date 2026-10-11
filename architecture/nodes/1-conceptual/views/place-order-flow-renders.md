---
id: "cdabd04c-0834-491f-9a6a-9e1bdfa22cc1"
type: "scenario"
label: "Place Order flow renders"
gherkin: "# Covered by: apps/e2e/tests/studio/views.spec.ts › Place Order Flow (dynamic)"
given: "the Place Order Flow view linked to a four-step order sequence"
then: "the Flow view shows the caption '4 steps · 5 participants' and the arrows 'submits the order', 'posts the order', 'stores the order' and 'charges the card'"
when: "the user opens the view by deep link"
---
