---
id: "67ff0f59-c354-4ba2-ba8d-d0cd3982b700"
type: "requirement"
label: "Slide camera from slide to slide"
action: "Studio shall draw that view only at the slide's camera from the first frame it shows it (its captured viewport, its focus elements framed, or the view fitted), with no flight from the camera of the view before and no fit on the way; between slides of the same view it shall fly the camera from where it is, moving the point in the middle of the canvas and the zoom together so that both arrive at once."
ears_type: "event-driven"
rationale: "Each view has coordinates of its own: a flight from the camera of the view before showed the new view zoomed, swept it and then jumped to the slide's camera; a canvas that mounted after a slide with no canvas opened at 0,0 ×1 and was fitted for a moment first. On one view, React Flow's flight (van Wijk's) zoomed out and panned first, past the target, and zoomed in after."
trigger: "a slide shows another view than the slide before (a canvas view after another, or after a slide with no canvas such as a flow, table or matrix)"
---
