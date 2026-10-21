---
id: "61df9f6e-f826-4468-bdeb-20fd32832b55"
type: "requirement"
label: "Choose the relations to expand"
action: "the system shall open, beside the +, a menu with Show all and the count of neighbours not shown yet on top, and below it two columns: \"<element> → others\" (outgoing) and \"others → <element>\" (incoming), each listing the relation types that join the element to neighbours not shown yet in that direction with their counts, contains (the element's children) last in the outgoing column and contained in (its parent) last in the incoming one; a click on a row adds the neighbours of that type and direction at once, and check boxes with Show checked add several rows together; what is added goes on the level below, and the relations drawn are those of the rows chosen, a parent and its child joined by a dashed arrow from the parent to the child labelled contains, drawn like a relation but never saved"
ears_type: "event-driven"
rationale: "Asked for on 2026-10-21: \"when I click + I want to choose the relations: all, a specific one, or a group of relations\"; settled: by relation type, several at once, by direction. Containment is the relation contains from parent to child: the parent is incoming, the children outgoing. Then: \"Rework the popup with All and both, outgoing and incoming, it is not very intuitive\"; settled: two columns by direction, no direction switch."
trigger: "the user clicks the + of an element in an explore view"
---
