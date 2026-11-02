---
id: "63bbcb30-428f-442a-853b-3f5f9091face"
type: "scenario"
label: "Inside where the Parent field allows"
given: "the bookstore's Containers view with the external Payment Provider, a group Shoppers holding Customer, a group Staff, and a Clerk at the top"
then: "\"inside\" appears only where the card's Parent field would let the elements go, never on the external Payment Provider nor on a group whose contents would have no place there; a take-out the metamodel refuses leaves the elements where they are and says why, naming the allowed parents and the elements refused; the engine, the store and move_node refuse a move into an external element and leave what it already holds where it is"
when: "the user selects API with the special key held, and drags containers and people onto the empty canvas with it; and the engine checks where elements may be nested and where move_node may put them"
---
