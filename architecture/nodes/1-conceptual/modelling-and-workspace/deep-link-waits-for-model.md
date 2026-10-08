---
id: "33ed83f4-5df3-42a3-a5d8-cce2ddabc6ac"
type: "requirement"
label: "Deep link waits for model"
action: "Studio shall keep the link in the URL and apply its perspective, view, element, milestone and slide once the document has loaded."
ears_type: "state-driven"
precondition: "the document a deep link names is still loading from a file or folder, or is a browser folder waiting for Reconnect"
rationale: "Files and folders load after the first paint, and loading resets the view; without waiting, a reload or a shared link of a folder model landed on the default Structure view. Evidence: apps/studio/src/renderer/src/route.ts:239-247,279-293; apps/studio/src/renderer/src/persistence/autosave.ts:21-42; apps/e2e/tests/studio/folders.spec.ts; manual#links"
---
