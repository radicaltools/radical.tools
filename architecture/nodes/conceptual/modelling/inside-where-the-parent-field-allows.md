---
id: "63bbcb30-428f-442a-853b-3f5f9091face"
type: "scenario"
label: "Inside where the Parent field allows"
given: "the bookstore's Containers view with the external Payment Provider, a group Shoppers holding Customer, a group Staff, and a Clerk at the top"
tests: |
  apps/e2e/tests/studio/nesting.spec.ts › the special key › offers "inside" only where the card's Parent field would let the elements go
  apps/e2e/tests/studio/nesting.spec.ts › the special key › a take-out the metamodel refuses says why, naming the allowed parents and the elements refused
  packages/common/tests/nestRefusal.test.ts › where elements may be nested (nestRefusal) › refuses an external element, as the card does
  packages/common/tests/nestRefusal.test.ts › where elements may be nested (nestRefusal) › refuses a group whose contents would have no place there
  packages/common/tests/nestRefusal.test.ts › where elements may be nested (nestRefusal) › takes elements of different parents, each checked with its siblings
  packages/common/tests/nestRefusal.test.ts › where elements may be nested (nestRefusal) › leaves out those already there
  packages/common/tests/nestRefusal.test.ts › where elements may be nested (nestRefusal) › gives the card the same list as before: every parent it takes, and the one it is in
  packages/common/tests/nestRefusal.test.ts › a move into an external element (checkReparent) › is refused by the engine too, so the store and move_node refuse what the card does not offer
  packages/common/tests/nestRefusal.test.ts › a move into an external element (checkReparent) › leaves what an external element already holds where it is
then: "\"inside\" appears only where the card's Parent field would let the elements go, never on the external Payment Provider nor on a group whose contents would have no place there; a take-out the metamodel refuses leaves the elements where they are and says why, naming the allowed parents and the elements refused; the engine, the store and move_node refuse a move into an external element and leave what it already holds where it is"
when: "the user selects API with the special key held, and drags containers and people onto the empty canvas with it; and the engine checks where elements may be nested and where move_node may put them"
---
