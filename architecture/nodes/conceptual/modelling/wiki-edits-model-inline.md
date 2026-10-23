---
id: "afa978ce-8ed1-43e7-b881-a1b32c8d6798"
type: "requirement"
label: "Wiki edits model inline"
action: "The wiki view shall edit the field in place, or create, change or remove the element or relation in the model, offering for a relation only the types that fit its two ends (the relationships of Add or link… leaving out part-of between aggregate roots), and asking before Delete with the canvas's dialog, which counts the relations and sequence steps that go and offers Hide from current view, Undo bringing everything back."
ears_type: "complex"
precondition: "Studio is in the Designer perspective"
rationale: "Reviewing and editing prose should happen in one place. Exploratory runs 65 to 69 (2026-10-21, item 241) found the wiki's relation editor offering a generic type and part-of between aggregate roots, and its Delete removing an element without the canvas's question. Evidence: packages/ui/src/components/WikiView.tsx:210-275, 1130-1140, 1196-1204, 1614-1700 (relation editor, relationTypesFitting, requestDelete); packages/ui/src/components/DeleteConfirmDialog.tsx; manual#view-wiki"
trigger: "the user edits a field on a wiki page or uses an element's menu ([edit] or a right click): Add or link…, Edit facts or Delete, or Edit relationship or Remove relationship on an element named in a relation sentence"
---
