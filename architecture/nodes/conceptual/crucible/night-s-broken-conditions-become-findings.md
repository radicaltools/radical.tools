---
id: "49fe33a8-2734-417d-9256-7b73fb3eb45b"
type: "scenario"
label: "Night's broken conditions become findings"
given: "a fitness function triggered on nightly with conditions on studio.open_ms and studio.search_key_ms, one triggered on pull-request with a condition on workspaces.exit_code, and measurements of the night"
metrics: |
  test(tools/nightly-findings.test.ts › nightly findings › makes one for each condition of the night that does not hold, and none for those that hold or run on another trigger) passed
  test(tools/nightly-findings.test.ts › nightly findings › makes one when the night measured nothing it should have) passed
  test(tools/nightly-findings.test.ts › nightly findings › says nothing an open finding already says, and numbers the next one after the last) passed
  test(tools/nightly-findings.test.ts › nightly findings › compares a condition against a baseline with the earlier nights, and makes nothing of it while there are none) passed
  test(tools/nightly-findings.test.ts › nightly findings › judges only the fitness functions that run on the night) passed
then: "one open finding of source sense names the condition, the value, the commit and the day, and none is made for the conditions that hold or for a fitness function that does not run on the night; a condition measured by nothing gets a finding saying so; the same is not said twice while its finding is open, a new finding takes the next number, and it is said again once its finding is fixed; against a baseline, a value beyond the median of the earlier nights with its margin gets a finding naming both, and with no earlier nights none is made"
when: "the night measured open_ms over its limit; then measured no open_ms; then the same is measured again while a finding says so, and once more after that finding is fixed; and a condition against a baseline is measured with earlier nights and without"
---
