---
id: "beac5f52-3261-4b70-b06d-44564b5cf59a"
type: "requirement"
label: "Only what the view shows is offered"
action: "Studio shall offer to add only the element types some level of the view's chain can show (one its ways take and its filters do not leave out): on a canvas it shall grey out the other types in the Elements palette, not let them be dragged, and say in their tooltip that the view's filter does not show them; in a wiki it shall leave them out of Add element, Add child and the types offered to write under a heading, and at the top of the wiki (Add element, and the types offered to start with) it shall offer only the types of the chain's first level, placed where that level puts them, so that an element of a later level is added under an element of the level above it."
ears_type: "state-driven"
precondition: "a canvas or wiki view with a filter chain is shown"
rationale: "A view's filter decides what it shows; an element added there that it does not show was added out of sight, with only a warning after the fact. The palette and the wiki say beforehand what belongs on the view. An element of a later level shows only under one of the level above (a requirement under the need it derives from), so at the top it would be added out of sight too: the top offers what the table's + at the top offers. Evidence: packages/common/src/viewPipeline.ts (chainTypes, addChoices); packages/ui/src/components/ElementPalette.tsx; packages/ui/src/components/WikiView.tsx (childTypeOptions, childTypesOf, topTypeOptions)"
---
