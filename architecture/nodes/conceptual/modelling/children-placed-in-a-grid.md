---
id: "d1b5d39a-2a68-44cd-b096-92dab2b8899d"
type: "requirement"
label: "Children placed in a grid"
action: "Studio shall place it in the first free cell of a grid of the container's children, as wide as their widest and as high as their highest, 60 px apart (room for a short relation label between two of them), growing wider than tall, from the container's top left below its header, the first one centred across the container, and grow the container to hold it; an element dropped from the palette where it has room (inside the frame, below its header, clear of what the frame draws) shall stay where the pointer let go of it; the elements already in it shall stay where they are, and a drag shall still place an element freely."
ears_type: "event-driven"
rationale: "An element put into a container landed where it was dropped or where it had stood, on its left edge, past its frame, or in one long row: containers read untidy and needed Smart Layout after every addition. A grid like the one Keep in a grid makes, filled one cell at a time, keeps them readable without moving what the user placed. A drop with room for it is where the author wants the element: the grid took it elsewhere whatever the drop point (the author, 2026-10-26: \"chciałbym jeśli jest miejsce aby upuszczony został tam gdzie najadę myszką\")."
trigger: "an element is added to a container on a canvas (dropped from the palette, made by a wizard or a + row) or moved into one (nested by the special key, Move to…, the card's Parent)"
---
