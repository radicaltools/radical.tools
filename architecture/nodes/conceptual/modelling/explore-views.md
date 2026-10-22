---
id: "2fd7e3de-0a96-4768-8643-772c659df04e"
type: "requirement"
label: "Explore views"
action: "the system shall draw it as an exploration (its start element, levels top-down, each element's + menu and −, only the relations to the next level, rows of at most eight), counting neighbours in the model as it is now; in Designer a +, a − or a drag on it changes the saved view as an undo step; in Viewer a + and a − work but are not saved, and the view is as saved again once it or Viewer is left; its view type can be switched like any view's, to Structure keeping its elements and places"
ears_type: "state-driven"
precondition: "a view of type Explore is shown"
rationale: "Asked for on 2026-10-22: a saved exploration stays of type explore. Settled: it is edited in Designer like any view, explored without saving in Viewer, and its type can be switched."
---
