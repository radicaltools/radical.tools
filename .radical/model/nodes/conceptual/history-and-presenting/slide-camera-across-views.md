---
id: "347fa4fb-5b48-4630-a281-cc5f2b3b2bb3"
type: "scenario"
label: "Slide camera across views"
given: "a presentation with slides on the Context and Containers views (one fitting its view, two with captured cameras) and a table slide between Containers slides"
then: "each slide on another view is drawn only at its own camera from its first frame, also the one after the table slide; between the two Containers slides the camera flies from the camera of the slide before, the zoom and the point in the middle of the canvas each as far along as the other in every frame"
when: "the presenter steps from a Context slide to a Containers slide and back, between two Containers slides, from the table slide to a Containers slide, and picks slide cards of both views in the Presentations place"
---
