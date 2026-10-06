---
id: "21964cbd-6238-43e1-a8a9-80bc13ccb696"
type: "fitness-fn"
label: "Workspace boundaries"
category: "structural"
threshold: "npm run check:workspaces passes in CI"
---

tools/check-workspaces.mjs fails when an app imports another app or a package imports an app.
