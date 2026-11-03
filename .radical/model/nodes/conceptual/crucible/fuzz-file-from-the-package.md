---
id: "a7c2deb1-5f86-4c06-b3ed-a26371b105b8"
type: "scenario"
label: "Fuzz file from the package"
given: "a suite of a counter with one world and two rules, written with fuzzSuite from the package, and a bug that breaks one rule"
then: "there is a test case for the world and one for each rule: the broken rule fails and names the rule, the other holds"
when: "the file runs"
---
