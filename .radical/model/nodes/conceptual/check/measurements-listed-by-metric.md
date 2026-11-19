---
id: "a22e6b24-aa46-4a60-ab4a-8a5cda3ce822"
type: "scenario"
label: "Measurements listed by metric"
given: "a folder model with a fitness function stating two metric conditions, the latency measured above its threshold two hours ago by the json sensor and the error rate measured within its threshold, and a scenario stating a metric condition nothing measured"
then: "the tab lists each metric with its measurement's labels, value, unit, source and age; under the latency the fitness function with its condition marked failed and under the error rate the same fitness function marked passed; the scenario's condition under Not measured; the filter leaves one metric; the address ends in i/measurements and the tab's card counts the measurements"
when: "the Inspector's Measurements tab is opened, then a metric's name is typed into the filter"
---
