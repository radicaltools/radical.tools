---
id: "689dc734-cb4f-4fb6-9bc1-9ad13ef7ea6c"
type: "scenario"
label: "Agent builds a deck"
given: "a model with a system inside a view, its containers, and a milestone"
then: "each slide keeps its view, milestone and focus, a kept slide its view and framing when no viewId is given; a slide framed in Studio keeps its camera until its focus or milestone changes; focus elements outside the view, a focus on a slide with no canvas, unknown views and milestones, and a slide listed twice are refused; a slide of a milestone may show and focus on what that milestone's views draw, a view it has alone included"
when: "an agent creates, renames and updates presentations whose slides show a view, a milestone or focus elements, and deletes one"
---
