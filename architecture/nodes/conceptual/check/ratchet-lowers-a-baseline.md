---
id: "cf8ebe65-f329-4766-b0b0-adebce8d17f9"
type: "scenario"
label: "Ratchet lowers a baseline"
given: "that model and a config with requirement-without-scenario at error, max 4"
metrics: |
  test(apps/cli/src/cli.test.ts › radical check › ratchets the baseline in the config file) passed
  test(packages/common/tests/check.test.ts › radical check: config › ratchets a baseline down, never up) passed
then: "the check passes, says the baseline went from 4 to 1, and gate.json now holds max 1"
when: "the user runs `radical check model --config gate.json --ratchet`"
---
