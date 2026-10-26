---
id: "8bd22e2d-3965-4632-8ab6-43f512434c3f"
type: "scenario"
label: "A line enters its ends only at its ports"
given: "the sample's Authorization view: lines from 'Denied by default' and 'Checked on each record' to 'Everyone sees only theirs'"
tests: "packages/layout/tests/edgeRouting.test.ts › routes around nodes › never runs through its own ends: a line enters the elements it joins only at its ports"
then: "each line enters the elements it joins only at its port, never through the rest of them"
when: "the relations are routed"
---
