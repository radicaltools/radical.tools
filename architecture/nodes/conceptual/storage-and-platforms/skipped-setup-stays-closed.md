---
id: "ce4f4718-4709-40c6-adc0-134e04da947d"
type: "scenario"
label: "Skipped setup stays closed"
given: "the Setup wizard on the first start"
metrics: "test(apps/e2e/tests/studio/setup.spec.ts › first start › Skip setup closes it for good) passed"
then: "the Welcome screen shows, with the default settings, and the wizard does not open again"
when: "the user chooses Skip setup and reloads Studio"
---
