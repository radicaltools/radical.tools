---
id: "946585b8-7f52-429a-a205-5622a88667ab"
type: "requirement"
label: "No saving while exploring"
action: "Studio shall not save model or layout changes, and shall save only changes to presentations and slides."
ears_type: "state-driven"
precondition: "the Viewer or Presenter perspective is active"
rationale: "Exploration is ephemeral, but a slide deck built in Presenter is real work. Evidence: apps/studio/src/renderer/src/persistence/autosave.ts:76-110; apps/studio/tests/viewerSandbox.test.ts:195; manual#presenting"
---
