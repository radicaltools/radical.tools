---
id: "a11d235e-6f54-4228-89b6-085e05074674"
type: "scenario"
label: "Keys and focus in discussions"
given: "a node's discussion panel open in a folder model, with a comment being written"
tests: |
  apps/e2e/tests/studio/web-discussions.spec.ts › F5 and Cmd/Ctrl+P pressed in the comment field are taken as in any dialog of Studio
  packages/ui/tests/keysHere.test.ts › keys kept in a panel or a field › lets F5 and Cmd/Ctrl+P go on to Studio and keeps every other key
  apps/e2e/tests/studio/web-discussions.spec.ts › the focus stays in the discussion panel after Post comment, Resolve thread and Start a new thread instead
then: "Studio takes both keys: the page is not reloaded nor printed, and the draft stays in its field with the focus; after each action the focus stays in the panel, so Escape closes it"
when: "the user presses F5 and Cmd/Ctrl+P in the comment field; then posts the comment, resolves the thread and chooses Start a new thread instead"
---
