---
id: "7a9b2f9f-fb04-447f-ad71-29beaebfda8f"
type: "scenario"
label: "VB6 references read once"
given: "a VB6 project referencing ADO by its type library and its name on one line, and DirectX 8, with a file description in its version information"
then: "each reference is one dependency, named for its library, DirectX is among the unit's technologies, and the unit's description is its file description"
when: "Assay reads it"
---
