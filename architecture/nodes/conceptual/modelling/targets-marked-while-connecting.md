---
id: "ad1b9167-4fd0-4e47-8bdf-b6118e8b11db"
type: "scenario"
label: "Targets marked while connecting"
given: "the bookstore's System Context, and the sample's Domain map, whose chain draws only the relations between domains"
metrics: |
  test(packages/common/tests/viewPipeline.test.ts › connectTypes › gives each target the types a relation from the element may take, as the view's chain draws them) passed
  test(apps/e2e/tests/studio/editing.spec.ts › holding the connection key marks where a relation from the selected element can go, with its type) passed
  test(apps/e2e/tests/studio/views.spec.ts › a line dropped on a pill over the target makes a relation of that type) passed
  test(apps/e2e/tests/studio/editing.spec.ts › a relation's end dragged with the special key shows where it can go, keeping its type) passed
then: "the elements a relation could go to are marked with its type over them and the others are dimmed, the selected one neither; after the release nothing is marked; on Domain map only the other domains are marked, with the types the chain draws; Customers shows a pill for depends on, one for partners with and one for inside, and the drop on partners with makes that relation without a question; while the end is dragged API is marked as the source and Customer as a target reading \"delivers to\", Customer shows its one pill, delivers to, and the drop on it moves the relation's target to Customer; the engine gives each target the relation types that fit the pair and the view would draw, and none for a pair the metamodel or the chain refuses"
when: "the user selects an element and holds the connection key, then releases it; draws a line from a domain onto another on Domain map and drops it on the pill partners with; on Containers selects API → Payment Provider and drags its target end with the key held onto Customer, where one type fits, and drops it there; and the engine lists the targets of a relation from an element on a view with and without a chain"
---
