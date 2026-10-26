---
id: "71bc5a05-e9c1-4ec9-9440-a06d43d9fea5"
type: "requirement"
label: "Commands in search"
action: "Studio shall list the commands of the toolbar, the activity rail and the canvas whose names match the words after it, each with its shortcut, and run the one picked; a command that does not apply to the perspective shown is not listed"
ears_type: "event-driven"
rationale: "Every action is reachable from the keyboard without knowing where its button is, as in VS Code. Evidence: apps/studio/src/renderer/src/commands.ts; apps/studio/src/renderer/src/components/Toolbar.tsx"
trigger: "the user types > first in Quick Search"
---
