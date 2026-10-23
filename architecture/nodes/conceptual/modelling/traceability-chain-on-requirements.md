---
id: "0165f89b-a8c3-44aa-9dad-41f5de8f60da"
type: "scenario"
label: "Traceability chain on requirements"
given: "the sample model's Requirements Register, its Filter open in the view's properties; and a model of two domains, needs, requirements and scenarios"
tests: |
  apps/e2e/tests/studio/view-pipeline.spec.ts › needs → requirements → scenarios, built in the Filter panel, shown as a tree in the table
  apps/e2e/tests/studio/view-pipeline.spec.ts › a level takes any of its ways: needs or requirements as roots, the scenarios verifying either under them
  packages/common/tests/viewPipeline.test.ts › view pipeline: the chain › builds needs → requirements → scenarios; an element under two parents shows under both
  packages/common/tests/viewPipeline.test.ts › view pipeline: the chain › filters each level on its own, and hangs a level under its parents by containment too
  packages/common/tests/viewPipeline.test.ts › view pipeline: the chain › keeps to the view's elements, all of them for a view that lists none, and orders each level
  packages/common/tests/viewPipeline.test.ts › view pipeline: the chain › takes any of a level's ways: needs or domains, then what is refined from one or contained in the other
  packages/common/tests/viewPipeline.test.ts › view pipeline: the chain › suggests the first level's ways by type and the next ones along every relation and containment
  packages/common/tests/viewPipeline.test.ts › view pipeline: the chain › is kept with the view and in a Markdown folder; an empty one is removed
  packages/common/tests/viewPipeline.test.ts › view pipeline: filters and order › filters by type, property value, relation, place and text, counting each step
  packages/common/tests/viewPipeline.test.ts › view pipeline: filters and order › joins filters with and, or a run of them with or
  packages/common/tests/viewPipeline.test.ts › view pipeline: filters and order › says each filter in words
  packages/common/tests/viewPipeline.test.ts › view pipeline: filters and order › orders by name, type or a property, those without the value last
  packages/common/tests/viewPipeline.test.ts › view pipeline: filters and order › suggests filters that narrow the rows, with how many each keeps
  packages/common/tests/viewPipeline.test.ts › view pipeline: chains in older files › reads a level written before levels had ways, and leaves out what it cannot read
  packages/common/tests/aiSequenceTools.test.ts › view filter chains over tools › create_view and update_view set a chain, checked against the model, and null removes it
  packages/common/tests/viewPipeline.test.ts › view pipeline: filters and order › reads an element that stores no value as its type's default, as the card does
then: "the table shows 3 needs at the top, Four-eyes approval under one and Same signatory cannot approve twice under it, as does the Structure tree, where a click opens the scenario's properties; the fold hides and shows the need's requirements; the filter counts 7 in and hides the ubiquitous requirements until or brings them back; after the reload the three levels are there and Reset removes them; with Need or Requirement the roots are 13 with the scenario under its requirement, 3 again without the or; the engine builds, filters, joins, orders and suggests as its tests say, reads chains in older files, and agents set chains with create_view and update_view; an element that stores no value is filtered, counted, suggested and ordered as its type's default, so Repeat is 1 keeps the 9 steps"
when: "the user starts with Need, adds Refined into → Requirement and Verified by → Scenario, folds and unfolds Corporate treasurer feedback, filters the requirements to event-driven and adds or ubiquitous, reloads and resets; and, separately, starts with Need or Requirement, adds Verified by → Scenario and removes the or"
---
