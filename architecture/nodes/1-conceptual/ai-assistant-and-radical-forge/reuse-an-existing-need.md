---
id: "dbc05b95-40d5-4333-9683-585b1d4028f7"
type: "requirement"
label: "Reuse an existing need"
action: "Radical Forge shall write the edited description back to that need instead of adding another need."
ears_type: "state-driven"
precondition: "the Forge run is bound to a need, because the user picked one under Start from or already started once"
rationale: "Rerunning or refining the brief must not litter the model with duplicate needs. Evidence: apps/studio/src/renderer/src/components/RadicalForgeModal.tsx:484-492,540-546,673-698; manual#forge"
---
