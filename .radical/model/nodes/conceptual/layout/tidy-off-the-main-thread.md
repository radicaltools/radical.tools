---
id: "d207805a-9ed4-49ad-972f-a607aca2ec03"
type: "requirement"
label: "Tidy off the main thread"
action: "Studio shall run Tidy in a worker, show the move under way in a line above the canvas controls while the Smart Layout button reads Stop at the width and place of its idle label (the controls beside it stay where they are), let the user stop it with that button (the canvas then stays as it was), and apply what was done when its budget, counted in work, runs out, saying how many moves were made (\"run it again for more\")."
ears_type: "event-driven"
rationale: "A large view would freeze Studio for the seconds Tidy takes; the ensemble already runs off the thread with progress. The button showed the move under way in its label, so it grew and shrank with every move and the controls beside it moved (round 185–192, 2026-10-26, F-0083); a budget in milliseconds gave a slower machine another layout (F-0080). Evidence: packages/ui/src/components/SmartLayoutButton.tsx, packages/ui/src/layout/tidy.worker.ts, packages/layout/src/tidy/index.ts (TIDY_BUDGET, tidySummary)"
trigger: "the user runs Smart Layout in Auto mode on a view"
---
