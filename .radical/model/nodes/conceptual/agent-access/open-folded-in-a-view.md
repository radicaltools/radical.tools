---
id: "4c11cad0-85b4-43e6-b405-41d5d979810c"
type: "requirement"
label: "Open folded in a view"
action: "show those elements open or folded in that view only, over their fold on the model, as a collapse or expand on that view's canvas would: a container folds to its middle and opens round it, with room made around it, instead of opening over its neighbours"
ears_type: "event-driven"
rationale: "Someone folds a group in Studio and every view that shows its children then shows one closed box; an agent building views must be able to open it. Evidence: packages/common/src/model.ts (setViewCollapsed); packages/common/src/ai/tools/viewTools.ts"
trigger: "an agent or the assistant calls update_view with expand or collapse"
---
