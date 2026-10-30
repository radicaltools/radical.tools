---
id: "e422f258-b25b-4560-8e4b-1bfc98c802c8"
type: "fitness-fn"
label: "Concern packs pass check"
category: "structural"
metrics: "test(packages/hub-catalogue/tests/concernPacks.test.ts › concern packs › every pack imported and bound passes radical check) passed"
---

packages/hub-catalogue/tests/concernPacks.test.ts imports every concern pack of the catalogue into a small model that its trigger fires on, binds it to an element the trigger finds, and runs runCheck from @radical/common/check with the packs.

Threshold: For every concern pack: its trigger finds at least one element of the test model; after the bound import, concern-unaddressed no longer reports the pack's concern, and no rule other than scenario-without-metrics and fitness-fn-without-metrics reports anything the import brought in.
