---
id: "8b80323b-bc76-47f1-a6ba-90e82e06a6b0"
type: "requirement"
label: "Survey failures into findings"
action: "the CLI shall go on after each failure, record every failure whose signature no open finding has as a finding file in the findings folder (status open, source fuzz, the rule, the signature, the file, the world, the seed, the path and length that replay it, the steps as resolved, what differs, the commit and the day), say which findings it wrote, and record no signature twice"
ears_type: "event-driven"
rationale: "A survey run finds many failures in one go; each becomes a record that is fixed, decided or kept known, and none is lost in a log."
trigger: "the user runs radical fuzz with --survey"
---
