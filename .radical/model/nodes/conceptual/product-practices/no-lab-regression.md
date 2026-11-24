---
id: "d6fa7162-c43f-4a78-9f84-2b2a9c6f20a0"
type: "requirement"
label: "No lab regression"
action: "keep the Largest Contentful Paint of every main page, in the median of three Lighthouse runs for phones and desktops, within 10% of the median of the latest seven nights, its Total Blocking Time within 50 ms of it, and its Cumulative Layout Shift under 0.25 on phones and 0.1 on desktops"
ears_type: "event-driven"
rationale: "radical.tools' front ends start above the budget on phones (the Hub and Studio), so they are held to no regression first. The 50 ms margin and the limits 0.25 and 0.1 are the model's decision: several pages have a Total Blocking Time and a layout shift of 0 today, where a margin in percent leaves no room, and the Hub's 0.206 on phones is today's worst."
trigger: "the front ends of main are measured every night"
---
