---
id: "31be950d-eb79-46ca-8d2b-2c7adebeb4e4"
type: "requirement"
label: "Measurements tab"
action: "list every measurement beside the model (what radical sense kept in .state/measurements.json and the reviews recorded), grouped by metric with its unit, each measurement with its labels (an element label as a link to the element), its value, its source and how long ago it was measured, newest first within a metric, and narrow the list by a text typed into a filter, matched against the metric, the labels, the source and the names of the elements that read it"
ears_type: "event-driven"
rationale: "Until now a value showed only on the card of the one scenario or fitness function that reads it and the Measurements chip gave a count: there was no place to look over what the sensors measured. A tab beside Overview, Model, Implementation and This branch keeps the Inspector's one way of working (Inspector is a place of the rail). Evidence: apps/studio/src/renderer/src/components/inspector/MeasurementsTab.tsx, components/Inspector.tsx, navigation.ts (INSPECTOR_TABS)"
trigger: "the Inspector's Measurements tab is picked (a card of its list in the left panel, the route segment i/measurements)"
---
