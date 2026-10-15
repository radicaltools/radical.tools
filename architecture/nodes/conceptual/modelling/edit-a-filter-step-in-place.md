---
id: "09790554-013f-4570-b42c-96b437ce4c24"
type: "requirement"
label: "Edit a filter step in place"
action: "Studio shall open an editor under it that changes it in place, each change at once and one undo step: a way's relation (any relation either way and containment among them) and the types it takes, none for any; a type filter's types; a property filter's property, operator (is, is not, is set, is not set) and values, offered with how many elements going into the level have each; a relation filter's relation and whether the elements have it; a place filter's container; a text filter's words; Done closes it."
ears_type: "event-driven"
rationale: "A chain is built by trying: a step that can only be removed and made again loses its place among the filters joined with or. Evidence: packages/ui/src/components/ViewPipelinePanel.tsx (FilterEditor, WayEditor, ChoiceList), packages/common/src/viewPipeline.ts (typeChoices, propertyChoices, relationChoices, placeChoices, viaChoices), packages/common/tests/viewPipeline.test.ts, apps/e2e/tests/studio/view-pipeline.spec.ts; manual#view-steps"
trigger: "the user clicks a way or a filter in a view's Filter"
---
