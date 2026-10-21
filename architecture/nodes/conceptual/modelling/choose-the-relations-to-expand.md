---
id: "61df9f6e-f826-4468-bdeb-20fd32832b55"
type: "requirement"
label: "Choose the relations to expand"
action: "the system shall open a menu with All and the count of neighbours not shown yet, a direction switch (outgoing, incoming, both; both by default) and every relation type that joins the element to a neighbour not shown yet with its count in the direction chosen, each with a check box, followed by Parent (the element's container) and Children (the elements it holds) with their counts; containment is outgoing and incoming at once (the element is part of its parent, and the parent contains it), so Parent and Children are listed and counted in every direction; All adds every such neighbour at once, parent and children included, and Show adds the neighbours joined by what is checked, as the + otherwise does; the relations drawn are those of the types and direction chosen, and a parent and its child are joined by a dashed arrow from the parent to the child labelled contains (incoming at the child), drawn like a relation but never saved"
ears_type: "event-driven"
rationale: "Asked for on 2026-10-21: \"when I click + I want to choose the relations: all, a specific one, or a group of relations\"; settled: by relation type, several at once, with a direction. Then: \"Explore from here should also show that something is a parent or a child, as the next level, because child/parent is a relation too.\""
trigger: "the user clicks the + of an element in an explore view"
---
