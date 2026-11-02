---
id: "13e30c43-0968-4b59-9a73-b3fbac705a07"
type: "requirement"
label: "Leaving a view clears its selection"
action: "Studio shall clear the selection, so that the view opened shows nothing selected, and coming back to the view left shows nothing selected there either."
ears_type: "event-driven"
rationale: "A selection belongs to the picture it was made on: carried to another view it focused elements the user had not chosen there, and kept per view it came back unasked (with the properties card) when the user returned. The selection is not saved; reading the same document again (an outside change) keeps the open view's. Evidence: packages/ui/src/store/diagramStore.ts (_viewSelections, clearViewSelection, showSelection; _sync keeps the selection painted), packages/ui/tests/viewSelection.test.ts, apps/e2e/tests/studio/selection-focus.spec.ts"
trigger: "the user opens another view"
---
