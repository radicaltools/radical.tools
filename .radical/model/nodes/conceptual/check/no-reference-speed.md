---
id: "f1cf2267-82df-4cd3-860d-c0b5df01dda0"
type: "requirement"
label: "No reference speed"
action: "the machine sensor shall measure nothing and say to run radical sense machine --reference on the machine the limits were set on"
ears_type: "unwanted-behaviour"
rationale: "A speed without its reference means nothing; a factor of 1 would hide the problem. ADR Limits scaled to the machine."
unwanted_condition: "the machine sensor runs and the repository has no reference time"
---
