---
id: "5e7a13e2-3621-425f-837f-3e54ea24edfd"
type: "scenario"
label: "Wrap siblings into system"
gherkin: |
  And Wrap into… lists only types the metamodel allows there
  # Not covered by an automated test
given: "two sibling Containers selected inside a Software System"
then: "a new container of that type surrounds both and becomes the selection"
when: "the user picks a container type under Wrap into…"
---
