---
id: "8176eef6-d3c2-4f7a-9c89-1634d162fa32"
type: "scenario"
label: "A model folder is replaced only after a question"
given: "a folder that holds the model E2E (or Bookstore), and another model kept in the browser"
then: "Studio asks first, naming the model the folder holds; a no writes nothing and the other model stays where it was; a yes writes the model into the folder, and the Models list keeps one entry for the folder, the replaced model's entry gone"
when: "the user moves the other model into that folder with Move to a folder… in the Models dialog, or creates a New model there with In a folder, and answers no, then moves it again and answers yes"
---
