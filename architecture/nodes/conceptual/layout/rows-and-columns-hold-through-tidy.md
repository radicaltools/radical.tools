---
id: "910a42ff-a899-4c6b-86b3-143a40864bed"
type: "requirement"
label: "Rows and columns hold through Tidy"
action: "Tidy shall line them up only where they do not hold as the canvas draws them, at the start (and after a rough layout), keep them through every move (a row follows a member that left it, or the member is put back), and line them up again before it moves the layout to the top left, never pushing aside a pinned element or one outside a Tidy around, so the layout it hands over is exactly the one it judged and a second run finds nothing left to tidy."
ears_type: "state-driven"
precondition: "a view Smart Layout tidies has rows or columns the author set"
rationale: "Alignments were enforced only after Tidy's best-layout guard and its move to the top left, so it handed over a layout it had not judged, and every later run started from it and never said nothing was left to tidy (round 185–192, 2026-10-26, F-0081). Tidy then lined up the rows with enforceAlignments even where they held, handing over its padded refit of the view's invisible frames, a layout it never judged, and its separate pass pushed apart every close pair, pinned elements and those outside a Tidy around included (F-0106, F-0108, round 193–200, 2026-10-26). Evidence: packages/layout/src/tidy/index.ts"
---
