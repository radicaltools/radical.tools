---
id: "edbfb26f-f4d1-48a3-9264-5b38a2cf10ae"
type: "scenario"
label: "Offers follow the view's filter"
given: "the bookstore's System Context, which lists its elements; the sample's Domain map, whose chain takes domains; an empty wiki with the chain of Specification (needs, requirements, scenarios, mockups); a Specification wiki with a requirement; a wiki whose first level filters by name or relation; and chains of one and more levels with type filters"
tests: |
  packages/common/tests/viewPipeline.test.ts › chainTypes › gives the types some level of a chain shows, without those its filters leave out, and null without a chain
  apps/e2e/tests/studio/editing.spec.ts › the palette greys out the types a view's filter does not show
  apps/e2e/tests/studio/wiki.spec.ts › a wiki with a filter offers only the types its chain shows, at the top only its first level's
  apps/e2e/tests/studio/wiki.spec.ts › an element's page offers what the chain shows under it, and what is written there is linked the chain's way
  apps/e2e/tests/studio/wiki.spec.ts › a wiki whose first level filters by name or relation still offers its types at the top, saying the filter won't show a new one
then: "on System Context no type is greyed out; on Domain map only Domain is draggable and the other types are greyed out with a tooltip saying the view's filter does not show them; the wiki offers Needs to start with, and neither Software systems nor Requirements nor Scenarios, and Add element offers Need alone, which adds a need; the requirement's page offers Scenarios and Mockups, not Requirements, and what is written there is linked to the requirement the chain's way; the filtered wiki offers its first level's types at the top, marked \"the filter won't show it\", never \"No root types in metamodel\"; the engine gives the types of every level not left out by its filters (all of them for a filter switched off), and nothing for a view without a chain"
when: "the user looks at the palette on System Context and on Domain map, and at what the wiki offers to start with and under Add element; writes on a requirement's page; looks at what the filtered wiki offers at the top; and the engine reads which types each chain can show"
---
