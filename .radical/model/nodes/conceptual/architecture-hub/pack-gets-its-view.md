---
id: "a03dc344-8c3e-4d03-b81c-224b0c8e78b6"
type: "scenario"
label: "Pack gets its view"
given: "a model with a shop system holding a web app and a view already named Authentication"
then: "the first import adds the view \"Authentication 2\" in the folder Concerns listing the pack's elements and the web app, the pack's decision right of its requirements and the shop on their left; the second adds \"Authentication 3\" with the pack's elements only"
when: "the Authentication pack is imported bound to the web app, and again unbound"
---
