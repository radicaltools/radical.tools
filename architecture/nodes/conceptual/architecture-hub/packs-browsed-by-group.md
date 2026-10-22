---
id: "802e66fd-e758-467d-a730-4e206666325e"
type: "scenario"
label: "Packs browsed by group"
given: "the Hub's landing page, and Studio's Import from Hub dialog"
tests: |
  apps/e2e/tests/hub/hub.spec.ts › browse a category and search
  apps/e2e/tests/hub/hub.spec.ts › a concern pack shows its group
  apps/e2e/tests/studio/hub-import.spec.ts › the import dialog filters concern packs by group
then: "the Hub lists one tile per group with its count and only the Data packs under it; the Authentication pack shows its group; Studio's dialog lists only the Data packs, each card naming its group"
when: "the user opens the Data group in the Hub, then the Authentication pack, and picks the Data group in Studio's dialog"
---
