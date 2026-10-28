---
id: "6194bfe1-cd41-422f-b50a-4330c5175ca4"
type: "requirement"
label: "Setup wizard on the first start"
action: "Studio shall open the Setup wizard over the Welcome screen, one step each for the theme, the special key, the canvas (Focus, Smart fit, Wizard on create) and an AI provider, apply each choice as it is made, and not open the wizard on its own again once the user has finished or skipped it."
ears_type: "event-driven"
rationale: "A newcomer meets the settings that change how Studio feels before the first model, instead of finding them later in the Settings menu. Inside VS Code the editor's settings and theme win, so the wizard does not open there; a browser that used Studio before the wizard existed is marked set up without seeing it. Evidence: apps/studio/src/renderer/src/firstStart.ts; apps/studio/src/renderer/src/components/SetupWizard.tsx; apps/studio/src/renderer/src/App.tsx; packages/ui/src/studioSettings.ts (setupDone, specialKey); manual#getting-started; reference#settings"
trigger: "Studio starts in a browser or the desktop app where it has never been set up"
---
