---
id: "21964cbd-6238-43e1-a8a9-80bc13ccb696"
type: "fitness-fn"
label: "Workspace boundaries"
category: "structural"
threshold: "npm run check:workspaces passes in CI"
---

tools/check-workspaces.mjs fails when a package imports an app, when an app imports an app not listed in APP_TO_APP, on relative imports across workspaces and on undeclared (phantom) dependencies.
