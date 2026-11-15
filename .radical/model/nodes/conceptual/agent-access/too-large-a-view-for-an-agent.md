---
id: "e7d647ab-5d23-4bf1-8270-f19f504742ee"
type: "scenario"
label: "Too large a view for an agent"
given: "a folder model with a view whose filter shows 1,001 requirements, and one that lists 1,000"
then: "each call on the first is refused, saying the view shows 1,001 elements and a canvas draws up to 1,000, and views.json is unchanged; the second is taken"
when: "an agent calls smart_layout, align_nodes and grid_nodes on the first, then grid_nodes on the second"
---
