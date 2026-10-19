---
id: "061499c0-5d29-4420-924f-4471ef8184be"
type: "scenario"
label: "Undone view leaves no pane"
given: "the bookstore model on the System Context view"
tests: "apps/e2e/tests/studio/views.spec.ts › undoing a new view brings back the list of views, not its empty properties"
then: "the left panel shows the list of views again, not the view's empty properties"
when: "the user makes a blank view, sets it to Flow in its properties and undoes both steps"
---
