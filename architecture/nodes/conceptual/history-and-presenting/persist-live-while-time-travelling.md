---
id: "681b9604-2215-4597-9f21-7a6081aa017b"
type: "requirement"
label: "Persist live while time-travelling"
action: "Studio shall save the live model and its layout, not the content of the shown milestone; write nothing when a milestone is opened and left for the live model without an edit; and, in the browser, ask before the page is left or reloaded while the milestone has unsaved edits, keeping them when the user stays."
ears_type: "state-driven"
precondition: "a milestone is shown"
rationale: "Looking at the past must never overwrite current work, even if the app reloads. Exploratory runs 65 to 69 (2026-10-21, item 233) found that opening a milestone and going back wrote the model, and the maintainer decided that leaving the page with unsaved edits of a milestone asks first in the browser (the desktop app and VS Code would block closing silently). Evidence: packages/ui/src/store/diagramStore.ts:4179-4206; apps/studio/src/renderer/src/persistence/autosave.ts (load settling, beforeunload); packages/ui/tests/milestones.test.ts:109-133"
---
