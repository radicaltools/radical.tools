---
id: "13e30c43-0968-4b59-9a73-b3fbac705a07"
type: "requirement"
label: "Each view keeps its selection"
action: "Studio shall keep the selection of the view left and show the selection last made on the view opened, limited to what that view shows, or nothing when none was made there."
ears_type: "event-driven"
rationale: "A selection belongs to the picture it was made on: carried to another view it focused elements the user had not chosen there, or none the view shows. The selections are not saved; reading the same document again (an outside change) keeps them, opening another forgets them. Evidence: packages/ui/src/store/diagramStore.ts (_viewSelections, swapViewSelection, showSelection; _sync keeps the selection painted), packages/ui/tests/viewSelection.test.ts, apps/e2e/tests/studio/selection-focus.spec.ts"
trigger: "the user opens another view"
---
