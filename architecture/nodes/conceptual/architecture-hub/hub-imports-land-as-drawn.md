---
id: "50585fde-de08-42b6-8575-0db0e2e8609b"
type: "scenario"
label: "Hub imports land as drawn"
given: "bookstore on the Radical metamodel"
tests: |
  apps/e2e/tests/studio/hub-import.spec.ts › a blueprint's views keep the Hub's layout, also after a reload
  apps/e2e/tests/studio/hub-import.spec.ts › a concept added in Viewer with a container selected goes into it, as the card says
then: "every imported element has a place on All elements, the blueprint's views keep the Hub's layout with no overlaps after the reload; API Versioning goes inside Bookstore, as its card says"
when: "the Fintech blueprint is imported on Containers and its Containers view opened after a reload; and API Versioning is imported in Viewer with Bookstore selected"
---
