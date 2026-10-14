---
id: "ad036309-e907-4b40-b459-921bd107712f"
type: "requirement"
label: "AI off by default"
action: "Studio shall keep the AI features off until the user turns on the master switch in the AI providers dialog: AI mode in Quick Search and Create with Radical Forge on the New model step stay hidden, and Radical Forge, which the Radical menu and the Quick Search bar still open, says that AI is disabled and offers Configure… instead of generating."
ears_type: "ubiquitous"
rationale: "Users who never opt in must not see or trigger AI at all. Evidence: apps/studio/src/renderer/src/ai/settings.ts:24-34; apps/studio/src/renderer/src/components/AISettingsModal.tsx:148-165; apps/studio/src/renderer/src/components/QuickSearch.tsx:71-83; manual#ai"
---
