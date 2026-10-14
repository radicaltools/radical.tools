---
id: "5b977950-da54-41fa-b2ff-f2d3836996a5"
type: "requirement"
label: "Reload launch file"
action: "the desktop app shall open that file as the active model and reload it whenever it changes outside the app, ignoring the echo of its own writes."
ears_type: "complex"
feature: "the desktop app is launched with --file <path> or the RADICAL_FILE environment variable"
rationale: "Works next to a text editor or a git checkout of a single model file. Evidence: apps/studio/src/main/index.ts:33-43,154-156,225-242; apps/studio/src/renderer/src/persistence/autosave.ts:265-302; manual#documents"
trigger: "that file changes on disk"
---
