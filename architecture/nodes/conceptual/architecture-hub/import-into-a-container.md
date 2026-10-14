---
id: "5e592702-8cca-4107-995a-4dc7b3785784"
type: "scenario"
label: "Import into a container"
given: "Bookstore is selected in the model tree on the Containers view"
tests: "apps/e2e/tests/studio/hub-import.spec.ts › a concept imported into a selected container lands beside what it holds"
then: "both imports become children of Bookstore and overlap none of its children or each other, and Bookstore grows while Payment Provider and Customer stay clear of it"
when: "the user imports API Versioning twice"
---
