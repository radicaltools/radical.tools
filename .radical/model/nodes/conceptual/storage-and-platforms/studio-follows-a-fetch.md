---
id: "9a804e04-1239-4d62-b930-b6b1ca8f8c67"
type: "requirement"
label: "Studio follows a fetch"
action: "Studio shall show the other models as fetched now, keeping the edits not saved yet"
ears_type: "event-driven"
rationale: "Two copies are safe only while something keeps them in step; a folder is acted on once it has been still for one interval, as an editor writes a model in several files. Only a model opened with a deps.json was followed, so a setup and fetch made after it was opened reached it only on a reload (F-0118, round 201–210). Evidence: apps/cli/src/federation.ts (watch); apps/studio/src/renderer/src/store/documentStore.ts (followFederation)"
trigger: "deps.json or .state/federation.json changes while Studio has a folder model open, also one opened without deps.json, or after its deps.json was removed and added back"
---
