---
id: "afa978ce-8ed1-43e7-b881-a1b32c8d6798"
type: "requirement"
label: "Wiki edits model inline"
action: "The wiki view shall edit the field in place or create the child element or relation in the model."
ears_type: "complex"
precondition: "Studio is in the Designer perspective"
rationale: "Reviewing and editing prose should happen in one place. Evidence: packages/ui/src/components/WikiView.tsx:210-275, 1130-1140, 1196-1204, 1614-1700; manual#view-wiki"
trigger: "the user clicks a field, Add child or Add relationship on a wiki page"
---
