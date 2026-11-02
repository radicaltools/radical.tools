---
id: "cd07ab8a-2e59-4d07-9468-cc5ff6b26359"
type: "scenario"
label: "Every view shows its filter"
given: "the sample model's Requirements Traceability view, 23 elements; and a model of domains, needs, requirements and scenarios"
then: "the canvas draws 10 elements and the 7 derives lines, requirements alone no line until every relation is asked for, and the 23 elements after Reset; the matrix rows follow each change to the chain and to the model; the hierarchy, table and wiki show the same chain, and the hierarchy more without it; every kind shows the chain's elements and not the containers they sit in, which a canvas holds invisible with no line ending at them"
when: "the user starts its filter with Need and adds Refined into → Requirement; starts with Requirement alone and asks for every relation; resets; then, with a text filter on the requirements, switches the view to Matrix, adds Verified by → Scenario, renames a requirement out of the filter, and switches to Hierarchy, Table and Wiki"
---
