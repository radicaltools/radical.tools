---
id: "8e6cb8ff-9dd0-4927-b439-e9e001b29599"
type: "scenario"
label: "Move into descendant refused"
gherkin: "# Covered by: packages/ui/tests/model.test.ts › reparentNodes › refuses a move into a descendant with a notification, leaving the tree unchanged"
given: "a container with a child selected"
then: "a notification refuses the move and the tree is unchanged"
when: "Studio is asked to move the container into its own child"
---
