---
id: "d918a163-6f04-4e53-a894-8f33e5c8f2f4"
type: "scenario"
label: "Setup choices apply and stay"
given: "the Setup wizard on the first start"
metrics: "test(apps/e2e/tests/studio/setup.spec.ts › first start › the choices apply at once and stay after a reload) passed"
then: "Studio turns light at the click, the Welcome screen is left after Finish, and after the reload the wizard stays closed, Studio is light, Shift is the special key and Focus is off"
when: "the user picks Light, Shift as the special key, turns Focus off, finishes, and reloads Studio"
---
