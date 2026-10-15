---
id: "abc94683-5baa-4f3b-8ec1-a1e1b5fd1502"
type: "requirement"
label: "Add elements in the table"
action: "The table view shall add an element where it will show: after the rows under each element that can take one, a + row naming the type (and how it hangs under the element, and the values the level's filters give it) that goes on the chain's next level, linked to that element by the level's relation (or inside it when the level follows containment) and placed beside it; at the end of the table a + row for the first level's types, placed where most of the view's elements of that type are; without a chain, inside the element or at the top of the model; one type added at once, several offered in a list; made to pass the level's filters where it can (a type they leave out not offered, a property set to the value a filter names or cleared of a default that fails it, inside the element a place filter names); with its name open in its row, or the type's wizard prefilled with those values when it has one, and a warning when the view's filter does not show it; no + row under an element of the chain's last level or of a type that holds nothing."
ears_type: "event-driven"
rationale: "The table has no palette and no toolbar, and bulk modelling should not need a detour through the canvas; adding along the chain and through its filters keeps the traceability links the view shows, and a new element does not vanish behind the filter it was added through. Evidence: packages/common/src/viewPipeline.ts (addChoices, meetFilters), packages/ui/src/components/TableView.tsx, packages/ui/src/components/NodeWizard.tsx (initialValues), packages/common/tests/viewPipeline.test.ts"
trigger: "the user clicks a + row of a table, after the rows under an element or at its end, in Designer"
---
