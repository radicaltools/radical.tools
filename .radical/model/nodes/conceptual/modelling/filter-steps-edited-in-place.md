---
id: "4057b1c0-10ae-45e0-a45c-c4c3d5aa5db6"
type: "scenario"
label: "Filter steps edited in place"
given: "the sample model's Requirements Register, its Filter open in the view's properties; and a model of domains, needs, requirements and scenarios"
metrics: |
  test(apps/e2e/tests/studio/view-pipeline.spec.ts › a way and a filter are edited in place, and a level can follow any relation) passed
  test(packages/common/tests/viewPipeline.test.ts › view pipeline: any relation, and choices for editing › follows any relation either way to any element, and offers it where more than one relation leads on) passed
  test(packages/common/tests/viewPipeline.test.ts › view pipeline: any relation, and choices for editing › lists what a step can be changed to) passed
then: "the level reads Any relation → Scenario with fewer elements, then Verified by → Scenario; the filter reads EARS type is event-driven or ubiquitous with another count, then is not event-driven or ubiquitous, kept with the view; any relation follows every relation either way and is offered where more than one relation leads on; the editors offer the types, property values, relations, places and ways the elements have"
when: "the user starts with Requirement, adds Any relation → Any element under it, edits that way to Scenario and then along Verified by, adds EARS type is event-driven to the requirements and edits it to also take ubiquitous and then to is not"
---
