---
id: "7d1f9c2f-02a1-4ef9-a7e3-0f7a625b875d"
type: "scenario"
label: "Studio follows the agent's turns"
given: "a folder model open in Studio on All elements, with a blank view that shows every element, a view of Payments and a view of Ledger, and Follow the agent switched on"
tests: |
  apps/studio/tests/followAgent.test.ts › follow the agent
  apps/e2e/tests/studio/folders.spec.ts › an agent's Forge run on the folder makes the Forge button pulse and opens read only
then: "Studio stays on All elements while no view but the blank one shows Billing; once the Ledger view lists it, Studio opens that view and frames Billing, then Billing again; after the user's move it leaves the camera alone; after the pause it frames the latest system; once the run finishes following is off"
when: "an agent adds Billing, then lists it in the Ledger view, then changes Billing, then the user moves the camera and the agent adds another system to that view, then the agent pauses and adds one more, and the run finishes"
---
