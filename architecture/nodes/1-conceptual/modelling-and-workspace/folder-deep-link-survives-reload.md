---
id: "d8bd36c8-299c-4688-9ffe-394ee28d94fc"
type: "scenario"
label: "Folder deep link survives reload"
gherkin: "# Covered by: apps/e2e/tests/studio/folders.spec.ts › a deep link into a folder-backed model survives a reload"
given: "the bookstore model saved as a browser folder and open on the System Context view"
then: "the System Context view shows its three elements, then the presentation runs on slide 2 of 2 and the URL keeps the link"
when: "the user reloads the page, then opens and reloads the link …/m/presenter/v/v-containers/p/pres-main/play/1/sl/1"
---
