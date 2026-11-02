---
id: "3ec12aff-bea7-48b1-aeae-fddc6fa94440"
type: "requirement"
label: "Studio shows the other models"
action: "Studio shall show, beside the model's name, a button with the number of other models it depends on, or a warning with the number of problems; opened, it shall list each model with the version deps.json pins and the commit fetched, the models fetched through another indented with the model that names them, and when they were fetched, warn about a model not fetched or fetched at another version than pinned with the command that fetches them, and open a model's folder of views when the model is clicked"
ears_type: "state-driven"
precondition: "the open model has a deps.json"
rationale: "Without it a federation shows only in the dashed elements and the view folders, and nobody sees which versions of the other models the picture is made of, or that a pull changed a pin and the fetch is behind. Evidence: apps/studio/src/renderer/src/components/OtherModels.tsx, apps/studio/src/renderer/src/persistence/otherModels.ts (otherModelsSummary)"
---
