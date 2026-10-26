---
id: "d5067236-a05e-4d95-a09c-2d5e0a6b7ce2"
type: "scenario"
label: "Activity rail tabs and menus"
given: "the bookstore System Context view in Designer, with Views open on the left"
tests: |
  apps/e2e/tests/studio/editing.spec.ts › the left panel's sections are tabs on the activity rail, one open beside it, and say what they hold
  apps/e2e/tests/studio/editing.spec.ts › the activity rail keeps the app's menus in the metamodel editor, without the panel's sections
  apps/e2e/tests/studio/about.spec.ts › About Radical Studio › the folder on the toolbar opens Models, beside the model open, and About is under Settings
  apps/e2e/tests/studio/editing.spec.ts › the activity rail's menus open over the metamodel editor, which stays open
  apps/e2e/tests/studio/editing.spec.ts › Settings stays at the activity rail's foot where the rail has no sections
  
then: "the panel folds with the rail still there and Views no longer selected, and opens again on Views; the chevron folds it and is gone while it is folded; it opens on Milestones from folded, and ↓ opens Sequences; each tab shows its count and on hover Views says 'Open: System Context' and Milestones its latest milestone or that none is saved; Models is the folder at the toolbar's left, beside the model open and where it is kept; in the metamodel editor the rail has Settings only, at its foot, and no sections, Settings marks the metamodel editor open and holds AI and Export, and Models and Settings open their menus over the editor, which stays open; the folder on the toolbar opens Models, and About is under Settings"
when: "the user clicks Views twice, folds the panel with the chevron and opens it from Views, folds it again and clicks Milestones, presses ↓; opens the metamodel editor from Settings; and clicks the folder on the toolbar"
---
