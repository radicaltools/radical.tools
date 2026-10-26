---
id: "7f7ba5e3-67ae-4842-90c1-58b17ed05941"
type: "requirement"
label: "Nothing left for a second run"
action: "it shall find nothing left to tidy and leave every element where it is: Tidy runs again on its own layout and takes what that run finds, until a run finds nothing, as far as its budget allows; it repeats its closing passes (lines drawn in, judged afresh, the margin) until one changes nothing, takes a return to its start as a circle, and keeps the boxes on a 1/1024 px grid, so the layout it hands over is judged exactly as it left it."
ears_type: "event-driven"
rationale: "A second run found more to do (56 steps over the blueprints and patterns), so the author could not tell when a layout was finished (round 185–192, 2026-10-26, F-0074); now 0 on every blueprint, pattern and sample view. On a state machine view of this model, loose elements gathered into the margin and moves that shifted their frame took turns, so a run stopped them as a circle that a fresh run continued (F-0107, round 193–200, 2026-10-26); a run now takes about a fifth longer. Evidence: packages/layout/src/tidy/index.ts, packages/layout/src/tidy/layout.ts"
trigger: "Smart Layout tidies a view again on the layout it has just made, nothing changed since"
---
