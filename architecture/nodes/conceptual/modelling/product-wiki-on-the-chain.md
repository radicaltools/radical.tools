---
id: "c89b3768-b14b-4baa-82d4-db52e9724720"
type: "scenario"
label: "Product wiki on the chain"
given: "the sample model's Product Wiki, one article (Multi page)"
tests: "apps/e2e/tests/studio/view-pipeline.spec.ts › a wiki view follows the same chain: needs on the overview, their requirements as chapters"
then: "the overview lists Needs (3) and counts 10 elements; the need's page has Requirements (2) with Four-eyes approval as a chapter"
when: "the user starts its steps with Need and adds Refined into → Requirement, then opens Corporate treasurer feedback"
---
