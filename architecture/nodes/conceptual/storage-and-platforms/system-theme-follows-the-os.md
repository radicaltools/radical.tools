---
id: "9fdb73e6-fe76-4819-b08c-8c32aaeec7df"
type: "scenario"
label: "System theme follows the OS"
given: "Studio with the System theme, the operating system dark"
tests: "apps/e2e/tests/studio/setup.spec.ts › the System theme follows the operating system"
then: "Studio turns light without a reload; Theme in the Settings menu still reads System"
when: "the operating system turns light"
---
