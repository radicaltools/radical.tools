---
id: "8176eef6-d3c2-4f7a-9c89-1634d162fa32"
type: "scenario"
label: "A model folder is replaced only after a question"
given: "a folder that holds the model E2E (or Bookstore), and another model kept in the browser"
metrics: |
  test(apps/e2e/tests/studio/folders.spec.ts › Move to a folder… into another model's folder asks before replacing it, and a yes leaves one entry for the folder) passed
  test(apps/e2e/tests/studio/folders.spec.ts › New model on the welcome screen can keep the model in a folder) passed
  test(apps/studio/tests/mdFolderSafety.test.ts › md-folder persistence safety › asks before replacing the model a folder holds, and its entry leaves the list on a yes) passed
then: "Studio asks first, naming the model the folder holds; a no writes nothing and the other model stays where it was; a yes writes the model into the folder, and the Models list keeps one entry for the folder, the replaced model's entry gone"
when: "the user moves the other model into that folder with Move to a folder… in the Models dialog, or creates a New model there with In a folder, and answers no, then moves it again and answers yes"
---
