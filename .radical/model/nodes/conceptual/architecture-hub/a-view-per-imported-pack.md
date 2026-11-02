---
id: "2c2626f4-fa4c-46e2-84c8-6e4fb62ea0ea"
type: "requirement"
label: "A view per imported pack"
action: "add a canvas view named after the pack in the views folder Concerns, listing the elements it brought, placed in columns (need, requirements, scenarios, decisions, fitness functions), and the elements it is bound to, in a column on their left inside the containers that hold them, the view listing and placing every element it draws; imported while a milestone is shown, the view comes into the live model with the pack's elements (Propagate) and not without them (Discard)"
ears_type: "event-driven"
rationale: "One place to read a decision with everything it brought and what it constrains, without searching the model. Product owner, Hub review 2026-10-22. A pack bound to an element inside a container got a view that rearranged itself when first opened, and one imported in a milestone and discarded left a view of missing elements (round 170–175, 2026-10-22, F-0008, F-0010). Evidence: packages/common/src/concerns.ts (concernView), apps/studio/src/renderer/src/hub/importConcept.ts (addViewsOnceLive)"
trigger: "a concern pack is imported, by Studio's concern wizard, by forge_import_hub_concept or by Radical Forge"
---
