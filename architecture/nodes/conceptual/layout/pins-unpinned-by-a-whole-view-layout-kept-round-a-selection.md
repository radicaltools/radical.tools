---
id: "2649ea79-d87c-4212-bd36-e9bb7a8082e8"
type: "requirement"
label: "Pins: unpinned by a whole-view layout, kept round a selection"
action: "it shall, over the whole view, arrange every element and take the pins off, as the Ensemble mode does; and, around a selection, leave every pinned element, what it holds and the frames holding it where they are, move the rest around them, and keep the pins; a run over the whole view that finds nothing left to tidy but takes pins off shall be an undo step of its own, so Undo gives the pins back and moves nothing."
ears_type: "event-driven"
rationale: "The author pins an element by dropping it, to correct a layout locally; a pin is where a drag was dropped, not a request to stay through a new layout. Tidy first kept the pins over the whole view too: on the author's Domain model view five drop pins left it with nothing to move, and the author asked for Smart Layout to unpin (2026-10-26). Round a selection the rest of the view is meant to stay as it is, pinned elements included. A run that only took pins off made no undo step, so Undo took back the edit before it (round 185–192, 2026-10-26, F-0073)."
trigger: "Smart Layout runs on a view, over the whole view or around a selection"
---
