---
id: "af9b5707-54fd-4b31-8087-4dcd69925913"
type: "scenario"
label: "Path from a requirement to a failing test"
given: "a folder model with a need, a requirement derived from it and two scenarios that verify the requirement, one bound to a test that failed with a message at line 12 and one bound to a test that passed; the test results beside the model"
then: "a Verification path panel shows the need, the requirement (marked), both scenarios and both tests in four columns joined by lines; the failing scenario comes first, its test shows failed, its duration and the message; a link opens the test file at line 12 in VS Code when Studio knows the repository's folder (the desktop app), and there is none for a folder picked in the browser; Only what does not pass leaves the passing scenario out; a click on the need makes the path the need's, Back returns to the requirement's, and Details opens an element's card beside it"
when: "the user opens the requirement's card from the Inspector and clicks Path"
---
