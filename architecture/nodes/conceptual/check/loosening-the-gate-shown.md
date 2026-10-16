---
id: "0dea3492-0349-491f-a744-5ed676143d7e"
type: "requirement"
label: "Loosening the gate shown"
action: "mark the change, say under it that it loosens the CI gate and in the save bar how many changes do, and show the diff of check.json before it is saved"
ears_type: "unwanted-behaviour"
rationale: "The product owner lets Studio loosen the gate, but never by accident. Evidence: packages/common/src/check/configChanges.ts (compareCheckConfig), apps/studio/src/renderer/src/components/inspector/SettingsTab.tsx (insp-savebar, insp-set-warn, insp-diff)"
unwanted_condition: "an unsaved change in the Inspector's Settings lowers a severity, adds or raises a baseline, lowers or removes a goal, or looks at fewer test files"
---
