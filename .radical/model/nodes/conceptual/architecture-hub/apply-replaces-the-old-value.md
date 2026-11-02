---
id: "6b5375bc-a157-4354-8bb2-3bc2e3c76c43"
type: "requirement"
label: "Apply replaces the old value"
action: "Studio shall replace the old value with the new one in the texts of the imported elements, relations and flows (names and step notes) as they are now, keeping the user's other edits and leaving a text that no longer holds the old value, or holds it only inside another word, as it is, all as one undo step; and while a milestone is shown, show and change the milestone's values, Propagate carrying only Apply's changes"
ears_type: "event-driven"
rationale: "Apply rewrote only the fields still holding a {{KEY}}, so a text edited since the import kept the old value. The maintainer decided on 2026-10-21 (D7, D18, exploratory runs 45 to 64) that Apply replaces only the old value in the current text, and that a blank parameter takes the template's default in Studio and over MCP. Evidence: packages/common/src/hubImport.ts (retemplateText), packages/ui/src/store/diagramStore.ts (applyHubTemplate), packages/ui/src/components/HubTemplateSection.tsx"
trigger: "the user changes a value in an imported element's Hub template section and presses Apply"
---
