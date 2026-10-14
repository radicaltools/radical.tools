---
id: "09adfbab-2099-47fe-a678-84404152ebb7"
type: "requirement"
label: "Manual lands on section"
action: "The manual shall bring that section to the top again once the web fonts have loaded, unless the reader has scrolled meanwhile."
ears_type: "event-driven"
rationale: "Font reflow would otherwise leave the reader above or below the linked section. Evidence: apps/web/manual.html (inline script)"
trigger: "a reader opens the manual with a link to one of its sections (#section)"
---
