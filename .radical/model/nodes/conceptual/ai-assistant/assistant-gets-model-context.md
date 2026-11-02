---
id: "6978d003-7ad0-4676-b2ec-98bcdb8a3bb5"
type: "scenario"
label: "Assistant gets model context"
given: "a model with nodes, relations, views and an active metamodel"
then: "the system messages are the rules prompt, which names the metamodel and allowedParents, and a metamodel message listing each type's properties; every round's last message carries a fresh \"Current diagram state\" snapshot with labels, governance properties, relation types and view kinds but no x, y, width or height"
when: "the AI assistant sends a request round to the provider"
---
