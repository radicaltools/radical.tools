---
id: "963cba85-ed07-4171-ab9c-e8038d2fd528"
type: "requirement"
label: "Toolbar grouped as VS Code"
action: "Studio shall group its toolbar as VS Code does: after the Radical logo, Undo and Redo as icons in one group (Designer only); back and forward in one group just before Quick Search and History just after it, both kept clear of it as its width follows the window's (300 to 520 pixels), meeting in the middle where Quick Search is not shown (the Inspector); and Changes on branch beside the perspective switch on the right."
ears_type: "ubiquitous"
rationale: "The user asked on 2026-10-22 for the toolbar's buttons grouped better (back, forward, History, Changes on branch, Undo, Redo) and chose the VS Code arrangement over two groups on the left or groups with labels: navigation is where VS Code has it, around the search; Changes on branch is the model's state on the branch, beside the perspectives and the Inspector. Evidence: apps/studio/src/renderer/src/components/Toolbar.tsx (toolbar-group, toolbar-center), apps/studio/src/renderer/src/components/NavHistory.tsx (NavArrows, NavList), apps/studio/src/renderer/src/studio.css (--qs-w, .toolbar-center, .toolbar-group); manual#workspace"
---
