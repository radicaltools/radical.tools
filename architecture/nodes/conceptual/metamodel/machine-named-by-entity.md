---
id: "3900f901-763c-4c03-9d68-b239a7a1e7e1"
type: "scenario"
label: "Machine named by entity"
given: "the Order state machine, the lifecycle of the Order entity"
metrics: "test(apps/e2e/tests/studio/state-machines.spec.ts › a machine is named after the entity it is the lifecycle of) passed"
then: "the machine reads \"State machine · Order\" and the entity reads \"Aggregate root\""
when: "the user opens the view showing them"
---
