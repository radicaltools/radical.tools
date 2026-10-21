---
id: "c89b3768-b14b-4baa-82d4-db52e9724720"
type: "scenario"
label: "Product wiki on the chain"
given: "the sample model's Product Wiki, one article (Multi page)"
tests: |
  apps/e2e/tests/studio/view-pipeline.spec.ts › a wiki view follows the same chain: needs on the overview, their requirements as chapters
  apps/e2e/tests/studio/wiki.spec.ts › a wiki of the bookstore › a chain that loops is searched and written once along each path
  apps/e2e/tests/studio/wiki.spec.ts › a wiki of the bookstore › the pages list in the view's order
  apps/e2e/tests/studio/wiki.spec.ts › the wiki Overview counts the relations between its pages
  packages/common/tests/wikiDocument.test.ts › shared wiki document › counts the relations between its own pages
then: "the overview lists Needs (3) and counts 10 elements; the need's page has Requirements (2) with Four-eyes approval as a chapter; a chain that loops is searched without a crash and each path is written once; the pages list in the view's order; the Overview counts the relations between the wiki's own pages"
when: "the user starts its steps with Need and adds Refined into → Requirement, then opens Corporate treasurer feedback"
---
