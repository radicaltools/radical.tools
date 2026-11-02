---
id: "4d80ae8c-7d44-44f4-a547-14c023a8c0e0"
type: "requirement"
label: "Copy another model's view"
action: "Studio shall add it as the model's own view, editable, in the folder it has in its model, with its elements, filter and places, under its name or, when the model has a view of that name, under its name followed by the model it comes from in parentheses, and open it"
ears_type: "event-driven"
rationale: "Building on another team's view (adding one's own elements beside theirs) needs a view of one's own; a copy keeps where it came from in its name only when the name is taken. Evidence: packages/common/src/model.ts (copyOtherModelView)"
trigger: "the user copies another model's view into the model"
---
