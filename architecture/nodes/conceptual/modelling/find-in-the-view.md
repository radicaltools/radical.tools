---
id: "ca229a9e-e250-49b7-90ce-011d16b48a28"
type: "requirement"
label: "Find in the view"
action: "Studio shall open a find bar over the view that counts the elements of the view matching the typed words, dims the other elements and relations on a canvas and the other rows on a table, selects the next or previous hit with Enter or Shift+Enter (opening its collapsed containers and bringing it into sight), and on Escape closes and leaves the hit selected; on a wiki it moves to the wiki's own search box"
ears_type: "event-driven"
rationale: "Searching the nodes of a view was asked for by the product owner on 2026-10-26; the browser's find does not see a canvas. Evidence: apps/studio/src/renderer/src/components/FindInView.tsx; packages/ui/src/store/canvasFocus.ts (find hits); packages/ui/src/components/TableView.tsx"
trigger: "the user presses Cmd/Ctrl+F on a view, outside a dialog and a running presentation"
---
