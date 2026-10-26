---
id: "049ee8fe-9cfa-4a0c-95a9-6f0cf2d27b1c"
type: "scenario"
label: "A new element fits where it is offered"
given: "a domain model with an aggregate root and a part, a system holding containers, and a filter that leaves out a choice's default"
tests: |
  packages/common/tests/viewPipeline.test.ts › view pipeline: a new element offered under another is one the model accepts › a part of an aggregate root is made Kind entity, and none is offered under a part
  packages/common/tests/viewPipeline.test.ts › view pipeline: a new element offered under another is one the model accepts › a container is not offered by a relation to the system that would hold it
  packages/common/tests/viewPipeline.test.ts › view pipeline: a new element offered under another is one the model accepts › a choice whose default a filter leaves out gets another of its options, never an empty one
  packages/ui/tests/nodeWizard.test.ts › addNodes › refuses a node whose link the rules refuse, with the reason, instead of adding it unlinked
  apps/e2e/tests/studio/wiki.spec.ts › the wiki keeps the metamodel › a part written on an aggregate root's page is a part linked to it, and a part's page offers none
then: "a part is offered under an aggregate root and added Kind entity, linked to it; none is offered under a part, nor a container by a relation to the system that would hold it; a choice whose default the filter leaves out gets another of its options; a node whose link the rules refuse is not added, and the reason is shown"
when: "the user adds an element under another in the table or writes one on a wiki page, and the engine lists what each place offers"
---
