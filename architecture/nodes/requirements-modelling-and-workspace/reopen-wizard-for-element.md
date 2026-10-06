---
id: "a99f01e6-d5c7-47db-87a1-a94c44677a26"
type: "requirement"
label: "Reopen wizard for element"
action: "Studio shall open the wizard prefilled from the element and, on Save, write only the changed values and add or remove the relations the wizard covers."
ears_type: "event-driven"
rationale: "The guided form stays useful for completing records later without overwriting untouched data. Evidence: packages/ui/src/components/RightPanel.tsx:1842-1846; packages/ui/src/store/diagramStore.ts:1504-1559; packages/ui/tests/nodeWizard.test.ts:143; manual#properties"
trigger: "the user clicks Fill in with wizard… on an element whose type has a wizard"
---
