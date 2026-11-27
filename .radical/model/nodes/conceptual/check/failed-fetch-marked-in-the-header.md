---
id: "e5ca32d4-6d70-46d3-8c31-d421db9c25a5"
type: "scenario"
label: "Failed fetch marked in the header"
given: "test results kept from an earlier fetch and a record that the last fetch from CI found no test report; and, apart, results read with --report"
then: "the chip is marked and opens to when the last fetch ran, the message, and that CI has to keep the test reports as artifacts named in .radical/radical.json's ci.artifacts; the results read with --report say · local on the chip"
when: "the Inspector shows its Tests chip"
---
