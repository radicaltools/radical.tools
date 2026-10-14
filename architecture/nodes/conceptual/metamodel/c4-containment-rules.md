---
id: "2afd5639-ba40-4d52-bbc5-67d2488e7706"
type: "requirement"
label: "C4 containment rules"
action: "The C4 preset shall allow a person at the root or in a group, a system at the root or in a system or group, containers, databases, web apps and queues in a system or group, components in a container, web app or group, and groups at the root, in a group or in a system, and shall let a group hold only what its place allows: at the root what may be at the root, inside a system what a system can hold at any depth."
ears_type: "ubiquitous"
rationale: "These are the C4 levels; groups are purely organisational and may gather parts of a system, as in Structurizr, but give no place an element could not have without them (a component does not go into a group at the root). Evidence: packages/common/src/metamodel/presets/c4.ts:68-117, packages/common/src/metamodel/lookup.ts (isPlacementAllowed), packages/common/tests/c4Containment.test.ts; manual#elements"
---
