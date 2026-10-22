---
id: "d073c798-6a69-4590-bc03-ee91c0b226a5"
type: "scenario"
label: "Unbound decision found"
given: "the model of Open concern found with an accepted ADR marked with the authentication concern that constrains nothing, and a fitness function implementing it"
tests: "packages/common/tests/check.test.ts › radical check: concerns › reports an accepted concern decision that constrains nothing, with where to bind it"
then: "concern-unbound reports the ADR once with its fitness function and the web app as where to bind it; bound, it reports nothing; superseded, it reports nothing; an ADR marked with no concern is never reported"
when: "radical check runs on it with the Authentication pack, then the ADR is bound to the web app, then it is superseded unbound"
---
