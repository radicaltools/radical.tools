---
id: "7a3f486c-7784-4fea-abaa-0aa0d4c9702d"
type: "scenario"
label: "History lists the places"
given: "a user who has selected an element, opened another view and the Inspector, then gone back once"
tests: |
  apps/e2e/tests/studio/history.spec.ts › the history lists the places and goes to the one picked
  apps/studio/tests/navHistory.test.ts › navigation history
then: "the list opens over the canvas, its view name included, and shows the places newest first, the current one marked and the one ahead dimmed, and the pick shows the first place; after a reload the list and Back are as they were"
when: "the user opens History and picks the first place"
---
