---
id: "d4cfd6d4-6a5c-489b-8dc4-0e582571f31b"
type: "scenario"
label: "A view tidied as it grows"
given: "a tidied view with continuous layout on and one element pinned where the author dropped it"
metrics: |
  test(packages/ui/tests/continuousLayout.test.ts › Continuous layout › leaves an element dropped from the palette where it lands, this once) passed
  test(packages/ui/tests/continuousLayout.test.ts › Continuous layout › tidies the whole view after an add, pins kept, in the add's undo step) passed
  test(packages/ui/tests/continuousLayout.test.ts › Continuous layout › undo, redo, a view switch and a move tidy nothing) passed
  test(packages/ui/tests/continuousLayout.test.ts › Continuous layout › an outside reload that adds an element tidies the view) passed
  test(packages/ui/tests/continuousLayout.test.ts › Continuous layout › switching it on tidies the view and is saved with it) passed
  test(apps/mcp/src/folderModel.test.ts › continuous layout › create_view and update_view set it on a view, saved in the folder and told in the summary) passed
  test(apps/e2e/tests/studio/layout.spec.ts › continuous layout glides the view into place after an add) passed
then: "the element dropped from the palette stays where it was dropped, not pinned, and moves only with the next change; after each add the whole view is tidied round the pinned element, which stays where it is, and the elements glide to their places; the undo puts back the view as it was before the add, and nothing moves after it; switching the setting on tidies the view at once and saves it with the view"
when: "the author drops an element from the palette, then relates it to another, adds an element and a relation to it, an agent adds another through the MCP server, then the author undoes the add"
---
