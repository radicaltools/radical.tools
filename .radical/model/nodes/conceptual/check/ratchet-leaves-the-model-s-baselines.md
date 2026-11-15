---
id: "0e71f972-c38e-4c0d-bff3-558a3d2e98ae"
type: "scenario"
label: "Ratchet leaves the model's baselines"
given: "a repository whose .radical/radical.json names a model kept in another repository, with that model's check.json"
then: "the first exits 2 and leaves the model's check.json as it was; the second lowers the baselines of the repository's config"
when: "radical check --ratchet runs in the repository, then again with --config naming a config of the repository's own"
---
