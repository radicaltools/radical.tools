---
id: "06d24c7c-b096-4aeb-b0be-e119b01cd902"
type: "requirement"
label: "Verification path panel"
action: "the Inspector shall open a panel of its own that draws, in columns from the root to the results, every path through that element: need, requirement (a requirement derived from another one column further), scenario and the tests bound to it; or ADR, fitness function and its tests and metric conditions, a fitness function measured for each element its ADR constrains with each such element; every element and result with its status, the element asked for marked, failing branches first; a click on an element of the model makes the path that element's, Back returns to the path before, and Details opens its card beside the path; from Designer or Viewer Studio switches to the Inspector on the path and Back returns to the canvas; Path is greyed out, saying why, while the Inspector is (no test results, measurements or base beside the model)"
ears_type: "event-driven"
rationale: "Checked by shows one step down and nothing above it: from a failing test one cannot see which need it takes down, nor from a need which test fails it (the user, 2026-11-14). Tests and metric conditions are no elements of the model (ADR Tests are bound outside the model), so a temporary view on the canvas could not draw them; a panel can. The user wants the path from the properties card in the ordinary perspectives too, not only from the Inspector (2026-11-14)."
trigger: "the user asks for the verification path of a need, requirement, scenario, ADR or fitness function: Path in the Verification section of its properties card, in Designer, Viewer or the Inspector"
---
