---
id: "21702e45-b75b-4a3b-978b-0976e4e9a33a"
type: "need"
label: "Read descriptions on hover"
kind: "stakeholder-note"
source: "User discussion, 2026-10-17"
---

Inspired by strategy games, I want a component's or relation's description to appear in a popup when I keep the pointer over it for about 1.5 seconds, without clicking. This would let relation labels stay short, even one word, while the explanation appears when I pause to read it.

**Proposed approach:** Use a shared delayed description popup for canvas elements and relation lines or labels. Cancel the timer when the pointer leaves, hide the popup when the interaction ends, and show nothing when the description is empty.
