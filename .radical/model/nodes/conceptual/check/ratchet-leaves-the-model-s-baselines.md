---
id: "0e71f972-c38e-4c0d-bff3-558a3d2e98ae"
type: "scenario"
label: "Ratchet leaves the model's baselines"
given: "a repository whose .radical/radical.json names a model kept in another repository, with that model's check.json; and a model with its check.json"
then: "the first exits 2 and leaves the model's check.json as it was; the second lowers the baselines of the repository's config; with --alone or --trigger it exits 2 and check.json stays as it was"
when: "radical check --ratchet runs in the repository, then again with --config naming a config of the repository's own; and radical check --ratchet runs on that model with --alone, then with --trigger"
---
