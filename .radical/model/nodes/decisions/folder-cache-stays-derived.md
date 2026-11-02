---
id: "d517e522-37fe-40d1-bd4b-3754a1d75366"
type: "fitness-fn"
label: "Folder cache stays derived"
cadence: "triggered"
characteristic: "reliability"
invocation: "automated"
scope: "atomic"
trigger: "pull-request"
---

The cache in .state/cache/model.json repeats the model files and is never their source: a folder opens the same with it, out of date, broken, of another version or gone, and only a model's folder gets one. Checked by the session's tests over a folder in memory and on disk.
