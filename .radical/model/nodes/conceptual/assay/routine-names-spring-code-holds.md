---
id: "7e4c3b87-1423-49cc-8032-2c08dcda4f1a"
type: "scenario"
label: "Routine names Spring code holds"
given: "a Spring app naming a procedure in a variable, its package through a configured field's getter, a StoredProcedure subclass joining both with Joiner, a named stored procedure query, a ? := block and a call in a comment, beside a Svelte page whose script selects a function and whose markup shows another"
then: "the calls are hr_utils.get_regions, hr_utils.get_departments, hr_utils.remove_employees, employeeprocedure and refuel_ship, none from the comment or the markup"
when: "Assay reads it"
---
