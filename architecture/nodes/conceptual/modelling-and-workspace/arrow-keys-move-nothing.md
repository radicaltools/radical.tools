---
id: "118c8e09-dc80-4298-8a7a-bb5aab96864d"
type: "requirement"
label: "Arrow keys move nothing"
action: "leave the element where it is"
ears_type: "unwanted-behaviour"
rationale: "The arrow keys moved the element on screen only: out of its container, not saved, not undoable and back on reload. Evidence: apps/e2e/tests/studio/runs-13-24.spec.ts"
unwanted_condition: "the user presses an arrow key while an element is selected on the canvas"
---
