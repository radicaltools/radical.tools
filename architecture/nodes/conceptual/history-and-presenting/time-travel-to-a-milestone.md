---
id: "912de6dd-0fe6-47e0-9279-060dae3778e0"
type: "requirement"
label: "Time travel to a milestone"
action: "Studio shall show the model as it was at that milestone in every view, keep the live model aside, and name the milestone in a chip on every kind of view (at the top of a canvas, at the bottom left of a table, wiki, hierarchy, matrix or Warnier view) that offers Propagate, New milestone and Discard once the milestone is edited; over a playing slide the chip names the milestone the slide shows, none over a slide that shows the live model, without its buttons, and F5 does not start while the question how to keep the milestone's edits is open; a slide card clicked in Presenter makes its slide's milestone the one shown, none for a slide of the live model or of its own copy; a milestone saved without sequences shows none."
ears_type: "event-driven"
rationale: "Looking at a past state must work like looking at the current one, without touching current work. With a milestone open, a slide playing the live model was named as that milestone, with its diff and Propagate (round 170–175, 2026-10-22, F-0027). Evidence: packages/ui/src/store/diagramStore.ts (selectMilestone, milestoneOnCanvas); packages/ui/src/components/Canvas.tsx; apps/studio/src/renderer/src/components/SequenceView.tsx; packages/ui/src/components/RightPanel.tsx; packages/ui/tests/milestones.test.ts; manual#milestones"
trigger: "the user clicks a milestone in the Milestones list"
---
