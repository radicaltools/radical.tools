---
id: "da4297b3-b059-404f-940e-dfabd6f74b3a"
type: "scenario"
label: "Refinements of a stage found"
given: "the model before a Processes stage and the model after it"
then: "the refinements are the requirement, the link, the changed scenario with its old values and the deleted entity, not the process, its steps or the move; rejecting them removes the requirement and the link and restores the scenario, and the deleted entity cannot be rejected"
when: "the stage added a process with steps, a requirement and a link between two earlier elements, changed a scenario, moved a node, and deleted an entity"
---
