---
id: "b6f52393-19f5-4632-ae4a-73e7c6232b25"
type: "requirement"
label: "Ancestors join view automatically"
action: "Studio shall show the elements listed in a view together with all their ancestor containers; a view that lists no elements shows the whole model, unless its last listed elements were removed, when it stays empty."
ears_type: "ubiquitous"
rationale: "Nesting must stay readable without the user listing every parent by hand. Evidence: packages/layout/src/viewInput.ts:9-21; packages/ui/src/components/WikiView.tsx:194-208; manual#views"
---
