---
id: "d0b247c4-77f4-4b0a-9726-bcb8d785b02d"
type: "scenario"
label: "First visit's model not listed"
given: "a browser that has never opened Studio, and the model Studio makes on that first visit"
then: "after the first reload the model is still not the user's and is listed nowhere: not as a recent model in Open, nor in the Models dialog, which does not count it; once saved it is, also after the next reload"
when: "the user reloads Studio, then saves that model and reloads it again"
---
