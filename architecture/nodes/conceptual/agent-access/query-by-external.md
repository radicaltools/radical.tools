---
id: "de43f5fd-f1fd-4e5a-851e-9176e9412f80"
type: "scenario"
label: "Query by external"
given: "a model where a person and an external system interact with an internal web app, and the web app calls the external system"
tests: "packages/common/tests/aiQueryLanguage.test.ts › runModelQuery › filters relations by whether their source or target is external"
then: "the first lists the relation from the external system; the second lists the relations into the web app, the person's included, since an element not marked external counts as false"
when: "LIST RELATIONS WHERE source.external = true, and WHERE target.external != true, run"
---
