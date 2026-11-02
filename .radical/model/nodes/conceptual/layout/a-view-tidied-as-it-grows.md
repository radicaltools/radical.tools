---
id: "d4cfd6d4-6a5c-489b-8dc4-0e582571f31b"
type: "scenario"
label: "A view tidied as it grows"
given: "a tidied view with continuous layout on and one element pinned where the author dropped it"
then: "the element dropped from the palette stays where it was dropped, not pinned, and moves only with the next change; after each add the whole view is tidied round the pinned element, which stays where it is, and the elements glide to their places; the undo puts back the view as it was before the add, and nothing moves after it; switching the setting on tidies the view at once and saves it with the view"
when: "the author drops an element from the palette, then relates it to another, adds an element and a relation to it, an agent adds another through the MCP server, then the author undoes the add"
---
