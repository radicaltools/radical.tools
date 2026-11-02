---
id: "a750bacc-5312-4530-9f99-c6a64912b45a"
type: "scenario"
label: "An element mapped from the command line"
given: "a repository with a model of a system Shop with containers Orders API and Billing API, and one more element named Orders API in another system"
then: "the first adds the entry with the element's id and name; the ambiguous name is refused naming both elements, the id maps the one meant; --remove drops the entry; with no option it says where the element is built, inherited from its system when it has no entry"
when: "radical implement runs with Billing API --path apps/billing, then with Orders API, then with an id, with --remove and with no option"
---
