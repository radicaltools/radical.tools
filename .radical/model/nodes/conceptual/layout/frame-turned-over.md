---
id: "9e47125f-f78b-49b8-96a9-f8755d118243"
type: "requirement"
label: "Frame turned over"
action: "the system shall try mirroring what the frame holds, left to right and top to bottom, the frame keeping its place and size, and take it when the reader's cost falls; a frame holding a pinned element is not turned."
ears_type: "event-driven"
rationale: "The element a line leaves a frame from should stand on the side the line leaves by; moving it alone breaks the rows inside the frame, mirroring keeps them."
trigger: "the user runs Smart Layout on a view with a frame holding two or more elements and a line leaving it"
---
