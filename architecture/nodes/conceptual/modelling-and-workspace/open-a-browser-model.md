---
id: "91efb6aa-a9b8-4369-a079-8b136e31b6a7"
type: "scenario"
label: "Open a browser model"
given: "a model is kept in the browser"
tests: "apps/e2e/tests/studio/boot.spec.ts › returning visit › Open → In this browser lists the models kept in the browser"
then: "the list shows that model, and Escape returns to the sources with File… offered"
when: "the user chooses Open and then In this browser on the welcome screen, and then presses Escape"
---
