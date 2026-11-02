---
id: "9a72ecf8-1d8b-42dc-b680-f7b131d72f24"
type: "requirement"
label: "Filter offers the metamodel"
action: "Studio shall offer, after what the model's elements give, what the metamodel allows with no element yet, each with a count of 0: the types to start with; the relations whose pairs name a type of the level above (either way) and containment by its types' allowed parents, each to the type at the other end; and the options of the enum properties of the level's types."
ears_type: "event-driven"
rationale: "A chain built only from the elements there are cannot be set up before its elements: a view of needs and the requirements refined from them is wanted before the first requirement is written, and then filled from its table. Evidence: packages/common/src/viewPipeline.ts (suggestStartWays, suggestNextWays, metamodelWays, levelTypes, viaChoices, typeChoices, propertyChoices, suggestFilters), packages/ui/src/components/ViewPipelinePanel.tsx, packages/common/tests/viewPipeline.test.ts"
trigger: "the user opens Start with, Level under, a level's Filter menu, or the editor of a way or filter in a view's Filter"
---
