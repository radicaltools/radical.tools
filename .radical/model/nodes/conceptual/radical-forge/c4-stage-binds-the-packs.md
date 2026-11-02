---
id: "92717ef2-db55-4e2b-9b4d-0fa039192605"
type: "requirement"
label: "C4 stage binds the packs"
action: "give the model the imported pack decisions to link, each to the elements it is about, and afterwards bind every pack decision that still constrains nothing to the elements its trigger suggests, saying so in the stage's summary"
ears_type: "event-driven"
rationale: "The model knows which container does the work; the trigger's suggestion catches what it left. ADR Forge settles concerns, C4 binds them."
trigger: "the C4 model stage of Radical Forge is generated"
---
