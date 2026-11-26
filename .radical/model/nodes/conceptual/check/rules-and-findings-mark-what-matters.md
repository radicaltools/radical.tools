---
id: "5dc67b1f-d0d9-471e-979b-baa96d307584"
type: "requirement"
label: "Rules and findings mark what matters"
action: "show, in the Inspector, in its settings and on an element's card, the description of a rule with what the rule asks in bold and the names of properties and files as code, and the sentence of a finding with the words and values it quotes in bold; radical check shall print the descriptions without the marks"
ears_type: "ubiquitous"
rationale: "A rule's description says what it asks and then, at length, how it reads the model; in one weight the eye found neither (the user, 2026-11-26, with the Debt tab's rules on screen). The marks are part of the descriptions, written once where the rule is; what does not draw them takes them out. Evidence: packages/common/src/check/rules.ts, index.ts, goals.ts, profiles.ts (the descriptions), findingWords.ts (plainRuleText, messageParts); packages/ui/src/components/FindingText.tsx; apps/studio/src/renderer/src/components/inspector/shared.tsx, SettingsTab.tsx; apps/cli/src/check.ts (--list-rules)"
---
