---
id: "5587f386-05a0-49bb-8a97-529ae5519865"
type: "scenario"
label: "Pick a slide from search"
given: "a presentation with three slides"
metrics: "test(apps/e2e/tests/studio/search.spec.ts › a pick of a slide opens it in Presenter, and Shift+Enter plays the presentation from it) passed"
then: "Presenter opens with the second slide shown; with Shift+Enter the presentation plays from the second slide"
when: "the user picks its second slide in Quick Search, and later picks it with Shift+Enter"
---
