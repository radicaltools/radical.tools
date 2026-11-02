---
id: "3a258201-f6c2-4f4a-8161-dbcaaffecfb9"
type: "requirement"
label: "Need page lists derived requirements"
action: "The wiki view shall list the elements linked by that relation as the page's children, and Add child shall create the new element with that relation back to the page's element."
ears_type: "state-driven"
precondition: "the element's type defines a hierarchy relation, such as derives for needs and requirements"
rationale: "Traceability from need to requirement is read as a hierarchy, not as containment. Evidence: packages/ui/src/components/WikiView.tsx:798-840, 1120-1140; packages/common/src/metamodel/presets/governance.ts:158, 208; manual#view-wiki"
---
