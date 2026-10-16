---
id: "5af5eb12-a22c-45fa-bc72-2e71819d269f"
type: "requirement"
label: "Open panel section folds"
action: "Studio shall fold that section when it is open, and otherwise open it, give it the panel's free height, and fold the other sections, each folded header showing its icon, name, count and one line on what it holds (the open view, the latest milestone, the sequences' names)."
ears_type: "event-driven"
rationale: "Before, an open section folded only when another one was opened, so a panel could not show its sections all closed; folded headers that only named their section left a bare panel, so each now says what it holds. Evidence: packages/ui/src/components/RightPanel.tsx (AccordionSection, openSection in LeftPanel), packages/ui/src/index.css (.lp-section-*), apps/e2e/tests/studio/editing.spec.ts"
trigger: "the user clicks the header of a section in the left panel (Views, Milestones, Sequences)"
---
