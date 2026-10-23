---
id: "edbfb26f-f4d1-48a3-9264-5b38a2cf10ae"
type: "scenario"
label: "Offers follow the view's filter"
given: "the bookstore's System Context, which lists its elements; the sample's Domain map, whose chain takes domains; an empty wiki with the chain of Specification (needs, requirements, scenarios, mockups); and chains of one and more levels with type filters"
tests: |
  packages/common/tests/viewPipeline.test.ts › chainTypes › gives the types some level of a chain shows, without those its filters leave out, and null without a chain
  apps/e2e/tests/studio/editing.spec.ts › the palette greys out the types a view's filter does not show
  apps/e2e/tests/studio/wiki.spec.ts › a wiki with a filter offers only the types its chain shows
then: "on System Context no type is greyed out; on Domain map only Domain is draggable and the other types are greyed out with a tooltip saying the view's filter does not show them; the wiki offers Needs and no Software systems to start with, and Need but neither Software System nor Group under Add element; the engine gives the types of every level not left out by its filters (all of them for a filter switched off), and nothing for a view without a chain"
when: "the user looks at the palette on System Context and on Domain map, and at what the wiki offers to start with and under Add element; and the engine reads which types each chain can show"
---
