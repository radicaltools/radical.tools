---
id: "ad036309-e907-4b40-b459-921bd107712f"
type: "requirement"
label: "AI off by default"
action: "Studio shall keep the AI features off until the user turns on the master switch in the AI providers dialog: AI mode in Quick Search and Create with Radical Forge on the New model step stay hidden, and Radical Forge is offered disabled in the Radical menu and the Quick Search bar, with a hint how to set an AI provider up, and saves nothing and sends no request."
ears_type: "ubiquitous"
rationale: "Users who never opt in must not see or trigger AI at all. Opening Radical Forge without AI saved the description as a need and showed steps that could not run; the maintainer decided on 2026-10-21 (D14, exploratory runs 45 to 64) that the Forge is disabled without an AI provider. Evidence: apps/studio/src/renderer/src/ai/settings.ts; apps/studio/src/renderer/src/components/AISettingsModal.tsx; apps/studio/src/renderer/src/components/QuickSearch.tsx; apps/studio/src/renderer/src/components/Toolbar.tsx; manual#ai"
---
