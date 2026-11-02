---
id: "f033a185-e4dd-402d-bd49-cbd05da3a084"
type: "requirement"
label: "Built-in viewpoints of one element"
action: "The Radical metamodel shall bring the viewpoints State machine (a structure view of one state machine: its states, pseudostates and transitions, and the entity it is the lifecycle of), Process (a Warnier view of one process and its steps), Containers of a system (a structure view of one software system: its containers, web apps, databases and queues, and the people, systems and containers they are related to), Components of a container (a structure view of one container or web app: its components, and the elements they are related to) and Entities of a domain (a structure view of one domain: its entities, and the entities of other domains they reference or are part of); and the C4 metamodel shall bring Containers of a system and Components of a container."
ears_type: "ubiquitous"
rationale: "The diagrams a team reads one at a time get a viewpoint each; the whole-model ones (Containers, Components, Process (Warnier), Domain model) stay beside them. Evidence: packages/common/src/metamodel/presets/viewpoints.ts"
---
