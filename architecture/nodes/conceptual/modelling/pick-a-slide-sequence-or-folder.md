---
id: "ee4640ad-5252-4acf-8467-9bee0bf2e1e6"
type: "requirement"
label: "Pick a slide, sequence or folder"
action: "Studio shall open Presenter on the presentation and show the slide (Shift+Enter plays the presentation from it), open the flow view that plays the sequence or, without one, the sequence in the Sequences list, show the milestone, and open the list of views on the folder, unfolded and in sight"
ears_type: "event-driven"
rationale: "A hit is only useful if the pick lands where the thing is used. Evidence: apps/studio/src/renderer/src/components/QuickSearch.tsx (pickResult); packages/ui/src/components/RightPanel.tsx (revealViewFolder)"
trigger: "the user picks a presentation, slide, sequence, milestone or folder hit in Quick Search"
---
