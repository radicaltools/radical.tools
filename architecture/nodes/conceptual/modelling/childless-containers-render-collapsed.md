---
id: "03e6f87e-dd06-4e99-87be-b37b320b3caa"
type: "requirement"
label: "Childless containers render collapsed"
action: "Studio shall render that container collapsed in the view."
ears_type: "state-driven"
precondition: "a container is listed in a view but none of its children are"
rationale: "A system context view should show a system as one box when its internals are not part of the view. Evidence: packages/layout/src/viewInput.ts:23-50; packages/ui/tests/viewCollapse.test.ts:235-300; manual#view-structure"
---
